import { allowsActionFallback, resolveTurnConstraints } from "../player/turn_constraints";
import type { ErrorDiagnostic } from "@ai-werewolf-arena/replay-contract";
import { describeError, formatErrorDiagnostic } from "../../../utils/error_diagnostic";
import { text, type Locale } from "@ai-werewolf-arena/game-text";
import { RoleComponent } from "../../../core/domain/components/role";
import { ActionProvider, ActionRequest, BoardConfig, ToolCall } from "../../../core/domain"
import { World } from "../../../core/domain/world";
import {
  getDefaultConfigRenderRegistry,
  getDefaultPhaseStageLocalizationRegistry,
  getDefaultRoleCatalog,
  getDefaultTargetHintRegistry,
  getDefaultToolSpecRegistry,
  type RoleCatalog,
} from "../../../game/mechanisms";
import { safeRecordLogicOp } from "../../../recording/session_recorder";
import { AcpSession, AcpSessionAuditTrace, AcpSessionFactory } from "../../integrations/acp/session";
import { awaitBeforeDeadline, awaitWithAbort, TurnDeadlineElapsed, settleWithin } from "../../runtime/turn_deadline";
import { AcpSessionPool } from "./session_pool";
import {
  AcpBugReport,
  AcpTurnRegistry,
  McpBridgeResult,
} from "../../integrations/acp/acp_turn_registry";
import { BaselineBotActionProvider } from "../providers/action_providers";
import { AgentBugReportService } from "../reporting/bug_report_service";
import {
  encodePlayerVisibleEventBatch,
  parsePlayerVisibleEvents,
} from "../visible_event_protocol";
import { BuiltPlayerPrompt, PlayerRoundOutcome } from "../player/contracts";
import { PlayerPromptPolicy } from "../player/player_prompt_policy";
import { PlayerRoundRecorder } from "../player/player_round_recorder";
import { ScopedRequestScheduler } from "../../runtime/request_scheduler";
import { LlmObserver } from "../player/player_observer";

export interface AcpActionProviderOptions {
  fallbackProvider?: ActionProvider;
  sessionFactory?: AcpSessionFactory;
  sessionFactoryResolver?: (actorId: number) => AcpSessionFactory;
  boardConfig?: BoardConfig;
  personalityPromptResolver?: (request: ActionRequest, role?: RoleComponent) => string | undefined;
  turnTimeoutMs?: number;
  onBugReport?: (report: AcpBugReport) => void;
  maxConcurrentRequests?: number;
  trace?: boolean;
  displayLocale?: Locale;
  colorizeLogs?: boolean;
  printLlmIo?: boolean;
  printThinking?: boolean;
  roleCatalog?: RoleCatalog;
}

interface AcpTurnPromptBuild {
  prompt: string;
  userPrompt: string;
  turnId: string;
  eventCursorBefore: number;
  eventCursorAfter: number;
}

interface AcpTurnOutcome {
  action: ToolCall | null;
  reason?: string;
  requestError?: ErrorDiagnostic;
}

/**
 * 将 ACP Agent 适配为游戏 ActionProvider。
 *
 * Agent 的文本与 ACP update 仅用于可观测；只有注入的 werewolf-game MCP
 * server 的 submit_action tool 才会被返回给游戏引擎。
 */
export class AcpActionProvider implements ActionProvider {
  private readonly registry: AcpTurnRegistry;
  private readonly sessions = new AcpSessionPool((actorId) => {
    this.eventCursor.delete(actorId);
    this.sessionPromptByActor.delete(actorId);
  });
  private readonly fallbackProvider: ActionProvider;
  private readonly eventCursor = new Map<number, number>();
  private readonly sessionPromptByActor = new Map<number, string>();
  private readonly bugReportService: AgentBugReportService;
  private readonly promptPolicy: PlayerPromptPolicy;
  private readonly roundRecorder: PlayerRoundRecorder;
  private readonly pending = new Set<Promise<ToolCall | null>>();
  private readonly controllers = new Map<number, AbortController>();
  private readonly closeController = new AbortController();
  private closed = false;
  private readonly scheduler: ScopedRequestScheduler;
  private readonly observer: LlmObserver;

