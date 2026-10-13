/**
 * 负责 SDK／ACP 共用系统／回合模板、人设、工具协议提示与公开开局配比缓存的组织。
 * 输入为原 World、请求与提示选项；输出为模板组合文本，机制状态／阶段说明交游戏观察 owner。
 * 查询 thunk 保留每次 World／语言／Catalog／板子 getter 时点，不提前调用人设或角色 renderer。
 * 构造时公开 Map／size 的原部分写入仍在此；初始身份配比是本批明确保留的唯一构造机制查询。
 * 候选仅作提示，不授予行动许可；本模块不提交资源、变更阶段或复制新的私有库存。
 */

import {
  buildPlayerStatusDirective,
  buildPlayerStageContextHint,
  resolvePlayerPromptAbility,
  playerPromptRoleSkillBrief,
  appendPlayerPromptInitialIdentity,
} from "../../../game/observation/player-prompt-directives";
import type { ReadonlyBoardConfig } from "@ai-werewolf-arena/game-contract";

import { initialIdentityCandidateCounts } from "../../../game/mechanisms/roles/initial_identity/deal";

import { renderMessage, text, type Locale } from "@ai-werewolf-arena/game-text";

import { COMPONENT } from "../../../core/domain/components/names";
import { RoleComponent } from "../../../core/domain/components/role";
import { ActionRequest, EntityId, Role, ToolName } from "../../../core/domain";
import { getActionRequestStage } from "../../../core/domain/action_request_context";
import { World } from "../../../core/domain/world";

import {
  ConfigRenderRegistry,
  PhaseStageLocalizationRegistry,
  RoleCatalog,
  TargetHintRegistry,
  ToolSpecRegistry,
  knownWolfTeammates,
} from "../../../game/mechanisms";

import type { PlayerObservation } from "../../../game/observation/player-observation";
import { capturePlayerObservation } from "../../../game/observation/player-observation-projector";
import { buildBoardInfoPrompt, buildSystemPrompt, buildUserPrompt } from "./prompt_templates";
import { renderTurnConstraintUserHint } from "./turn_constraints";
import { resolveTurnConstraints } from "../../../game/gateway/turn-constraints";

export interface PlayerPromptPolicyOptions {
  personalityPromptResolver?: (request: ActionRequest, role?: RoleComponent) => string | undefined;
  toolSpecRegistry: ToolSpecRegistry;
  roleCatalog: RoleCatalog;
  targetHintRegistry: TargetHintRegistry;
  phaseStageLocalizationRegistry: PhaseStageLocalizationRegistry;
  configRenderRegistry: ConfigRenderRegistry;
  boardConfig?: ReadonlyBoardConfig;
}

/** SDK／ACP 共用提示策略；传输适配器只选择其协议提示。 */
export class PlayerPromptPolicy {
  private readonly publicRoleCounts = new Map<Role, number>();
  private readonly publicBoardSize: number;

  constructor(
    private readonly world: World,
    private readonly options: PlayerPromptPolicyOptions,
  ) {
    this.publicBoardSize = options.boardConfig?.boardSize ?? world.entityIds().length;
    const thiefCounts = initialIdentityCandidateCounts(world);
    if (thiefCounts) {
      for (const [role, count] of thiefCounts) this.publicRoleCounts.set(role, count);
    } else if (options.boardConfig) {
      for (const { role, count } of options.boardConfig.roleSetups) {
        this.publicRoleCounts.set(role, (this.publicRoleCounts.get(role) ?? 0) + count);
      }
    } else {
      // 无板子输入的旧调用方只在开局构造时统计角色，保留原兼容行为。
      for (const id of world.entityIds()) {
        const role = this.role(id);
        if (role)
          this.publicRoleCounts.set(role.role, (this.publicRoleCounts.get(role.role) ?? 0) + 1);
      }
    }
  }

  get locale(): Locale {
    return this.world.locale;
  }

  /** 真实策略入口委托完整观察捕获，不在提示层重建库存或改变冻结时点。 */
  buildObservation(request: ActionRequest): PlayerObservation {
    return capturePlayerObservation(request, {
      world: () => this.world,
      role: (actorId) => this.role(actorId()),
      wolfTeammates: (actorId) => this.wolfTeammates(actorId()),
      catalog: () => this.options.roleCatalog,
    });
  }

