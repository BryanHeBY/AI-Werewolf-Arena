/**
 * 负责 Pi 玩家回合的调度、唯一行动选择窗口、可见提示和 AWA 录制。
 * 输出是已预检的候选或 null，以及真实轮次录制；模型失败与清理失败分别保留。
 * Pi 持内存 transcript；本 owner 只持会话引用、游标及当轮证据。工具候选经原 ActionTurn／
 * ActionReception 接收，实际提交仍归引擎；取消先撤权，再等待底层结束，槽位不提前释放。
 */
import { text, toolFailure, type Locale } from "@ai-werewolf-arena/game-text";
import type { ReadonlyBoardConfig } from "@ai-werewolf-arena/game-contract";
import type { ReplayPlayerDeltaMessage } from "@ai-werewolf-arena/replay-contract";
import type { PiPromptOptions, PiPromptResult, PiSessionOptions } from "../../adapters/pi";
import type { ToolInvocation } from "../../adapters/llm/transport";
import { PlayerRoundRecorder } from "../../app/player-round-recorder";
import type { ActionProvider, ActionRequest, ToolCall } from "../../domain";
import type { World } from "../../domain/world";
import { inheritRequestAlias } from "../../domain/request-delivery";
import { getActionRequestDay, getActionRequestStage } from "../../domain/action-request-context";
import { ActionReception } from "../../engine/actions/action-reception";
import {
  allowsActionFallback,
  resolveTurnConstraints,
} from "../../engine/actions/turn-constraints";
import { safeRecordLogicOp } from "../../recording/session/recorder";
import {
  getDefaultConfigRenderRegistry,
  getDefaultPhaseStageLocalizationRegistry,
  getDefaultRoleCatalog,
  getDefaultTargetHintRegistry,
  getDefaultToolCallRepairRegistry,
  getDefaultToolSpecRegistry,
  ToolValidationRuleRegistry,
} from "../../rulesets/mechanism-api";
import { describeError } from "../../utils/error-diagnostic";
import { gameToolProtocol } from "../game-tool-protocol";
import type { BuiltPlayerPrompt, PlayerRoundOutcome } from "../player/contracts";
import { ActionTurn } from "../player/action-turn";
import { PlayerPromptPolicy } from "../player/player-prompt-policy";
import { buildConstraintRetryPrompt } from "../player/prompt-templates";
import {
  ObservationFallbackActionProvider,
  ObservationFallbackStrategy,
} from "../providers/observation-fallback";
import type { ObservedPlayerStrategy } from "../observation/player-observation";
import { AgentBugReportService } from "../reporting/bug-report-service";
import { ScopedRequestScheduler } from "../runtime/request-scheduler";
import { awaitBeforeDeadline } from "../runtime/turn-deadline";
import { LlmObserver } from "../player/player-observer";
import { PiPromptState } from "./pi-prompt-state";
import { PiConsolePresenter } from "./pi-console-presenter";

/** 只依赖传输窄端口；测试可注入合成会话，不能取得领域写权。 */
export interface PiPlayerSession {
  prompt<T>(prompt: string, options: PiPromptOptions<T>): Promise<PiPromptResult<T>>;
  takeTrace<T = never>(): PiPromptResult<T>;
  close(): Promise<void>;
}
export interface PiPlayerRuntime {
  createSession(options: PiSessionOptions): Promise<PiPlayerSession>;
  close(): Promise<void>;
}
export interface PiActionProviderOptions {
  runtime: PiPlayerRuntime;
  settingsResolver: (actorId: number) => Record<string, unknown>;
  personalityPromptResolver?: (request: ActionRequest) => string | undefined;
  boardConfig?: ReadonlyBoardConfig;
  turnTimeoutMs?: number;
  maxConcurrentRequests?: number;
  displayLocale?: Locale;
  printLlmIo?: boolean;
  trace?: boolean;
  colorizeLogs?: boolean;
  printThinking?: boolean;
  fallbackStrategy?: ObservedPlayerStrategy;
}
interface PlayerSession {
  session: PiPlayerSession;
  prompts: PiPromptState;
}

