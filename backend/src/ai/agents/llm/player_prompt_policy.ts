import { COMPONENT } from "../../../core/domain/components/names";
import { RoleComponent } from "../../../core/domain/components/role";
import { ActionRequest, BoardConfig, Camp, EntityId, Role, ToolName } from "../../../core/domain/model";
import { World } from "../../../core/domain/world";
import {
  ConfigRenderRegistry,
  PhaseStageLocalizationRegistry,
  RolePromptRegistry,
  TargetHintRegistry,
  ToolSpecRegistry,
} from "../../../game/mechanisms";
import { getIdiotState } from "../../../game/mechanisms/roles/private_state";
import { buildBoardInfoPrompt, buildSystemPrompt, buildUserPrompt } from "./prompt_templates";
import { renderTurnConstraintUserHint, resolveTurnConstraints } from "./turn_constraints";

export interface PlayerPromptPolicyOptions {
  personalityPromptResolver?: (request: ActionRequest, role?: RoleComponent) => string | undefined;
  toolSpecRegistry: ToolSpecRegistry;
  rolePromptRegistry: RolePromptRegistry;
  targetHintRegistry: TargetHintRegistry;
  phaseStageLocalizationRegistry: PhaseStageLocalizationRegistry;
  configRenderRegistry: ConfigRenderRegistry;
  boardConfig?: BoardConfig;
}

/** Shared game prompt policy; SDK and ACP adapters only choose transport instructions. */
export class PlayerPromptPolicy {
  constructor(
    private readonly world: World,
    private readonly options: PlayerPromptPolicyOptions,
  ) {}

  buildSystem(
    request: ActionRequest,
    options: { supportsDebugReporting: boolean; includeToolUseInstructions?: boolean },
  ) {
    const role = this.role(request.actorId);
    const boardInfoPrompt = this.buildBoardInfo();
    const configPrompt = this.options.boardConfig
      ? this.options.configRenderRegistry.renderBoardConfigPrompt(this.options.boardConfig)
      : undefined;
    return {
      systemPrompt: buildSystemPrompt({
        actorId: request.actorId,
        role: role?.role ?? "unknown",
        maxPlayerId: this.world.entityIds().length,
        teammateIds: this.wolfTeammates(request.actorId, role),
        boardInfoPrompt,
        configPrompt,
        personalityPrompt: this.options.personalityPromptResolver?.(request, role),
        supportsDebugReporting: options.supportsDebugReporting,
        includeToolUseInstructions: options.includeToolUseInstructions,
      }),
      boardInfoPrompt,
      configPrompt,
    };
  }

  buildUser(
    request: ActionRequest,
    input: {
      turnId: string;
      allowedTools: ToolName[];
      effectiveActionTools?: ToolName[];
      actionSubmissionHint: string;
    },
  ): string {
    const role = this.role(request.actorId);
    const constraints = resolveTurnConstraints(request);
    const stage = String(
      request.context.phase ?? request.actionWindow ?? request.context.window ?? request.phase,
    );
    return buildUserPrompt({
      actorId: request.actorId,
      phase: this.options.phaseStageLocalizationRegistry.phaseName(String(request.phase)),
      stage: this.options.phaseStageLocalizationRegistry.stageName(stage),
      isSpeechTurn: input.allowedTools.includes("speak") || input.allowedTools.includes("speak_to_wolves"),
      stageDirective: this.options.toolSpecRegistry.getStageDirective(request.allowedTools) ??
        "请严格区分当前阶段职责，只执行本轮工具对应动作。",
      statusDirective: this.statusDirective(role),
      requiresAction: constraints.minValidActions > 0,
      turnConstraintHint: renderTurnConstraintUserHint(constraints),
      allowedTools: input.allowedTools,
      effectiveActionTools: input.effectiveActionTools ?? input.allowedTools,
      toolArgHints: this.toolArgHints(input.allowedTools),
      toolUsageHints: this.options.toolSpecRegistry.getApplicableUserPromptHints(input.allowedTools),
      stageContextHint: this.stageContextHint(request),
      actionableIdsHint: this.options.targetHintRegistry.buildActionableIdsHint({
        actorId: request.actorId,
        actorRole: role?.role,
        allowedTools: input.allowedTools,
        world: this.world,
      }),
      actionSubmissionHint: input.actionSubmissionHint,
    });
  }

  buildBoardInfo(): string {
    const counts = new Map<Role, number>();
    for (const id of this.world.entityIds()) {
      const role = this.role(id);
      if (role) counts.set(role.role, (counts.get(role.role) ?? 0) + 1);
    }
    return buildBoardInfoPrompt({
      totalPlayers: this.world.entityIds().length,
      roleCounts: counts,
      roleLabel: (role) => this.options.rolePromptRegistry.label(role),
      roleSkillBrief: (role) => this.options.rolePromptRegistry.skillBrief(role),
    });
  }

  private role(actorId: EntityId): RoleComponent | undefined {
    return this.world.getComponent<RoleComponent>(actorId, COMPONENT.Role);
  }

  private wolfTeammates(actorId: EntityId, role?: RoleComponent): EntityId[] {
    if (role?.camp !== Camp.Wolf) return [];
    return this.world.getAliveEntityIds()
      .filter((id) => id !== actorId && this.role(id)?.camp === Camp.Wolf)
      .sort((a, b) => a - b);
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

  private stageContextHint(request: ActionRequest): string | undefined {
    const stage = String(request.context.phase ?? request.actionWindow ?? request.context.window ?? "");
    if (stage !== "witch") {
      const onlySelfDestruct = stage === "on_pre_vote" && request.allowedTools.every(
        (tool) => tool === "self_destruct" || tool === "report_bug",
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

  private toolArgHints(allowedTools: ToolName[]): string {
    const hints = allowedTools
      .map((tool) => this.options.toolSpecRegistry.getArgHint(tool))
      .filter((hint): hint is string => Boolean(hint));
    return `工具参数提示=${hints.join("; ")}`;
  }
}
