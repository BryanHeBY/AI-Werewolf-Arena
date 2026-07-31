import { COMPONENT } from "../../../core/domain/components/names";
import { RoleComponent } from "../../../core/domain/components/role";
import {
  ActionRequest,
  BoardConfig,
  Camp,
  EntityId,
  PlayerVisibleEvent,
  Role,
  ToolName,
} from "../../../core/domain/model";
import { World } from "../../../core/domain/world";
import {
  ConfigRenderRegistry,
  PhaseStageLocalizationRegistry,
  RolePromptRegistry,
  TargetHintRegistry,
  ToolSpecRegistry,
} from "../../../game/mechanisms";
import { getIdiotState } from "../../../game/mechanisms/roles/private_state";
import { encodePlayerVisibleEvent, parsePlayerVisibleEvents } from "../visible_event_protocol";
import { BuiltPlayerPrompt, ChatMessage } from "./model_client";
import {
  buildBoardInfoPrompt,
  buildSystemPrompt,
  buildUserPrompt,
} from "./prompt_templates";
import {
  renderTurnConstraintUserHint,
  resolveTurnConstraints,
} from "./turn_constraints";

export interface PlayerPromptSessionOptions {
  maxPromptEvents: number;
  supportsNativeTools: boolean;
  personalityPromptResolver?: (request: ActionRequest, role?: RoleComponent) => string | undefined;
  toolSpecRegistry: ToolSpecRegistry;
  rolePromptRegistry: RolePromptRegistry;
  targetHintRegistry: TargetHintRegistry;
  phaseStageLocalizationRegistry: PhaseStageLocalizationRegistry;
  configRenderRegistry: ConfigRenderRegistry;
  boardConfig?: BoardConfig;
}

/**
 * Append-only player prompt session.
 * It is the sole owner of per-player visible history, cursors and stable system prompts.
 */
export class PlayerPromptSession {
  static readonly REPORT_BUG_TOOL: ToolName = "report_bug";

  private readonly histories = new Map<EntityId, ChatMessage[]>();
  private readonly eventCursors = new Map<EntityId, number>();
  private readonly toolTurnCounters = new Map<EntityId, number>();
  private readonly systemPrompts = new Map<EntityId, string>();

  constructor(
    private readonly world: World,
    private readonly options: PlayerPromptSessionOptions,
  ) {}

  build(request: ActionRequest): BuiltPlayerPrompt {
    const eventDelta = this.ingestVisibleEvents(request);
    const role = this.world.getComponent<RoleComponent>(request.actorId, COMPONENT.Role);
    const constraints = resolveTurnConstraints(request);
    const stageLabel = String(
      request.context.phase ?? request.actionWindow ?? request.context.window ?? request.phase,
    );
    const fullHistory = [...(this.histories.get(request.actorId) ?? [])];
    const contextWindow = this.selectHistoryWindow(fullHistory);
    const isInitialRound = !this.systemPrompts.has(request.actorId);
    const boardInfoPrompt = isInitialRound ? this.buildBoardInfoPrompt() : undefined;
    const configPrompt = isInitialRound && this.options.boardConfig
      ? this.options.configRenderRegistry.renderBoardConfigPrompt(this.options.boardConfig)
      : undefined;
    const allowedTools = this.buildAllowedTools(request.allowedTools);
    const turnNumber = (this.toolTurnCounters.get(request.actorId) ?? 0) + 1;
    this.toolTurnCounters.set(request.actorId, turnNumber);
    const turnId = `t${turnNumber}`;
    const actionTools = allowedTools.filter((tool) => tool !== PlayerPromptSession.REPORT_BUG_TOOL);
    const systemPrompt = this.systemPrompts.get(request.actorId) ?? buildSystemPrompt({
      actorId: request.actorId,
      role: role?.role ?? "unknown",
      maxPlayerId: this.world.entityIds().length,
      teammateIds: this.resolveWolfTeammates(request.actorId, role),
      boardInfoPrompt,
      configPrompt,
      personalityPrompt: this.options.personalityPromptResolver?.(request, role),
      supportsDebugReporting: allowedTools.includes(PlayerPromptSession.REPORT_BUG_TOOL),
    });
    if (!this.systemPrompts.has(request.actorId)) {
      this.systemPrompts.set(request.actorId, systemPrompt);
    }

    const userPrompt = buildUserPrompt({
      actorId: request.actorId,
      phase: this.options.phaseStageLocalizationRegistry.phaseName(String(request.phase)),
      stage: this.options.phaseStageLocalizationRegistry.stageName(stageLabel),
      isSpeechTurn: allowedTools.includes("speak") || allowedTools.includes("speak_to_wolves"),
      stageDirective: this.stageDirective(request),
      statusDirective: this.statusDirective(role),
      requiresAction: constraints.minValidActions > 0,
      turnConstraintHint: renderTurnConstraintUserHint(constraints),
      allowedTools,
      effectiveActionTools: actionTools,
      toolArgHints: this.toolArgHints(allowedTools),
      toolUsageHints: this.options.toolSpecRegistry.getApplicableUserPromptHints(allowedTools),
      stageContextHint: this.stageContextHint(request),
      actionableIdsHint: this.options.targetHintRegistry.buildActionableIdsHint({
        actorId: request.actorId,
        actorRole: role?.role,
        allowedTools,
        world: this.world,
      }),
      actionSubmissionHint: [
        "请通过 submit_action 提交游戏行动，",
        `turn_id 必须为 ${turnId}，action 必须是本轮列出的有效行动工具名，arguments 填该行动的参数。`,
        `可先调用 report_bug 上报明确矛盾，其 turn_id 同样必须为 ${turnId}；无需调用 get_game_schema。`,
      ].join(""),
    });
    const currentTurnUser: ChatMessage = { role: "user", content: userPrompt };
    this.append(request.actorId, currentTurnUser);

    return {
      messages: [{ role: "system", content: systemPrompt }, ...contextWindow.history, currentTurnUser],
      systemPrompt,
      userPrompt,
      ...(boardInfoPrompt ? { boardInfoPrompt } : {}),
      ...(configPrompt ? { configPrompt } : {}),
      isInitialRound,
      eventCursorBefore: eventDelta.cursorBefore,
      eventCursorAfter: eventDelta.cursorAfter,
      contextWindowStart: contextWindow.start,
      contextWindowEnd: contextWindow.end,
      contextWindowTotal: contextWindow.total,
      turnId,
    };
  }

