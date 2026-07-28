import { COMPONENT } from "../../../core/domain/components/names";
import { RoleComponent } from "../../../core/domain/components/role";
import { ActionProvider, ActionRequest, BoardConfig, Camp, Role, ToolCall, ToolName } from "../../../core/domain/model";
import { World } from "../../../core/domain/world";
import {
  getDefaultConfigRenderRegistry,
  getDefaultPhaseStageLocalizationRegistry,
  getDefaultRolePromptRegistry,
  getDefaultTargetHintRegistry,
  getDefaultToolSpecRegistry,
} from "../../../game/mechanisms";
import { getIdiotState } from "../../../game/mechanisms/roles/private_state";
import { safeRecordLogicOp } from "../../../observability";
import { AcpSession, AcpSessionFactory } from "../../integrations/acp/acp_process_client";
import { AcpBugReport, AcpTurnRegistry } from "../../integrations/acp/acp_turn_registry";
import { BaselineBotActionProvider } from "../providers/action_providers";
import { buildBoardInfoPrompt, buildSystemPrompt, buildUserPrompt } from "../llm/prompt_templates";
import { renderTurnConstraintUserHint, resolveTurnConstraints } from "../llm/turn_constraints";

export interface AcpActionProviderOptions {
  fallbackProvider?: ActionProvider;
  sessionFactory?: AcpSessionFactory;
  sessionFactoryResolver?: (actorId: number) => AcpSessionFactory;
  boardConfig?: BoardConfig;
  personalityPromptResolver?: (request: ActionRequest, role?: RoleComponent) => string | undefined;
  turnTimeoutMs?: number;
  onBugReport?: (report: AcpBugReport) => void;
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
  private readonly feedCursor = new Map<number, number>();
  private readonly toolSpecRegistry = getDefaultToolSpecRegistry();
  private readonly rolePromptRegistry = getDefaultRolePromptRegistry();
  private readonly targetHintRegistry = getDefaultTargetHintRegistry();
  private readonly phaseStageLocalizationRegistry = getDefaultPhaseStageLocalizationRegistry();
  private readonly configRenderRegistry = getDefaultConfigRenderRegistry();

  constructor(
    private readonly world: World,
    private readonly options: AcpActionProviderOptions,
  ) {
    this.fallbackProvider = options.fallbackProvider ?? new BaselineBotActionProvider(world);
    this.registry = new AcpTurnRegistry((report) => {
      safeRecordLogicOp({
        scope: "llm_action_provider",
        op: "report_bug_recorded",
        actorId: report.actorId,
        status: "ok",
        input: { ...report },
      });
      options.onBugReport?.(report);
    });
  }