export class PiActionProvider implements ActionProvider {
  private readonly sessions = new Map<number, PlayerSession>();
  private readonly creating = new Set<Promise<PlayerSession>>();
  private readonly pending = new Set<Promise<ToolCall | null>>();
  private readonly controllers = new Map<number, AbortController>();
  private readonly scheduler: ScopedRequestScheduler;
  private readonly policy: PlayerPromptPolicy;
  private readonly reception: ActionReception;
  private readonly recorder: PlayerRoundRecorder;
  private readonly fallback: ActionProvider;
  private readonly bugs: AgentBugReportService;
  private readonly observer: LlmObserver;
  private readonly cleanupFailures: unknown[] = [];
  private readonly closeController = new AbortController();
  private closed = false;
  private closing?: Promise<void>;

  constructor(
    private readonly world: World,
    private readonly options: PiActionProviderOptions,
  ) {
    const catalog = getDefaultRoleCatalog();
    this.observer = new LlmObserver({
      transport: "pi",
      trace: options.trace ?? false,
      locale: options.displayLocale ?? world.locale,
      colorizeLogs: options.colorizeLogs,
      printLlmIo: options.printLlmIo ?? false,
      printThinking: options.printThinking ?? false,
    });
    this.scheduler = new ScopedRequestScheduler({
      defaultMaxConcurrentRequests: options.maxConcurrentRequests ?? Infinity,
    });
    this.policy = new PlayerPromptPolicy(world, {
      personalityPromptResolver: options.personalityPromptResolver,
      boardConfig: options.boardConfig,
      roleCatalog: catalog,
      toolSpecRegistry: getDefaultToolSpecRegistry(),
      targetHintRegistry: getDefaultTargetHintRegistry(),
      phaseStageLocalizationRegistry: getDefaultPhaseStageLocalizationRegistry(),
      configRenderRegistry: getDefaultConfigRenderRegistry(),
    });
    this.reception = new ActionReception(
      world,
      getDefaultToolCallRepairRegistry(),
      getDefaultToolSpecRegistry(),
      new ToolValidationRuleRegistry(undefined, catalog),
    );
    this.recorder = new PlayerRoundRecorder(world);
    this.bugs = new AgentBugReportService(world);
    this.fallback = new ObservationFallbackActionProvider(
      (request) => this.policy.buildObservation(request),
      options.fallbackStrategy ?? new ObservationFallbackStrategy(world.locale),
    );
  }

  get runtimeState() {
    return {
      closed: this.closed,
      turns: this.pending.size,
      sessions: this.sessions.size,
      creating: this.creating.size,
      scheduler: this.scheduler.snapshot,
    };
  }

  getAction(request: ActionRequest): Promise<ToolCall | null> {
    if (this.closed) return Promise.reject(this.closeController.signal.reason);
    if (this.cleanupFailures.length)
      return Promise.reject(new Error("pi_resource_reclamation_failed"));
    if (this.controllers.has(request.actorId))
      return Promise.reject(new Error("pi_actor_turn_already_open"));
    const bounded = {
      ...request,
      deadlineAtMs: Math.min(
        request.deadlineAtMs ?? Infinity,
        Date.now() + (this.options.turnTimeoutMs ?? 45_000),
      ),
    };
    inheritRequestAlias(request, bounded);
    const controller = new AbortController();
    this.controllers.set(request.actorId, controller);
    const timer = setTimeout(
      () => controller.abort(new Error("request_deadline_elapsed")),
      Math.max(0, bounded.deadlineAtMs - Date.now()),
    );
    // 先登记，再执行任何用户回调，保证重入 close 可看见这份资源。
    const task = Promise.resolve().then(() => this.runTurn(bounded, controller.signal));
    this.pending.add(task);
    const cleanup = () => {
      clearTimeout(timer);
      this.controllers.delete(request.actorId);
      this.pending.delete(task);
    };
    return task.then(
      (value) => {
        cleanup();
        return value;
      },
      (error) => {
        cleanup();
        throw error;
      },
    );
  }

