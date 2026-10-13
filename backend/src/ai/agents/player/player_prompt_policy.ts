/**
 * 负责系统／回合提示、阶段文案与候选提示的既有组织；完整结构观察交游戏侧捕获 owner。
 * 输入为原 World、请求和提示选项；输出保留机制知识、角色自定义原文和板子说明。
 * 自定义人设／角色展示仍在原时点调用，不因结构观察迁移而提前捕获；这里不提交行动或更改角色状态。
 * 已知存活与当前目标许可分别由原捕获和提示查询负责，不把提示候选当作行动授权。
 */
import { roleInspectionPolicy } from "../../../game/mechanisms/roles/role_inspection/ports";
import { rolePresentationRenderer } from "../../../game/observation/role-presentation";
import type { ReadonlyBoardConfig } from "@ai-werewolf-arena/game-contract";
import { getWhiteWolfKingState } from "../../../game/mechanisms/roles/white_wolf_king/ports";
import { isAnimalDreamBoard } from "../../../game/mechanisms/roles/animal_dream/authority";
import {
  animalFoxKnowledge,
  animalPufferKnowledge,
  animalCatKnowledge,
  animalBeautyKnowledge,
  animalBearKnowledge,
} from "../../../game/mechanisms/roles/animal_dream/facts";
import {
  isNobleBodyBoard,
  getNobleBodyPlayerState,
} from "../../../game/mechanisms/roles/noble_secret_body/authority";
import {
  isFragrantPairBoard,
  fragrantPlayerKnowledge,
} from "../../../game/mechanisms/roles/fragrant_pair_seer/authority";
import { settlesNightBeforeDay } from "../../../game/mechanisms/night_death_timing";
import {
  projectAlchemist,
  projectRaven,
} from "../../../game/mechanisms/roles/mist_raven/player_projection";
import { readModifierState } from "../../../game/mechanisms/roles/scholar_mentor/state";
import { scholarMentorStateForRole } from "../../../game/mechanisms/roles/scholar_mentor/night_frame";
import { projectTimeConsortState } from "../../../game/mechanisms/roles/time_wolf_consort/state";
import { projectWolfSorcererState } from "../../../game/mechanisms/roles/wolf_sorcerer/state";
import { projectTricksterState } from "../../../game/mechanisms/roles/trickster/state";
import { projectOrderPrinceState } from "../../../game/mechanisms/roles/order_prince/state";
import { projectMagicianState } from "../../../game/mechanisms/roles/magician/state";
import { getRedMoonState } from "../../../game/mechanisms/roles/red_moon_apostle/state";
import { getNightmareShadowState } from "../../../game/mechanisms/roles/nightmare_shadow/state";
import { getEvilKnightState } from "../../../game/mechanisms/roles/evil_knight/state";
import { projectDemonHunter } from "../../../game/mechanisms/roles/demon_hunter/authority";
import {
  weddingActorView,
  weddingBrideState,
} from "../../../game/mechanisms/roles/ghost_bride/authority";
import { projectLonelyGirl } from "../../../game/mechanisms/roles/lonely_girl/lifecycle";
import { projectWildChild } from "../../../game/mechanisms/roles/wild_child/lifecycle";
import { initialIdentityCandidateCounts } from "../../../game/mechanisms/roles/initial_identity/deal";
import { projectShapeshifterState } from "../../../game/mechanisms/roles/shapeshifter/state";
import { projectShapeshifterChoices } from "../../../game/mechanisms/roles/shapeshifter/setup";
import { initialIdentityKind } from "../../../game/mechanisms/roles/initial_identity/deal";
import { projectThiefState } from "../../../game/mechanisms/roles/thief/state";
import { projectThiefChoices } from "../../../game/mechanisms/roles/thief/setup";
import { projectWallNote } from "../../../game/mechanisms/events/wall_notes/authority";
import {
  projectBearState,
  projectDreamerState,
  projectGuardState,
  projectHunterState,
  projectIdiotState,
  projectKnightState,
  projectWhiteWolfKingState,
  projectWolfBeautyState,
  projectWolfKingState,
} from "../../../game/mechanisms/roles/player_state";
import { renderInspectionPolicy } from "../../../game/mechanisms/roles/role_inspection/policies";
import { renderMessage, text, term, type Locale } from "@ai-werewolf-arena/game-text";
import { readGravekeeperReport } from "@ai-werewolf-arena/replay-contract";
import { getBearState } from "../../../game/mechanisms/roles/bear/ports";
import { getHiddenWolfState } from "../../../game/mechanisms/roles/hidden_wolf/ports";
import { canHiddenWolfKnife } from "../../../game/mechanisms/roles/hidden_wolf/inheritance";
import { ROLE_INSPECTION_POLICY_ROLES, projectRoleInspectionState, projectSeerState, projectWitchState, projectNightState } from "../../../game/mechanisms/roles/abilities";
import {
  getBlackMarketState,
  projectBlackMarketState,
} from "../../../game/mechanisms/roles/black_market_merchant/state";
import { allDeathGuns, projectDeathGun } from "../../../game/mechanisms/roles/death_abilities";
import { getGargoyleState } from "../../../game/mechanisms/roles/gargoyle/ports";
import { getRoleInspectionState } from "../../../game/mechanisms/roles/role_inspection/ports";
import { canGargoyleKnife } from "../../../game/mechanisms/roles/gargoyle/inheritance";
import {
  getMechanicalState,
  projectMechanicalState,
} from "../../../game/mechanisms/roles/mechanical_wolf/state";
import {
  getAwakenedState,
  projectAwakenedState,
} from "../../../game/mechanisms/roles/awakened_hidden_wolf/state";
import { ownNightActions } from "../../../game/mechanisms/roles/night_action_history";
import { getDebaterState, projectDebaterState } from "../../../game/mechanisms/roles/debater/state";
import {
  hasDebateCommit,
  debateVoteBlocked,
} from "../../../game/mechanisms/roles/debater/authority";
import { getCupidState, projectCupidState } from "../../../game/mechanisms/roles/cupid/state";
import { projectLover } from "../../../game/mechanisms/roles/cupid/relation";
import { getHybridState, projectHybridState } from "../../../game/mechanisms/roles/hybrid/state";
import {
  getMerchantState,
  projectMerchantState,
} from "../../../game/mechanisms/roles/miracle_merchant/state";
import { projectEclipseState } from "../../../game/mechanisms/roles/radiant_eclipse/ports";
import { COMPONENT } from "../../../core/domain/components/names";
import { RoleComponent } from "../../../core/domain/components/role";
import { ActionRequest, ActionWindow, EntityId, Role, ToolName } from "../../../core/domain";
import {
  getActionRequestDay,
  getActionRequestStage,
} from "../../../core/domain/action_request_context";
import { World } from "../../../core/domain/world";
import type { IdentityComponent } from "../../../core/domain/entities/player";
import {
  ConfigRenderRegistry,
  PhaseStageLocalizationRegistry,
  RoleCatalog,
  TargetHintRegistry,
  ToolSpecRegistry,
  knownWolfTeammates,
  allNightAbilities,
  abilityStatus,
  projectNightAbility,
} from "../../../game/mechanisms";
import { getGuardState } from "../../../game/mechanisms/roles/guard/ports";
import { getHunterState } from "../../../game/mechanisms/roles/hunter/ports";
import { getWolfKingState } from "../../../game/mechanisms/roles/wolf_king/ports";
import { getKnightState } from "../../../game/mechanisms/roles/knight/ports";
import { getGravekeeperState } from "../../../game/mechanisms/roles/gravekeeper/ports";
import { getDreamerState } from "../../../game/mechanisms/roles/dreamer/ports";
import { getWolfBeautyState } from "../../../game/mechanisms/roles/wolf_beauty/ports";
import { getIdiotState } from "../../../game/mechanisms/roles/idiot/ports";
import { getWitchState } from "../../../game/mechanisms/roles/witch/ports";
import { getSeerState } from "../../../game/mechanisms/roles/seer/ports";
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
    const bound = request.context.ability_id
      ? allNightAbilities(role).find((ability) => ability.id === request.context.ability_id)
      : undefined;
    const targetRuleRole =
      bound?.kind === "shelter"
        ? Role.RadiantCount
        : bound?.kind === "role_check"
          ? ROLE_INSPECTION_POLICY_ROLES[roleInspectionPolicy(bound.state)]
          : bound?.kind === "guard"
            ? Role.Guard
            : bound?.kind === "potion"
              ? Role.Witch
              : bound?.kind === "seer_check"
                ? Role.Seer
                : bound?.kind === "dream"
                  ? Role.Dreamer
                  : role?.role;
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
      statusDirective: this.statusDirective(request, role),
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
          this.stageContextHint(request),
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
        role === Role.Bear && isAnimalDreamBoard(this.world)
          ? text(this.locale, "role.bear.dawn_brief")
          : this.options.roleCatalog.skillBrief(role, this.locale),
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
    return initialIdentityCandidateCounts(this.world)
      ? info +
          "\n" +
          text(
            this.locale,
            initialIdentityKind(this.world) === "shapeshifter"
              ? "prompt.board.shapeshifter"
              : "prompt.board.thief",
          )
      : info;
  }

  private role(actorId: EntityId): RoleComponent | undefined {
    return this.world.getComponent(actorId, COMPONENT.Role);
  }

  private wolfTeammates(actorId: EntityId): EntityId[] {
    return knownWolfTeammates(this.world, actorId, this.options.roleCatalog);
  }

  private statusDirective(request: ActionRequest, role?: RoleComponent): string | undefined {
    const lines: string[] = [];
    if (isAnimalDreamBoard(this.world)) {
      const state =
        role?.role === Role.FoxCub
          ? animalFoxKnowledge(this.world, request.actorId)
          : role?.role === Role.Pufferfish
            ? animalPufferKnowledge(this.world, request.actorId)
            : role?.role === Role.WhiteCat
              ? animalCatKnowledge(this.world, request.actorId)
              : null;
      if (state)
        lines.push(text(this.locale, "prompt.status.animal", { state: JSON.stringify(state) }));
    }
    if (role?.role === Role.FragrantPhantom && isFragrantPairBoard(this.world)) {
      const known = fragrantPlayerKnowledge(this.world, request.phase, request.context.day);
      if (known.actorId === request.actorId)
        lines.push(text(this.locale, "prompt.status.fragrant", { state: JSON.stringify(known) }));
    }
    if (isNobleBodyBoard(this.world)) {
      const known = getNobleBodyPlayerState(this.world, request.actorId, request.phase);
      if (known)
        lines.push(
          text(
            this.locale,
            known.kind === "night_noble" ? "prompt.status.noble" : "prompt.status.secret_body",
            { state: JSON.stringify(known.state) },
          ),
        );
    }
    if (role?.role === Role.EclipseMaid) {
      const state = projectEclipseState(role);
      if (state)
        lines.push(text(this.locale, "prompt.status.eclipse", { state: JSON.stringify(state) }));
    }
    const alchemist = projectAlchemist(role),
      raven = projectRaven(role);
    if (alchemist)
      lines.push(
        text(this.locale, "prompt.status.alchemist", { state: JSON.stringify(alchemist) }),
      );
    if (raven)
      lines.push(text(this.locale, "prompt.status.raven", { state: JSON.stringify(raven) }));
    const weddingView = weddingActorView(this.world, request.actorId);
    if (weddingView)
      lines.push(
        text(this.locale, "prompt.status.wedding", { state: JSON.stringify(weddingView) }),
      );
    if (role?.role === Role.LonelyGirl)
      lines.push(
        text(this.locale, "prompt.status.lonely_girl", {
          state: JSON.stringify(projectLonelyGirl(this.world, role)),
        }),
      );
    if (role?.role === Role.WildChild)
      lines.push(
        text(this.locale, "prompt.status.wild_child", {
          state: JSON.stringify(projectWildChild(this.world, role)),
        }),
      );
    const thief = projectThiefState(role, this.world),
      choices = projectThiefChoices(this.world, request.actorId);
    const shape = projectShapeshifterState(role, this.world),
      shapeChoices = projectShapeshifterChoices(this.world, request.actorId);
    if (shape)
      lines.push(
        text(this.locale, "prompt.status.shapeshifter", {
          state: JSON.stringify({ ...shape, ...(shapeChoices ?? {}) }),
        }),
      );
    if (thief)
      lines.push(
        text(this.locale, "prompt.status.thief", {
          state: JSON.stringify({ ...thief, ...(choices ?? {}) }),
        }),
      );
    const wallNote = projectWallNote(this.world, request.actorId);
    if (wallNote)
      lines.push(text(this.locale, "prompt.status.wall_note", { state: JSON.stringify(wallNote) }));
    lines.push(text(this.locale, "prompt.status.day", { day: getActionRequestDay(request) }));
    lines.push(
      text(this.locale, "prompt.status.wolf_teammates", {
        teammates:
          this.wolfTeammates(request.actorId).join(", ") || text(this.locale, "common.none"),
      }),
    );
    if (role)
      lines.push(
        text(this.locale, "ability.identity", {
          role: this.options.roleCatalog.label(role.role, this.locale),
          camp: term("camp", role.camp, this.locale),
        }),
      );
    for (const ability of allNightAbilities(role)) {
      const status = text(
        this.locale,
        `ability.status.${abilityStatus(ability, request.context.day)}`,
      );
      const state = projectNightState(ability);
      lines.push(
        text(this.locale, "ability.summary", {
          id: ability.id,
          kind: text(this.locale, `ability.kind.${ability.kind}`),
          status,
          uses:
            ability.maxUses === null
              ? text(this.locale, "ability.unlimited")
              : ability.maxUses - ability.uses,
          state: JSON.stringify(state),
        }),
      );
    }
    if (request.context.ability_id)
      lines.push(text(this.locale, "ability.bound_turn", { id: request.context.ability_id }));
    for (const gun of allDeathGuns(role)) {
      const projected = projectDeathGun(gun);
      lines.push(
        text(this.locale, "ability.death_gun.summary", {
          id: projected.id,
          status: text(this.locale, `ability.status.${projected.status}`),
          remaining: projected.remaining,
          granted: projected.grantedNight,
          armed: projected.armedOnNight ?? text(this.locale, "common.none"),
        }),
      );
    }
    const history = ownNightActions(this.world, request.actorId, request.context.day);
    const hasLucky =
      allNightAbilities(role).some((ability) => ability.activation === "lucky") ||
      history.some((row) => row.lucky && (row.recipientPolicy ?? "lucky") === "lucky");
    const hasBlack =
      allNightAbilities(role).some((ability) => ability.activation === "black_market") ||
      history.some((row) => row.recipientPolicy === "black_market");
    if (hasLucky) lines.push(text(this.locale, "ability.lucky.rules"));
    if (hasBlack) lines.push(text(this.locale, "ability.black_market.rules"));
    if (hasLucky || hasBlack)
      lines.push(text(this.locale, "ability.lucky.history", { actions: JSON.stringify(history) }));
    if (
      request.allowedTools.includes("dream") &&
      allNightAbilities(role).some((ability) => ability.kind === "dream")
    ) {
      lines.push(text(this.locale, "ability.dream.rules"));
      const state = getDreamerState(role!, request.context.ability_id);
      lines.push(
        text(
          this.locale,
          state?.protectionPolicy === "netease_2026_night_immunity_v1"
            ? "role.dreamer.protection_netease"
            : "role.dreamer.protection_awa",
        ),
      );
    }
    if (role && request.allowedTools.includes("inspect_role")) {
      const inspection = getRoleInspectionState(role, request.context.ability_id);
      if (inspection)
        lines.push(
          inspection.inspectionPolicy
            ? renderInspectionPolicy(inspection, this.locale)
            : text(
                this.locale,
                roleInspectionPolicy(inspection) === "psychic"
                  ? "ability.role_check.psychic_rules"
                  : roleInspectionPolicy(inspection) === "mirror"
                    ? "ability.role_check.mirror_rules"
                    : "ability.role_check.rules",
              ),
        );
    }
    if (debateVoteBlocked(this.world, request.actorId, request.context.day))
      lines.push(text(this.locale, "prompt.status.debate_penalty"));
    const lover = projectLover(this.world, request.actorId);
    if (lover) {
      lines.push(text(this.locale, "prompt.status.lover", { partner: lover.partnerId }));
      if (lover.mayNotVotePartner) lines.push(text(this.locale, "prompt.status.lovers_vote"));
    }
    const privateState = rolePresentationRenderer(role)?.(this.locale).trim();
    if (privateState)
      lines.push(text(this.locale, "prompt.status.private", { state: privateState }));
    if (role?.role === Role.Idiot && getIdiotState(role)?.revealed) {
      lines.push(text(this.locale, "prompt.status.idiot"));
    }
    return lines.length ? lines.join(" ") : undefined;
  }

  private stageContextHint(request: ActionRequest): string | undefined {
    if (request.context.fox_candidates)
      return text(this.locale, "prompt.stage.fox_candidates", {
        ids: request.context.fox_candidates.join(", "),
      });
    const pairCandidates =
      request.context.fragrant_pair_candidates ?? request.context.pair_check_candidates;
    if (pairCandidates)
      return text(this.locale, "prompt.stage.fragrant_pair_candidates", {
        ids: pairCandidates.join(", "),
      });
    if (request.context.wolf_kill_candidates !== undefined)
      return text(this.locale, "prompt.stage.wolf_kill_candidates", {
        candidates:
          request.context.wolf_kill_candidates.join(", ") || text(this.locale, "common.none"),
      });
    if (request.context.stage === "alchemist_snake")
      return text(this.locale, "prompt.stage.snake", {
        target: request.context.snake_target ?? text(this.locale, "common.none"),
        candidates:
          (request.context.snake_candidates ?? []).join(", ") || text(this.locale, "common.none"),
      });
    if (request.context.stage === "alchemist_mist")
      return text(this.locale, "prompt.stage.mist", {
        candidates: (request.context.mist_candidates ?? []).join(", "),
      });
    if (request.context.stage === "raven_knife")
      return text(this.locale, "prompt.stage.raven_knife", {
        candidates: (request.context.raven_candidates ?? []).join(", "),
      });
    const stage = getActionRequestStage(request);
    const day = getActionRequestDay(request);
    const firstDaySheriffTiming =
      day === 1 &&
      this.options.boardConfig?.enableSheriff === true &&
      !settlesNightBeforeDay(this.options.boardConfig) &&
      [
        "sheriff_nomination",
        "sheriff_campaign_speech",
        "sheriff_withdraw",
        "sheriff_vote",
      ].includes(stage)
        ? text(this.locale, "prompt.stage.sheriff_timing")
        : undefined;
    if (stage === "sheriff_nomination") {
      return [text(this.locale, "prompt.stage.sheriff_nomination"), firstDaySheriffTiming]
        .filter(Boolean)
        .join(" ");
    }
    if (stage === "sheriff_campaign_speech") {
      return firstDaySheriffTiming;
    }
    if (stage === "sheriff_withdraw") {
      return [text(this.locale, "prompt.stage.sheriff_withdraw"), firstDaySheriffTiming]
        .filter(Boolean)
        .join(" ");
    }
    if (stage === "sheriff_vote") {
      return [text(this.locale, "prompt.stage.sheriff_vote"), firstDaySheriffTiming]
        .filter(Boolean)
        .join(" ");
    }
    if (stage === "scholar_mentor_choice")
      return text(this.locale, "prompt.stage.modifier_choice", {
        modes: (request.context.modifier_modes ?? []).join(", "),
      });
    if (stage === "scholar_mentor_bonus")
      return text(this.locale, "prompt.stage.modifier_bonus", {
        kind: request.context.modifier_bonus_kind ?? "",
      });
    if (stage !== "witch") {
      const onlySelfDestruct =
        Object.values(ActionWindow).includes(stage as ActionWindow) &&
        request.allowedTools.every(
          (tool) =>
            tool === "self_destruct" ||
            tool === "self_destruct_with_target" ||
            tool === "report_bug",
        );
      return onlySelfDestruct
        ? text(this.locale, "prompt.stage.blast_only", {
            tool: request.allowedTools.includes("self_destruct_with_target")
              ? "self_destruct_with_target"
              : "self_destruct",
          })
        : undefined;
    }
    if (request.context.wolf_targets !== undefined)
      return request.context.wolf_targets.length
        ? text(this.locale, "prompt.stage.wolf_targets", {
            targets: request.context.wolf_targets.join(", "),
          })
        : text(this.locale, "prompt.stage.no_wolf_target");
    if (typeof request.context.wolf_target === "number") {
      return text(this.locale, "prompt.stage.wolf_target", { target: request.context.wolf_target });
    }
    return request.context.wolf_target === null
      ? text(this.locale, "prompt.stage.no_wolf_target")
      : text(this.locale, "prompt.stage.unknown_wolf_target");
  }

  private toolArgHints(allowedTools: ToolName[]): string {
    const hints = allowedTools
      .map((tool) => this.options.toolSpecRegistry.getArgHint(tool))
      .filter((hint): hint is string => Boolean(hint));
    return hints.join("; ") || text(this.locale, "common.none");
  }
}
