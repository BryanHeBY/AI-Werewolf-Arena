import { RoleComponent } from "../../../core/domain/components/role";
import { ActionProvider, ActionRequest, BoardConfig, ToolCall } from "../../../core/domain/model";
import { World } from "../../../core/domain/world";
import {
  getDefaultConfigRenderRegistry,
  getDefaultPhaseStageLocalizationRegistry,
  getDefaultRolePromptRegistry,
  getDefaultTargetHintRegistry,
  getDefaultToolSpecRegistry,
} from "../../../game/mechanisms";
import { safeRecordLogicOp } from "../../../observability";
import {
  AcpSession,
  AcpSessionAuditTrace,
  AcpSessionFactory,
} from "../../integrations/acp/acp_process_client";
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
import { BuiltPlayerPrompt, PlayerRoundOutcome } from "../llm/model_client";
import { PlayerPromptPolicy } from "../llm/player_prompt_policy";
import { PlayerRoundRecorder } from "../llm/player_round_recorder";

export interface AcpActionProviderOptions {
  fallbackProvider?: ActionProvider;
  sessionFactory?: AcpSessionFactory;
  sessionFactoryResolver?: (actorId: number) => AcpSessionFactory;
  boardConfig?: BoardConfig;
  personalityPromptResolver?: (request: ActionRequest, role?: RoleComponent) => string | undefined;
  turnTimeoutMs?: number;
  onBugReport?: (report: AcpBugReport) => void;
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
  requestError?: string;
}

/**
 * 将 ACP Agent 适配为游戏 ActionProvider。
 *
 * Agent 的文本与 ACP update 仅用于可观测；只有注入的 werewolf-game MCP
 * server 的 submit_action tool 才会被返回给游戏引擎。
 */
export class AcpActionProvider implements ActionProvider {
  private readonly registry: AcpTurnRegistry;
  private readonly sessions = new Map<number, Promise<AcpSession>>();
  private readonly fallbackProvider: ActionProvider;
  private readonly eventCursor = new Map<number, number>();
  private readonly sessionPromptByActor = new Map<number, string>();
  private readonly bugReportService: AgentBugReportService;
  private readonly promptPolicy: PlayerPromptPolicy;
  private readonly roundRecorder: PlayerRoundRecorder;

  constructor(
    world: World,
    private readonly options: AcpActionProviderOptions,
  ) {
    this.fallbackProvider = options.fallbackProvider ?? new BaselineBotActionProvider(world);
    this.bugReportService = new AgentBugReportService(world);
    this.registry = new AcpTurnRegistry((report) => this.handleBugReport(report));
    const localization = getDefaultPhaseStageLocalizationRegistry();
    this.promptPolicy = new PlayerPromptPolicy(world, {
      personalityPromptResolver: options.personalityPromptResolver,
      toolSpecRegistry: getDefaultToolSpecRegistry(),
      rolePromptRegistry: getDefaultRolePromptRegistry(),
      targetHintRegistry: getDefaultTargetHintRegistry(),
      phaseStageLocalizationRegistry: localization,
      configRenderRegistry: getDefaultConfigRenderRegistry(),
      boardConfig: options.boardConfig,
    });
    this.roundRecorder = new PlayerRoundRecorder(world, localization);
  }