  private async sessionFor(request: ActionRequest, signal: AbortSignal): Promise<PlayerSession> {
    const existing = this.sessions.get(request.actorId);
    if (existing) return existing;
    const creating = Promise.resolve().then(async () => {
      signal.throwIfAborted();
      const prompts = new PiPromptState(this.policy, request);
      const session = await this.options.runtime.createSession({
        settings: this.options.settingsResolver(request.actorId),
        systemPrompt: prompts.systemPrompt,
        tools: gameToolProtocol(this.world.locale).specs,
      });
      if (this.closed || signal.aborted) {
        await session.close();
        throw signal.reason ?? this.closeController.signal.reason;
      }
      const owned = { session, prompts };
      this.sessions.set(request.actorId, owned);
      return owned;
    });
    this.creating.add(creating);
    void creating.then(
      () => this.creating.delete(creating),
      (error) => {
        this.creating.delete(creating);
        if (
          signal.aborted &&
          error !== signal.reason &&
          error !== this.closeController.signal.reason
        )
          this.cleanupFailures.push(error);
      },
    );
    // 创建本身不访问模型网络；中止后仍等实际创建／迟到关闭，租约不能在此提前移交。
    return creating;
  }

  private async runTurn(request: ActionRequest, signal: AbortSignal): Promise<ToolCall | null> {
    let release: (() => void) | undefined;
    let owned: PlayerSession | undefined;
    let prompt: BuiltPlayerPrompt | undefined;
    let turn: ActionTurn | undefined;
    let primary: unknown;
    let failed = false;
    let protocolRejected = false;
    const traces: Array<{ input: string; trace: PiPromptResult<ToolCall> }> = [];
    const cleanupErrors: unknown[] = [];
    const finishingErrors: unknown[] = [];
    const calls: PlayerRoundOutcome["toolCalls"] = [];
    const presenter = new PiConsolePresenter(
      request.actorId,
      this.options.printLlmIo ?? false,
      this.options.printThinking ?? false,
      this.options.displayLocale ?? this.world.locale,
    );
    // 取消先封行动窗口；底层 Pi 也接收同一 signal，但是否完成回收由其实际 settlement 确认。
    const revoke = () => turn?.close();
    signal.addEventListener("abort", revoke, { once: true });
    try {
      release = await this.scheduler.acquire(request, undefined, signal);
      owned = await this.sessionFor(request, signal);
      signal.throwIfAborted();
      prompt = owned.prompts.build(request);
      turn = new ActionTurn(this.reception, request, prompt.turnId);
      for (let attempt = 0; attempt < 3; attempt++) {
        const input =
          attempt === 0
            ? prompt.userPrompt
            : buildConstraintRetryPrompt(attempt, 3, this.world.locale);
        let attempted = false;
        try {
          this.observer.prompt(
            [
              ...(prompt.isInitialRound && attempt === 0
                ? [{ role: "system" as const, content: prompt.systemPrompt }]
                : []),
              { role: "user", content: input },
            ],
            request,
          );
          attempted = true;
          await owned.session.prompt<ToolCall>(input, {
            signal,
            maxSteps: 8,
            onEvent: (event) => presenter.update(event),
            onToolCall: async (invocation) => {
              const handled = this.handleTool(request, turn!, invocation, signal);
              const receipt =
                typeof handled.toolResult === "object" ? handled.toolResult : undefined;
              if (invocation.name === "submit_action" && receipt && "ok" in receipt && !receipt.ok)
                protocolRejected = true;
              calls.push({
                id: invocation.id,
                name: invocation.name,
                args: invocation.args,
                accepted:
                  !!receipt &&
                  "ok" in receipt &&
                  receipt.ok === true &&
                  "accepted" in receipt &&
                  receipt.accepted === true,
                result: handled.toolResult,
              });
              return handled;
            },
            onInvalidToolCall: (invocation) => {
              if (signal.aborted) return;
              protocolRejected = true;
              if (invocation.name !== "submit_action") return;
              const receipt = turn!.rejectSubmissionInput(invocation.args.turn_id);
              calls.push({
                id: invocation.id,
                name: invocation.name,
                args: invocation.args,
                accepted: false,
                result: receipt,
              });
              return { stop: !!turn!.outcome.failureCode };
            },
          });
        } finally {
          // prompt 的失败也保留真实前缀；不依赖是否显示思考，不把上一次历史重复写入本轮。
          if (attempted) traces.push({ input, trace: owned.session.takeTrace<ToolCall>() });
        }
        signal.throwIfAborted();
        if (
          turn.action ||
          turn.outcome.failureCode ||
          (resolveTurnConstraints(request).minValidActions === 0 &&
            !protocolRejected &&
            turn.outcome.rejectedActions === 0)
        )
          break;
      }
    } catch (error) {
      primary = error;
      failed = true;
    } finally {
      turn?.close();
      signal.removeEventListener("abort", revoke);
      try {
        presenter.flush();
      } catch (error) {
        primary = failed
          ? new AggregateError([primary, error], "pi_turn_and_display_failed")
          : error;
        failed = true;
      }
    }
    try {
      const expired = signal.aborted || (request.deadlineAtMs ?? Infinity) <= Date.now();
      if (expired && !failed) {
        primary = signal.reason ?? new Error("request_deadline_elapsed");
        failed = true;
      }
      if (failed && owned) {
        this.sessions.delete(request.actorId);
        try {
          await owned.session.close();
        } catch (error) {
          this.cleanupFailures.push(error);
          cleanupErrors.push(error);
        }
      }
      const candidate = !failed && !expired && !this.closed ? (turn?.action ?? null) : null;
      let action = candidate;
      const needsFallback =
        failed ||
        expired ||
        (!candidate &&
          (resolveTurnConstraints(request).minValidActions > 0 ||
            protocolRejected ||
            (turn?.outcome.rejectedActions ?? 0) > 0));
      let fallbackReason: string | undefined;
      if (needsFallback && !this.closed) {
        fallbackReason = expired
          ? "deadline_skip"
          : failed
            ? "runtime_error"
            : (turn?.outcome.failureCode ?? "model_declined_required_action");
        if (!cleanupErrors.length && allowsActionFallback(request)) {
          try {
            action = await awaitBeforeDeadline(
              () => this.fallback.getAction(request),
              request.deadlineAtMs,
              this.closeController.signal,
            );
          } catch (error) {
            if (this.closed || !signal.aborted) finishingErrors.push(error);
          }
        }
        try {
          console.log(
            `[PI_FALLBACK] player=${request.actorId} phase=${request.phase} reason=${fallbackReason} fallback=${action ? `${action.name} ${JSON.stringify(action.args)}` : "none"} · ${text(this.observer.locale, "runtime.fallback")}`,
          );
        } catch (displayError) {
          if (displayError !== primary) finishingErrors.push(displayError);
        }
        safeRecordLogicOp({
          scope: "llm_action_provider",
          op: "pi_fallback",
          actorId: request.actorId,
          phase: request.phase,
          status: action ? "fallback" : "error",
          reason: fallbackReason,
        });
      }
      prompt ??=
        owned?.prompts.build(request) ?? new PiPromptState(this.policy, request).build(request);
      const deltaMessages = this.recordMessages(traces, calls);
      deltaMessages.push({
        role: "meta",
        kind: "action_summary",
        content: JSON.stringify({
          action_mode: action ? "tool_call" : "none",
          final_action: action,
        }),
      });
      if (failed)
        deltaMessages.push({
          role: "meta",
          kind: "request_error",
          diagnostic: describeError(primary),
        });
      if (fallbackReason)
        deltaMessages.push({ role: "meta", kind: "fallback", content: fallbackReason });
      try {
        this.recorder.record(request, prompt, {
          actionMode: action ? "tool_call" : "none",
          toolCalls: calls,
          finalAction: action,
          deltaMessages,
          thinkingText: traces
            .map(({ trace }) => trace.thinkingText)
            .filter(Boolean)
            .join("\n"),
          ...(fallbackReason
            ? {
                fallback: {
                  used: !cleanupErrors.length && allowsActionFallback(request),
                  reason: fallbackReason,
                  ...(action ? { action: { name: action.name, args: action.args } } : {}),
                },
              }
            : {}),
        });
      } catch (recordingError) {
        if (failed || cleanupErrors.length || finishingErrors.length)
          throw new AggregateError(
            [...(failed ? [primary] : []), ...cleanupErrors, ...finishingErrors, recordingError],
            "pi_turn_recording_failed",
          );
        throw recordingError;
      }
      // 录制保留实际失败前缀；清理错误随后与主错误一起交还调用方，禁止继续复用不确定资源。
      if (cleanupErrors.length || finishingErrors.length)
        throw new AggregateError(
          [...(failed ? [primary] : []), ...cleanupErrors, ...finishingErrors],
          "pi_turn_and_cleanup_failed",
        );
      if (this.closed) return this.closedResult(request);
      if (
        request.context.action_failure_policy === "error" &&
        ((!action && needsFallback) || expired)
      )
        throw new Error("action_turn_failed", failed ? { cause: primary } : undefined);
      return action;
    } finally {
      release?.();
    }
  }