  constructor(
    world: World,
    private readonly options: AcpActionProviderOptions,
  ) {
    this.observer = new LlmObserver({ transport: "acp", trace: options.trace ?? false, locale: options.displayLocale ?? world.locale, colorizeLogs: options.colorizeLogs, printLlmIo: options.printLlmIo ?? false, printThinking: options.printThinking ?? false });
    this.scheduler = new ScopedRequestScheduler({ defaultMaxConcurrentRequests: options.maxConcurrentRequests ?? Infinity,
      onWait: ({ request, queueDepth, active, limit }) => this.observer.trace(`request_queue_wait player=${request.actorId} phase=${request.phase} queue_depth=${queueDepth} active=${active}/${limit}`),
    });
    const roleCatalog = options.roleCatalog ?? getDefaultRoleCatalog();
    this.fallbackProvider = options.fallbackProvider ?? new BaselineBotActionProvider(world, roleCatalog);
    this.bugReportService = new AgentBugReportService(world);
    this.registry = new AcpTurnRegistry(world, (report) => this.handleBugReport(report), roleCatalog);
    const localization = getDefaultPhaseStageLocalizationRegistry();
    this.promptPolicy = new PlayerPromptPolicy(world, {
      personalityPromptResolver: options.personalityPromptResolver,
      toolSpecRegistry: getDefaultToolSpecRegistry(),
      roleCatalog,
      targetHintRegistry: getDefaultTargetHintRegistry(),
      phaseStageLocalizationRegistry: localization,
      configRenderRegistry: getDefaultConfigRenderRegistry(),
      boardConfig: options.boardConfig,
    });
    this.roundRecorder = new PlayerRoundRecorder(world);
  }

  get runtimeState() { return { closed: this.closed, turns: this.pending.size, registry: this.registry.snapshot, pool: this.sessions.snapshot, scheduler: this.scheduler.snapshot }; }

  getAction(request: ActionRequest): Promise<ToolCall | null> {
    if (this.closed) return Promise.reject(new Error("acp_provider_closed"));
    if (this.sessions.hasUnreclaimedResources) return Promise.reject(new Error("acp_resource_reclamation_failed"));
    if (this.controllers.has(request.actorId)) return Promise.reject(new Error("acp_actor_turn_already_open"));
    const startedAt = Date.now();
    const bounded = { ...request, deadlineAtMs: Math.min(request.deadlineAtMs ?? Infinity, startedAt + (this.options.turnTimeoutMs ?? 45_000)) };
    const controller = new AbortController(); this.controllers.set(request.actorId, controller);
    const timer = setTimeout(() => controller.abort(new TurnDeadlineElapsed()), Math.max(0, bounded.deadlineAtMs - Date.now()));
    let resolve!: (action: ToolCall | null) => void, reject!: (error: unknown) => void;
    const task = new Promise<ToolCall | null>((done, fail) => { resolve = done; reject = fail; });
    this.pending.add(task);
    void this.runScheduled(bounded, startedAt, controller.signal).then(resolve, reject);
    const cleanup = () => { clearTimeout(timer); this.controllers.delete(request.actorId); this.pending.delete(task); };
    return task.then(action => { cleanup(); return this.closed ? null : action; }, error => { cleanup(); throw error; });
  }

  private async runScheduled(request: ActionRequest, startedAt: number, signal: AbortSignal): Promise<ToolCall | null> {
    let release: (() => void) | undefined;
    try {
      release = await this.scheduler.acquire(request, undefined, signal);
      this.observer.trace(`request_start player=${request.actorId} phase=${request.phase} tools=${request.allowedTools.join(",")} timeout_ms=${Math.max(0, request.deadlineAtMs! - Date.now())}`);
      return await this.runTurn(request, startedAt, signal);
    } catch (error) {
      if (error === this.closeController.signal.reason) return null;
      // No model/session starts after a queue deadline. The existing local
      // baseline branch still owns the immediate final choice.
      if (!release && describeError(error).code === "request_timeout") return this.runTurn(request, startedAt, signal);
      throw error;
    } finally {
      // An unknown/failed reclamation cannot become a fresh model slot. Stop
      // this provider's waiters until a new runtime is explicitly constructed.
      if (this.sessions.hasUnreclaimedResources) this.scheduler.close(new Error("acp_resource_reclamation_failed"));
      release?.();
    }
  }