  async getAction(request: ActionRequest): Promise<ToolCall | null> {
    let session: AcpSession | undefined;
    let turn: ReturnType<AcpTurnRegistry["openTurn"]> | undefined;
    try {
      session = await this.getOrCreateSession(request);
      turn = this.registry.openTurn(request, session.sessionId);
      const promptTask = session.prompt(this.buildTurnPrompt(request, turn.turnId));
      const action = await this.waitForAction(turn.action, promptTask, request);
      this.registry.closeTurn(turn.sessionId);
      await session.cancel().catch(() => undefined);
      // ACP Agent 理论上应在 cancel 后结束 prompt；不让失效 Agent 的违反协议
      // 响应无限阻塞游戏阶段，下一回合仍由独立 turn_id 防止旧动作生效。
      await Promise.race([
        promptTask.catch(() => undefined),
        new Promise<void>((resolve) => setTimeout(resolve, 1000)),
      ]);
      if (action) {
        return action;
      }
    } catch (error) {
      safeRecordLogicOp({
        scope: "llm_action_provider",
        op: "action_provider_error",
        actorId: request.actorId,
        phase: request.phase,
        status: "fallback",
        reason: String(error),
      });
    } finally {
      if (turn) {
        this.registry.closeTurn(turn.sessionId);
      }
    }
    return this.fallbackProvider.getAction(request);
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
    const created = factory.createSession({
      actorId: request.actorId,
      registry: this.registry,
      initialPrompt: this.buildSessionPrompt(request),
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
  ): Promise<ToolCall | null> {
    const timeoutMs = this.resolveTimeoutMs(request);
    if (timeoutMs <= 0) {
      return null;
    }
    return Promise.race([
      action,
      // A completed Agent turn that did not invoke submit_action cannot still
      // produce a valid action. Fall back now instead of waiting for the full
      // LLM timeout (often minutes for ACP agents).
      promptTask.then(() => null, () => null),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
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
    const role = this.world.getComponent<RoleComponent>(request.actorId, COMPONENT.Role);
    const teammateIds = role?.camp === Camp.Wolf
      ? this.world.getAliveEntityIds().filter((id) => {
          const other = this.world.getComponent<RoleComponent>(id, COMPONENT.Role);
          return id !== request.actorId && other?.camp === Camp.Wolf;
        }).sort((a, b) => a - b)
      : [];
    return buildSystemPrompt({
      actorId: request.actorId,
      role: role?.role ?? "unknown",
      maxPlayerId: this.world.entityIds().length,
      teammateIds,
      boardInfoPrompt: this.buildBoardInfoPrompt(),
      configPrompt: this.options.boardConfig
        ? this.configRenderRegistry.renderBoardConfigPrompt(this.options.boardConfig)
        : undefined,
      personalityPrompt: this.options.personalityPromptResolver?.(request, role),
      supportsDebugReporting: true,
      // ACP 的实际工具仅在每个回合打开后才有 turn_id；初始化时不让 Agent
      // 为不存在的直接函数工具做无谓搜索。
      includeToolUseInstructions: false,
    });
  }

  /** 回合提示遵循既有阶段规则、目标提示与可见事件增量结构。 */
  private buildTurnPrompt(request: ActionRequest, turnId: string): string {
    const role = this.world.getComponent<RoleComponent>(request.actorId, COMPONENT.Role);
    const lines: string[] = [];
    const feed = Array.isArray(request.context.broadcast_feed)
      ? request.context.broadcast_feed.map(String)
      : [];
    const cursor = this.feedCursor.get(request.actorId) ?? 0;
    const delta = feed.slice(cursor);
    this.feedCursor.set(request.actorId, feed.length);
    if (delta.length) {
      lines.push("自上次回合后你可见的事件：", ...delta);
    }
    const constraints = resolveTurnConstraints(request);
    const stage = String(request.context.phase ?? request.actionWindow ?? request.context.window ?? request.phase);
    const allowedTools = request.allowedTools as ToolName[];
    lines.push(`当前回合 ID：${turnId}`);
    lines.push(buildUserPrompt({
      actorId: request.actorId,
      phase: this.phaseStageLocalizationRegistry.phaseName(String(request.phase)),
      stage: this.phaseStageLocalizationRegistry.stageName(stage),
      isSpeechTurn: allowedTools.includes("speak") || allowedTools.includes("speak_to_wolves"),
      stageDirective: this.toolSpecRegistry.getStageDirective(allowedTools) ?? "请严格区分当前阶段职责，只执行本轮工具对应动作。",
      statusDirective: this.statusDirective(request.actorId, role),
      requiresAction: constraints.minValidActions > 0,
      turnConstraintHint: renderTurnConstraintUserHint(constraints),
      allowedTools,
      effectiveActionTools: allowedTools,
      toolArgHints: `工具参数提示=${allowedTools.map((tool) => this.toolSpecRegistry.getArgHint(tool)).filter(Boolean).join("; ")}`,
      toolUsageHints: this.toolSpecRegistry.getApplicableUserPromptHints(allowedTools),
      actionableIdsHint: this.targetHintRegistry.buildActionableIdsHint({
        actorId: request.actorId,
        actorRole: role?.role,
        allowedTools,
        world: this.world,
      }),
      stageContextHint: this.stageContextHint(request),
      actionSubmissionHint: [
        "本运行环境中不要直接调用上面列出的动作名。",
        "请调用 MCP 服务 werewolf-game 的 submit_action，",
        `参数 turn_id 必须为 ${turnId}，action 必须是本轮列出的动作名，arguments 填该动作的参数。`,
        "若发现明确的规则、状态、流程、日志或可见性矛盾，可先调用 report_bug，再正常提交行动。",
        "无需查询 get_game_schema；普通文本不会产生游戏效果。",
      ].join(""),
    }));
    return lines.filter(Boolean).join("\n");
  }

  private buildBoardInfoPrompt(): string {
    const roleCounts = new Map<Role, number>();
    for (const id of this.world.entityIds()) {
      const role = this.world.getComponent<RoleComponent>(id, COMPONENT.Role)?.role;
      if (role) roleCounts.set(role, (roleCounts.get(role) ?? 0) + 1);
    }
    return buildBoardInfoPrompt({
      totalPlayers: this.world.entityIds().length,
      roleCounts,
      roleLabel: (role) => this.rolePromptRegistry.label(role),
      roleSkillBrief: (role) => this.rolePromptRegistry.skillBrief(role),
    });
  }

  private stageContextHint(request: ActionRequest): string | undefined {
    const stage = String(request.context.phase ?? request.actionWindow ?? request.context.window ?? "");
    if (stage !== "witch") return undefined;
    if (typeof request.context.wolf_target === "number") return `当前已知昨夜刀口是${request.context.wolf_target}号。`;
    if (request.context.wolf_target === null) return "当前已知昨夜刀口为空（可能空刀或平票）。";
    return "当前未获得明确刀口信息。";
  }

  private statusDirective(actorId: number, role?: RoleComponent): string | undefined {
    const lines = role?.renderPrompt?.().trim() ? [`你的私有状态：${role.renderPrompt().trim()}`] : [];
    if (role?.role === Role.Idiot && getIdiotState(role)?.revealed) {
      lines.push("状态提醒：你已在先前放逐中翻牌为白痴并存活，当前仍在场上发言；你已失去投票权。");
    }
    return lines.length ? lines.join(" ") : undefined;
  }
}