  private handleTool(
    request: ActionRequest,
    turn: ActionTurn,
    invocation: ToolInvocation,
    signal: AbortSignal,
  ) {
    const refusal =
      this.closed || signal.aborted
        ? toolFailure(this.world.locale, "turn_not_open_or_session_invalid")
        : turn.authorize(invocation.args.turn_id, invocation.name);
    if (invocation.name === "get_game_schema" && !this.closed && !signal.aborted)
      return { toolResult: gameToolProtocol(this.world.locale).schema };
    if (refusal) return { toolResult: refusal, stop: !!turn.outcome.failureCode };
    if (invocation.name === "report_bug")
      return {
        toolResult: this.bugs.report({
          actorId: request.actorId,
          day: getActionRequestDay(request),
          phase: String(request.phase),
          stage: getActionRequestStage(request),
          category: invocation.args.category,
          severity: invocation.args.severity,
          message: invocation.args.message,
        }),
      };
    if (invocation.name !== "submit_action")
      return { toolResult: toolFailure(this.world.locale, "invalid_submit_action_arguments") };
    const receipt = turn.submit(
      invocation.args.turn_id,
      invocation.args.action,
      invocation.args.arguments,
    );
    return {
      toolResult: receipt,
      ...(receipt.ok
        ? { finalAction: turn.action!, stop: true }
        : { stop: !!turn.outcome.failureCode }),
    };
  }