  private async runTurn(request: ActionRequest, startedAt: number, signal: AbortSignal): Promise<ToolCall | null> {
    if (this.closed) return null;
    const deadlineAtMs = request.deadlineAtMs!;
    let session: AcpSession | undefined;
    let turn: ReturnType<AcpTurnRegistry["openTurn"]> | undefined;
    let built: AcpTurnPromptBuild | undefined;
    let auditTrace: AcpSessionAuditTrace | undefined;
    let fallbackReason = "model_declined_required_action";
    let requestError: ErrorDiagnostic | undefined;
    try {
      if (this.sessions.isClosed || deadlineAtMs <= Date.now()) throw new Error("acp_deadline_elapsed");
      session = await awaitWithAbort(this.sessions.getOrCreate(request.actorId, deadlineAtMs, () => {
        const factory = this.options.sessionFactoryResolver?.(request.actorId) ?? this.options.sessionFactory;
        if (!factory) throw new Error("acp_session_factory_missing");
        const initialPrompt = this.buildSessionPrompt(request);
        this.observer.prompt([{ role: "system", content: initialPrompt }], request);
        if (this.closed) throw this.closeController.signal.reason;
        this.sessionPromptByActor.set(request.actorId, initialPrompt);
        return { factory, input: { actorId: request.actorId, registry: this.registry, initialPrompt } };
      }), signal);
      if (this.sessions.isClosed || deadlineAtMs <= Date.now()) throw new Error("acp_deadline_elapsed");
      turn = this.registry.openTurn(request, session.sessionId);
      built = this.buildTurnPrompt(request, turn.turnId, true);
      this.observer.prompt([{ role: "user", content: built.prompt }], request);
      if (this.closed) return null;
      const promptTask = session.prompt(built.prompt);
      const outcome = await awaitWithAbort(this.waitForAction(turn.action, promptTask, request), signal);
      if (this.closed) return null;
      this.registry.closeTurn(turn.sessionId);
      if (outcome.reason === "request_timeout" || outcome.reason === "deadline_skip") {
        await this.sessions.discard(request.actorId);
      } else {
        let cancelled = true;
        try { await awaitBeforeDeadline(() => session!.cancel(), Math.min(deadlineAtMs, Date.now() + 300), signal); }
        catch (error) {
          if (error === this.closeController.signal.reason) return null;
          cancelled = false;
          // A bounded cancellation timeout triggers force reclamation. A real
          // RPC/adapter failure remains owned and is reported by final close.
          if (!(error instanceof TurnDeadlineElapsed)) this.sessions.noteCleanupFailure(error);
        }
        if (!cancelled || !await settleWithin(promptTask, Math.min(1_000, Math.max(0, deadlineAtMs - Date.now())))) {
          await this.sessions.discard(request.actorId);
        }
      }
      if (this.closed) return null;
      if (signal.aborted || deadlineAtMs <= Date.now()) throw signal.reason ?? new Error("acp_deadline_elapsed");
      auditTrace = session.takeAuditTrace?.();
      if (this.closed) return null;
      if (outcome.action) {
        this.observer.trace(`request_ok player=${request.actorId} phase=${request.phase} action=${outcome.action.name} args=${JSON.stringify(outcome.action.args)} elapsed_ms=${Date.now() - startedAt}`);
        this.recordPlayerRound(request, built, {
          action: outcome.action,
          auditTrace,
          elapsedMs: Date.now() - startedAt,
        });
        return this.closed ? null : outcome.action;
      }
      if (outcome.reason === "model_declined_required_action" && resolveTurnConstraints(request).minValidActions === 0) {
        this.observer.trace(`request_none player=${request.actorId} phase=${request.phase} elapsed_ms=${Date.now() - startedAt}`);
        this.recordPlayerRound(request, built, { action: null, auditTrace, elapsedMs: Date.now() - startedAt });
        return null;
      }
      fallbackReason = outcome.reason ?? fallbackReason;
      requestError = outcome.requestError;
    } catch (error) {
      await this.sessions.discard(request.actorId);
      if (error === this.closeController.signal.reason) return null;
      fallbackReason = "runtime_error";
      requestError = describeError(error);
      this.observer.trace(`request_transport_fail player=${request.actorId} phase=${request.phase} err=${formatErrorDiagnostic(error, this.observer.locale)}`);
      if (this.closed) return null;
      safeRecordLogicOp({
        scope: "llm_action_provider",
        op: "action_provider_error",
        actorId: request.actorId,
        phase: request.phase,
        status: "fallback",
        reason: requestError.code,
        output: { diagnostic: requestError },
      });
    } finally {
      if (turn) {
        this.registry.closeTurn(turn.sessionId);
      }
    }
    if (this.closed) return null;
    built ??= this.buildTurnPrompt(request, turn?.turnId ?? "unopened", false);
    auditTrace ??= session?.takeAuditTrace?.();
    if (this.closed) return null;
    let fallback: ToolCall | null;
    try { fallback = allowsActionFallback(request) ? await awaitBeforeDeadline(() => this.fallbackProvider.getAction(request), deadlineAtMs, this.closeController.signal) : null; }
    catch (error) {
      if (error === this.closeController.signal.reason) return null;
      if (!(error instanceof TurnDeadlineElapsed)) throw error;
      fallback = null; fallbackReason = "deadline_skip";
    }
    if (this.closed) return null;
    this.observer.trace(`request_recovered player=${request.actorId} phase=${request.phase} reason=${fallbackReason} fallback=${fallback?.name ?? "none"}`);
    this.recordPlayerRound(request, built, {
      action: fallback,
      auditTrace,
      elapsedMs: Date.now() - startedAt,
      fallbackReason,
      requestError,
    });
    return this.closed ? null : fallback;
  }