  async getAction(request: ActionRequest): Promise<ToolCall | null> {
    const startedAt = Date.now();
    let session: AcpSession | undefined;
    let turn: ReturnType<AcpTurnRegistry["openTurn"]> | undefined;
    let built: AcpTurnPromptBuild | undefined;
    let auditTrace: AcpSessionAuditTrace | undefined;
    let fallbackReason = "model_declined_required_action";
    let requestError: string | undefined;
    try {
      session = await this.getOrCreateSession(request);
      turn = this.registry.openTurn(request, session.sessionId);
      built = this.buildTurnPrompt(request, turn.turnId, true);
      const promptTask = session.prompt(built.prompt);
      const outcome = await this.waitForAction(turn.action, promptTask, request);
      this.registry.closeTurn(turn.sessionId);
      await session.cancel().catch(() => undefined);
      // ACP Agent 理论上应在 cancel 后结束 prompt；不让失效 Agent 的违反协议
      // 响应无限阻塞游戏阶段，下一回合仍由独立 turn_id 防止旧动作生效。
      await Promise.race([
        promptTask.catch(() => undefined),
        new Promise<void>((resolve) => setTimeout(resolve, 1000)),
      ]);
      auditTrace = session.takeAuditTrace?.();
      if (outcome.action) {
        this.recordPlayerRound(request, built, {
          action: outcome.action,
          auditTrace,
          elapsedMs: Date.now() - startedAt,
        });
        return outcome.action;
      }
      fallbackReason = outcome.reason ?? fallbackReason;
      requestError = outcome.requestError;
    } catch (error) {
      fallbackReason = "runtime_error";
      requestError = String(error);
      safeRecordLogicOp({
        scope: "llm_action_provider",
        op: "action_provider_error",
        actorId: request.actorId,
        phase: request.phase,
        status: "fallback",
        reason: requestError,
      });
    } finally {
      if (turn) {
        this.registry.closeTurn(turn.sessionId);
      }
    }
    built ??= this.buildTurnPrompt(request, turn?.turnId ?? "unopened", false);
    auditTrace ??= session?.takeAuditTrace?.();
    const fallback = await this.fallbackProvider.getAction(request);
    this.recordPlayerRound(request, built, {
      action: fallback,
      auditTrace,
      elapsedMs: Date.now() - startedAt,
      fallbackReason,
      requestError,
    });
    return fallback;
  }

  async close(): Promise<void> {
    const sessions = [...this.sessions.values()];
    this.sessions.clear();
    await Promise.allSettled(sessions.map(async (promise) => (await promise).close()));
    this.registry.close();
  }

  private async getOrCreateSession(request: ActionRequest): Promise<AcpSession> {
    const existing = this.sessions.get(request.actorId);
    if (existing) {
      return existing;
    }
    const factory = this.options.sessionFactoryResolver?.(request.actorId) ?? this.options.sessionFactory;
    if (!factory) {
      throw new Error("acp_session_factory_missing");
    }
    const initialPrompt = this.buildSessionPrompt(request);
    this.sessionPromptByActor.set(request.actorId, initialPrompt);
    const created = factory.createSession({
      actorId: request.actorId,
      registry: this.registry,
      initialPrompt,
    });
    this.sessions.set(request.actorId, created);
    try {
      return await created;
    } catch (error) {
      this.sessions.delete(request.actorId);
      throw error;
    }
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
    return Promise.race([
      action.then((value) => ({ action: value })),
      // A completed Agent turn that did not invoke submit_action cannot still
      // produce a valid action. Fall back now instead of waiting for the full
      // LLM timeout (often minutes for ACP agents).
      promptTask.then(
        (): AcpTurnOutcome => ({ action: null, reason: "model_declined_required_action" }),
        (error): AcpTurnOutcome => ({
          action: null,
          reason: "runtime_error",
          requestError: String(error),
        }),
      ),
      new Promise<AcpTurnOutcome>((resolve) =>
        setTimeout(() => resolve({ action: null, reason: "request_timeout" }), timeoutMs),
      ),
    ]);
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
      lines.push(`新增可见事件：${encodePlayerVisibleEventBatch(delta)}`);
    }
    lines.push(`当前回合 ID：${turnId}`);
    const userPrompt = this.promptPolicy.buildUser(request, {
      turnId,
      allowedTools: request.allowedTools,
      actionSubmissionHint: [
        "本运行环境中不要直接调用上面列出的动作名。",
        "请调用 MCP 服务 werewolf-game 的 submit_action，",
        `参数 turn_id 必须为 ${turnId}，action 必须是本轮列出的动作名，arguments 填该动作的参数。`,
        "若发现明确的规则、状态、流程、日志或可见性矛盾，可先调用 report_bug，再正常提交行动。",
        "无需查询 get_game_schema；普通文本不会产生游戏效果。",
      ].join(""),
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
      requestError?: string;
    },
  ): void {
    const systemPrompt =
      this.sessionPromptByActor.get(request.actorId) ?? this.buildSessionPrompt(request);
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
        ? { retryTrace: [{ attempt: 0, status: "request_error", reason: input.requestError }] }
        : {}),
      ...(input.fallbackReason
        ? {
            fallback: {
              used: true,
              reason: input.fallbackReason,
              ...(input.action
                ? { action: { name: input.action.name, args: actionArgs ?? {} } }
                : {}),
            },
          }
        : {}),
    };
    this.roundRecorder.record(request, prompt, outcome);
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