  private recordMessages(
    traces: Array<{ input: string; trace: PiPromptResult<ToolCall> }>,
    calls: PlayerRoundOutcome["toolCalls"],
  ): ReplayPlayerDeltaMessage[] {
    const messages: ReplayPlayerDeltaMessage[] = [];
    const add = (
      role: "user" | "assistant",
      kind: "prompt" | "retry_prompt" | "assistant_output",
      content: string,
      name?: string,
    ) => {
      // 沿用既有8000字符单项上限，长块切分而不截掉尾部；原Pi transcript不经过此展示编码。
      for (let offset = 0; offset < content.length;) {
        let end = Math.min(offset + 8000, content.length);
        if (end < content.length && /[\uD800-\uDBFF]/.test(content[end - 1]!)) end--;
        messages.push({
          role,
          kind,
          content: content.slice(offset, end),
          ...(name ? { name } : {}),
        });
        offset = end;
      }
    };
    for (const [attempt, { input, trace }] of traces.entries()) {
      add("user", attempt === 0 ? "prompt" : "retry_prompt", input);
      if (trace.thinkingText) add("assistant", "assistant_output", trace.thinkingText, "thinking");
      if (trace.assistantText) add("assistant", "assistant_output", trace.assistantText, "message");
    }
    for (const call of calls) {
      messages.push({
        role: "assistant",
        kind: "tool_call",
        name: call.name,
        args: call.args,
        accepted: call.accepted,
      });
      messages.push({ role: "tool", kind: "tool_result", name: call.name, result: call.result });
    }
    return messages;
  }

  private closedResult(request: ActionRequest): null {
    if (request.context.action_failure_policy === "error") throw this.closeController.signal.reason;
    return null;
  }
  close(): Promise<void> {
    if (this.closing) return this.closing;
    this.closed = true;
    this.closeController.abort(new DOMException("pi_provider_closed", "AbortError"));
    this.scheduler.close(this.closeController.signal.reason);
    for (const controller of this.controllers.values())
      controller.abort(this.closeController.signal.reason);
    this.closing = (async () => {
      const closingRuntime = this.options.runtime.close();
      const settled = await Promise.allSettled([...this.pending, ...this.creating, closingRuntime]);
      this.sessions.clear();
      const failures = [
        ...this.cleanupFailures,
        ...settled.flatMap((item) =>
          item.status === "rejected" && item.reason !== this.closeController.signal.reason
            ? [item.reason]
            : [],
        ),
      ];
      if (failures.length) throw new AggregateError(failures, "pi_provider_close_failed");
    })();
    return this.closing;
  }
}