  async close(): Promise<void> {
    this.closed = true;
    this.closeController.abort(new Error("acp_provider_closed"));
    this.scheduler.close(this.closeController.signal.reason);
    this.registry.close();
    for (const controller of this.controllers.values()) controller.abort(this.closeController.signal.reason);
    const failures: unknown[] = [];
    const closing = this.sessions.close().catch(error => { failures.push(error); });
    const settled = await Promise.allSettled([...this.pending]);
    for (const result of settled) if (result.status === "rejected") failures.push(result.reason);
    await closing;
    this.eventCursor.clear(); this.sessionPromptByActor.clear();
    if (failures.length) throw new AggregateError(failures, "acp_provider_close_failed");
  }

  private async waitForAction(
    action: Promise<ToolCall | null>,
    promptTask: Promise<void>,
    request: ActionRequest,
  ): Promise<AcpTurnOutcome> {
    const timeoutMs = this.resolveTimeoutMs(request);
    if (timeoutMs <= 0) {
      return { action: null, reason: "deadline_skip" };
    }
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        action.then((value) => ({ action: value })),
        // A completed Agent turn that did not invoke submit_action cannot still
        // produce a valid action. Fall back now instead of waiting for the full
        // LLM timeout (often minutes for ACP agents).
        promptTask.then(
          (): AcpTurnOutcome => ({ action: null, reason: "model_declined_required_action" }),
          (error): AcpTurnOutcome => ({
            action: null,
            reason: "runtime_error",
            requestError: describeError(error),
          }),
        ),
        new Promise<AcpTurnOutcome>((resolve) => {
          timer = setTimeout(
            () => resolve({ action: null, reason: "request_timeout" }),
            timeoutMs,
          );
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }


  private resolveTimeoutMs(request: ActionRequest): number {
    const configured = this.options.turnTimeoutMs ?? 45_000;
    const remaining = request.deadlineAtMs === undefined
      ? configured
      : Math.max(0, request.deadlineAtMs - Date.now());
    return Math.min(configured, remaining);
  }

  /** 创建 session 时复用 LLM provider 的既有身份、规则和板子系统提示。 */
  private buildSessionPrompt(request: ActionRequest): string {
    return this.promptPolicy.buildSystem(request, {
      supportsDebugReporting: true,
      includeToolUseInstructions: false,
    }).systemPrompt;
  }

  /** 回合提示遵循既有阶段规则、目标提示与可见事件增量结构。 */
  private buildTurnPrompt(
    request: ActionRequest,
    turnId: string,
    advanceCursor: boolean,
  ): AcpTurnPromptBuild {
    const lines: string[] = [];
    const events = parsePlayerVisibleEvents(request.context.visible_events);
    const cursor = this.eventCursor.get(request.actorId) ?? 0;
    const delta = events.filter((event) => event.seq > cursor);
    const nextCursor = events.reduce(
      (maxSeq, event) => Math.max(maxSeq, event.seq),
      cursor,
    );
    if (advanceCursor) this.eventCursor.set(request.actorId, nextCursor);
    if (delta.length) {
      lines.push(text(this.promptPolicy.locale, "prompt.acp.events", { events: encodePlayerVisibleEventBatch(delta) }));
    }
    lines.push(text(this.promptPolicy.locale, "prompt.acp.turn", { turn: turnId }));
    const userPrompt = this.promptPolicy.buildUser(request, {
      turnId,
      allowedTools: request.allowedTools,
      actionSubmissionHint: text(this.promptPolicy.locale, "prompt.acp.submit", { turn: turnId }),
    });
    lines.push(userPrompt);
    return {
      prompt: lines.filter(Boolean).join("\n"),
      userPrompt,
      turnId,
      eventCursorBefore: cursor,
      eventCursorAfter: advanceCursor ? nextCursor : cursor,
    };
  }

  /** 将 ACP 回合映射到与直接 LLM 路径相同的玩家审计结构。 */
  private recordPlayerRound(
    request: ActionRequest,
    built: AcpTurnPromptBuild,
    input: {
      action: ToolCall | null;
      auditTrace?: AcpSessionAuditTrace;
      elapsedMs: number;
      fallbackReason?: string;
      requestError?: ErrorDiagnostic;
    },
  ): void {
    if (this.closed) return;
    const systemPrompt =
      this.sessionPromptByActor.get(request.actorId) ?? this.buildSessionPrompt(request);
    if (this.closed) return;
    const thinkingText = this.formatAuditTrace(input.auditTrace);
    const actionArgs = input.action
      ? ((input.action.args ?? {}) as Record<string, unknown>)
      : undefined;
    const prompt: BuiltPlayerPrompt = {
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: built.userPrompt }],
      systemPrompt,
      userPrompt: built.userPrompt,
      boardInfoPrompt: this.promptPolicy.buildBoardInfo(),
      isInitialRound: false,
      eventCursorBefore: built.eventCursorBefore,
      eventCursorAfter: built.eventCursorAfter,
      contextWindowStart: 0,
      contextWindowEnd: 0,
      contextWindowTotal: 0,
      turnId: built.turnId,
      auditMetadata: [
        `transport=acp_mcp;turn_id=${built.turnId};event_cursor=${built.eventCursorBefore}->${built.eventCursorAfter};elapsed_ms=${input.elapsedMs}`,
      ],
    };
    const outcome: PlayerRoundOutcome = {
      ...(thinkingText ? { thinkingText } : {}),
      actionMode: input.action ? "tool_call" : "none",
      toolCalls: input.action
        ? [
            {
              name: input.action.name,
              args: actionArgs ?? {},
              accepted: true,
              result: {
                transport: "acp_mcp",
                turn_id: built.turnId,
              },
            },
          ]
        : [],
      finalAction: input.action,
      ...(input.requestError
        ? { retryTrace: [{ attempt: 0, status: "request_error", reason: input.requestError.code, diagnostic: input.requestError }] }
        : {}),
      ...(input.fallbackReason
        ? {
            fallback: {
              used: allowsActionFallback(request),
              reason: input.fallbackReason,
              ...(input.action
                ? { action: { name: input.action.name, args: actionArgs ?? {} } }
                : {}),
            },
          }
        : {}),
    };
    if (!this.closed) this.roundRecorder.record(request, prompt, outcome);
  }

  private formatAuditTrace(trace?: AcpSessionAuditTrace): string | undefined {
    if (!trace) return undefined;
    const thoughts = trace.thoughts.join(" ").trim().slice(0, 2_000);
    const messages = trace.messages.join(" ").trim().slice(0, 2_000);
    const lines = [
      ...(thoughts ? [`thought: ${thoughts}`] : []),
      ...(messages ? [`message: ${messages}`] : []),
    ];
    return lines.length ? lines.join("\n") : undefined;
  }

  /** ACP report_bug 与直接 LLM 路径共享落盘语义及限流规则。 */
  private handleBugReport(report: AcpBugReport): McpBridgeResult {
    const result = this.bugReportService.report(report);
    if (result.ok && result.accepted) {
      this.options.onBugReport?.(report);
      return { ok: true, accepted: true };
    }
    return result;
  }

}