  buildSystem(
    request: ActionRequest,
    options: { supportsDebugReporting: boolean; includeToolUseInstructions?: boolean },
  ) {
    const role = this.role(request.actorId);
    const boardInfoPrompt = this.buildBoardInfo();
    const configPrompt = this.options.boardConfig
      ? this.options.configRenderRegistry.renderBoardConfigPrompt(
          this.options.boardConfig,
          this.locale,
        )
      : undefined;
    return {
      systemPrompt: buildSystemPrompt({
        locale: this.locale,
        actorId: request.actorId,
        role: role ? this.options.roleCatalog.label(role.role, this.locale) : "unknown",
        maxPlayerId: this.world.entityIds().length,
        teammateIds: this.wolfTeammates(request.actorId),
        boardInfoPrompt,
        configPrompt,
        personalityPrompt: this.options.personalityPromptResolver?.(request, role),
        playerName: this.world.getComponent(request.actorId, COMPONENT.Identity)?.name,
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
    const { bound, targetRuleRole } = resolvePlayerPromptAbility(request, role);
    const constraints = resolveTurnConstraints(request);
    const stage = getActionRequestStage(request);
    return buildUserPrompt({
      locale: this.locale,
      actorId: request.actorId,
      phase: this.options.phaseStageLocalizationRegistry.phaseName(
        String(request.phase),
        this.locale,
      ),
      stage: this.options.phaseStageLocalizationRegistry.stageName(stage, this.locale),
      isSpeechTurn:
        input.allowedTools.includes("speak") || input.allowedTools.includes("speak_to_wolves"),
      stageDirective:
        bound?.activation === "black_market"
          ? text(this.locale, "action.black_market_recipient.directive")
          : bound?.activation === "lucky"
            ? text(this.locale, "action.lucky.directive")
            : (this.options.toolSpecRegistry.getStageDirective(request.allowedTools, this.locale) ??
              text(this.locale, "prompt.stage.default")),
      statusDirective: buildPlayerStatusDirective(request, role, {
        world: () => this.world,
        locale: () => this.locale,
        catalog: () => this.options.roleCatalog,
        wolfTeammates: (actorId) => this.wolfTeammates(actorId()),
      }),
      requiresAction: constraints.minValidActions > 0,
      turnConstraintHint: renderTurnConstraintUserHint(constraints, this.locale),
      allowedTools: input.allowedTools,
      effectiveActionTools: input.effectiveActionTools ?? input.allowedTools,
      toolArgHints: this.toolArgHints(input.allowedTools),
      toolUsageHints: this.options.toolSpecRegistry.getApplicableUserPromptHints(
        input.allowedTools,
        this.locale,
      ),
      stageContextHint:
        [
          buildPlayerStageContextHint(request, {
            locale: () => this.locale,
            boardConfig: () => this.options.boardConfig,
          }),
          request.context.modifier_poison_blocked === true
            ? text(this.locale, "prompt.stage.modifier_poison_blocked")
            : undefined,
          request.context.retry_notice !== undefined
            ? request.context.retry_notice
            : request.context.retry_notice_message
              ? renderMessage(this.locale, request.context.retry_notice_message)
              : undefined,
        ]
          .filter(Boolean)
          .join(" ") || undefined,
      actionableIdsHint: this.options.targetHintRegistry.buildActionableIdsHint({
        modifierCandidates: request.context.modifier_candidates,
        modifierBonusCandidates: request.context.modifier_bonus_candidates,
        actorId: request.actorId,
        day: request.context.day,
        actorRole: targetRuleRole,
        abilityId: request.context.ability_id,
        debateTargetId: request.context.debate_target_id,
        allowedTools: input.allowedTools,
        world: this.world,
        roleCatalog: this.options.roleCatalog,
        sheriffCandidates: request.context.sheriff_candidates,
        exileCandidates: request.context.exile_candidates,
        badgeCandidates: request.context.badge_candidates,
      }),
      actionSubmissionHint: input.actionSubmissionHint,
    });
  }

  buildBoardInfo(): string {
    let info = buildBoardInfoPrompt({
      locale: this.locale,
      totalPlayers: this.publicBoardSize,
      roleCounts: this.publicRoleCounts,
      roleLabel: (role) => this.options.roleCatalog.label(role, this.locale),
      roleSkillBrief: (role) =>
        playerPromptRoleSkillBrief(role, {
          world: () => this.world,
          locale: () => this.locale,
          catalog: () => this.options.roleCatalog,
        }),
    });
    if (this.options.boardConfig?.pureWhite) {
      info +=
        "\n" +
        text(
          this.locale,
          this.options.boardConfig.pureWhite.eliminationPriority === "awa_wolf_priority_v1"
            ? "prompt.board.pure_white.wolf_priority"
            : "prompt.board.pure_white.good_priority",
        );
    }
    return appendPlayerPromptInitialIdentity(info, {
      world: () => this.world,
      locale: () => this.locale,
    });
  }

  private role(actorId: EntityId): RoleComponent | undefined {
    return this.world.getComponent(actorId, COMPONENT.Role);
  }

  private wolfTeammates(actorId: EntityId): EntityId[] {
    return knownWolfTeammates(this.world, actorId, this.options.roleCatalog);
  }

  private toolArgHints(allowedTools: ToolName[]): string {
    const hints = allowedTools
      .map((tool) => this.options.toolSpecRegistry.getArgHint(tool))
      .filter((hint): hint is string => Boolean(hint));
    return hints.join("; ") || text(this.locale, "common.none");
  }
}