  appendAssistant(actorId: EntityId, content: string): void {
    this.append(actorId, { role: "assistant", content });
  }

  private append(actorId: EntityId, message: ChatMessage): void {
    const history = this.histories.get(actorId) ?? [];
    history.push(message);
    this.histories.set(actorId, history);
  }

  private ingestVisibleEvents(request: ActionRequest): {
    delta: PlayerVisibleEvent[];
    cursorBefore: number;
    cursorAfter: number;
  } {
    const events = parsePlayerVisibleEvents(request.context.visible_events);
    const cursor = this.eventCursors.get(request.actorId) ?? 0;
    if (events.length === 0) return { delta: [], cursorBefore: cursor, cursorAfter: cursor };
    const delta = events.filter((event) => event.seq > cursor);
    for (const event of delta) {
      this.append(request.actorId, { role: "user", content: encodePlayerVisibleEvent(event) });
    }
    const nextCursor = events.reduce((max, event) => Math.max(max, event.seq), cursor);
    this.eventCursors.set(request.actorId, nextCursor);
    return { delta, cursorBefore: cursor, cursorAfter: nextCursor };
  }

  private selectHistoryWindow(fullHistory: ChatMessage[]) {
    const total = fullHistory.length;
    const start = Math.max(0, total - Math.max(1, this.options.maxPromptEvents * 6));
    return { start, end: total, total, history: fullHistory.slice(start) };
  }

  private resolveWolfTeammates(actorId: EntityId, role?: RoleComponent): EntityId[] {
    if (role?.camp !== Camp.Wolf) return [];
    return this.world.getAliveEntityIds()
      .filter((id) => id !== actorId)
      .filter((id) => this.world.getComponent<RoleComponent>(id, COMPONENT.Role)?.camp === role.camp)
      .sort((a, b) => a - b);
  }

  private buildAllowedTools(allowedTools: ToolName[]): ToolName[] {
    const tools = [...allowedTools];
    if (this.options.supportsNativeTools && !tools.includes(PlayerPromptSession.REPORT_BUG_TOOL)) {
      tools.push(PlayerPromptSession.REPORT_BUG_TOOL);
    }
    return tools;
  }

  private buildBoardInfoPrompt(): string {
    const counts = new Map<Role, number>();
    for (const id of this.world.entityIds()) {
      const role = this.world.getComponent<RoleComponent>(id, COMPONENT.Role);
      if (role) counts.set(role.role, (counts.get(role.role) ?? 0) + 1);
    }
    return buildBoardInfoPrompt({
      totalPlayers: this.world.entityIds().length,
      roleCounts: counts,
      roleLabel: (role) => this.options.rolePromptRegistry.label(role),
      roleSkillBrief: (role) => this.options.rolePromptRegistry.skillBrief(role),
    });
  }

  private stageDirective(request: ActionRequest): string {
    return this.options.toolSpecRegistry.getStageDirective(request.allowedTools) ??
      "请严格区分当前阶段职责，只执行本轮工具对应动作。";
  }

  private stageContextHint(request: ActionRequest): string | undefined {
    const stage = String(request.context.phase ?? request.actionWindow ?? request.context.window ?? "");
    if (stage !== "witch") {
      const onlySelfDestruct = stage === "on_pre_vote" && request.allowedTools.every(
        (tool) => tool === "self_destruct" || tool === PlayerPromptSession.REPORT_BUG_TOOL,
      );
      return onlySelfDestruct
        ? "当前为放逐前自爆窗口：唯一会改变局面的动作是 self_destruct；禁止发言、投票和其他行动。若选择不自爆，直接结束本次回复即可。report_bug 仅用于上报问题。"
        : undefined;
    }
    if (typeof request.context.wolf_target === "number") {
      return `当前已知昨夜刀口是${request.context.wolf_target}号。`;
    }
    return request.context.wolf_target === null
      ? "当前已知昨夜刀口为空（可能空刀或平票）。"
      : "当前未获得明确刀口信息。";
  }

  private statusDirective(role?: RoleComponent): string | undefined {
    const lines: string[] = [];
    const privateState = role?.renderPrompt?.().trim();
    if (privateState) lines.push(`你的私有状态：${privateState}`);
    if (role?.role === Role.Idiot && getIdiotState(role)?.revealed) {
      lines.push("状态提醒：你已在先前放逐中翻牌为白痴并存活，当前仍在场上发言；你已失去投票权。");
    }
    return lines.length ? lines.join(" ") : undefined;
  }

  private toolArgHints(allowedTools: ToolName[]): string {
    const hints = allowedTools
      .map((name) => this.options.toolSpecRegistry.getArgHint(name))
      .filter((item): item is string => Boolean(item));
    return `工具参数提示=${hints.join("; ")}`;
  }
}
