import {
  isEvilKnightBoard,
  assertEvilKnightRosterCurrent,
} from "../../mechanisms/roles/evil_knight/night_frame";
import {
  sealNativeGuardContribution,
  lateUnknownGuardContribution,
} from "../../mechanisms/roles/demon_hunter/guard_contribution";
import {
  demonHunterActorId,
  assertDemonNightReadable,
  beginDemonHunterNight,
  closeDemonHunterNight,
  originalDemonNightLives,
  demonOriginalWolfSourceCurrent,
  demonOriginalWolfTargetCurrent,
} from "../../mechanisms/roles/demon_hunter/authority";
import { demonWitchMarksSafe } from "../../mechanisms/roles/demon_hunter/native_potion_requests";
import { sealDeliveredDemonWitchSources } from "../../mechanisms/roles/demon_hunter/native_potion_controller";
import {
  captureWeddingKnife,
  closeWeddingNight,
  weddingSetup,
  ghostBrideReady,
  hasActiveGhostBride,
} from "../../mechanisms/roles/ghost_bride/authority";
import { discardStaleWeddingKnife } from "../../mechanisms/roles/ghost_bride/night_stages";
import {
  lonelyGirlReady,
  hasActiveLonelyGirl,
  openLonelyGirlNight,
} from "../../mechanisms/roles/lonely_girl/lifecycle";
import {
  wildChildReady,
  hasActiveWildChild,
  openWildChildNight,
} from "../../mechanisms/roles/wild_child/lifecycle";
import {
  hasActiveInitialIdentitySetup,
  initialIdentityKind,
  initialIdentitySetupReady,
  openInitialIdentityNight,
} from "../../mechanisms/roles/initial_identity/deal";
import { COMPONENT } from "../../../core/domain/components/names";
import { RoleComponent } from "../../../core/domain/components/role";
import {
  StatusMarksComponent,
  statusMarkSnapshot,
} from "../../../core/domain/components/status_marks";
import {
  ActionProvider,
  ActionRequest,
  ActionRequestExtras,
  ActionStage,
  BoardConfig,
  EntityId,
  GameEvent,
  ExileFeedback,
  NightSummary,
  Phase,
  Role,
  TieBreakerStrategy,
  StatusMark,
} from "../../../core/domain/model";
import {
  DamageResolutionResult,
  DamageResolutionSystem,
} from "../../../core/domain/systems/damage_resolution_system";
import { World } from "../../../core/domain/world";
import { ToolGateway } from "../../gateway/tool_gateway";
import {
  getDefaultNightStageRegistry,
  NightStageRegistry,
  NightStageState,
} from "../../mechanisms";
import { safeRecordLogicOp } from "../../../recording/session_recorder";
import { GameActionRequestFactory } from "../action_request_factory";
import { createRandom, shuffled, type RandomSource } from "../../../core/domain/random";
import { DreamNightFrame, hasDreamNightCommit } from "../../mechanisms/roles/dreamer/night_frame";
import { discardStaleWolfKnife } from "../../mechanisms/roles/wolf/knife_scope";
import { hasRoleInspectionNightCommit } from "../../mechanisms/roles/role_inspection/night_scope";
import { livingNightLife } from "../../../core/domain/night_effects";
import { AliveComponent, aliveLifeVersion } from "../../../core/domain/components/alive";
import { hasMechanicalNightCommit } from "../../mechanisms/roles/mechanical_wolf/night_scope";
import { hasBlackMarketNightCommit } from "../../mechanisms/roles/black_market_merchant/night_stage";
import { hasRecipientNightCommit } from "../../mechanisms/roles/recipient_ability_stage";
import { hasLuckyNightCommit } from "../../mechanisms/roles/miracle_merchant/lucky_stage";
import { hasMerchantNightCommit } from "../../mechanisms/roles/miracle_merchant/night_stage";

import { hasCupidNightCommit } from "../../mechanisms/roles/cupid/relation";
import { hasHybridNightCommit } from "../../mechanisms/roles/hybrid/night_stage";
import { hasAwakenedNightCommit } from "../../mechanisms/roles/awakened_hidden_wolf/night_scope";
import { hasDeathAbilityActivationCommit } from "../../mechanisms/roles/death_ability_activation";

import { hasFoxInspectionNightCommit } from "../../mechanisms/roles/cursed_fox/inspection_effect";

export interface NightPipelineDependencies {
  world: World;
  toolGateway: ToolGateway;
  damageResolutionSystem: DamageResolutionSystem;
  events: GameEvent[];
  stageRegistry?: NightStageRegistry;
  random?: RandomSource;
}

export interface NightPipelineOptions {
  previousExile?: Readonly<ExileFeedback> | null;
  isCurrent?: () => boolean;
}
export type NightPipelineResult =
  | {
      interrupted: false;
      summary: NightSummary;
      damage: DamageResolutionResult;
      dreamFrame: DreamNightFrame;
      demonSources?: object;
      retaliationAttacks?: readonly import("../../../core/domain/night_effects").NightRetaliationAttack[];
      evilKnightBindings?: NightStageState["evilKnightBindings"];
      inspectionAttacks?: readonly import("../../../core/domain/night_effects").NightInspectionAttack[];
      demonWolfSourceCurrent?: (targetId: number) => boolean;
      demonKnifeProtection?: Readonly<{
        targetId: number;
        wolf: boolean;
        guard: boolean;
        guardCurrent?: () => boolean;
        heal: boolean;
      }>;
      foxInspections?: readonly import("../../../core/domain/night_effects").NightFoxInspectionClaim[];
      deathLives: ReadonlyMap<EntityId, { life: AliveComponent; version: number | undefined }>;
    }
  | { interrupted: true };

/**
 * 夜间阶段流水线：
 * - 通过 NightStageRegistry 串行驱动夜间子阶段；
 * - 最后统一执行伤害结算并返回结果。
 * night_resolved 事件由 PhaseManager 按白天流程时序写入。
 */
export class NightPipeline {
  private readonly world: World;
  private readonly toolGateway: ToolGateway;
  private readonly damageResolutionSystem: DamageResolutionSystem;
  private readonly events: GameEvent[];
  private readonly stageRegistry: NightStageRegistry;
  private readonly random: RandomSource;

  constructor(dependencies: NightPipelineDependencies) {
    this.world = dependencies.world;
    this.toolGateway = dependencies.toolGateway;
    this.damageResolutionSystem = dependencies.damageResolutionSystem;
    this.events = dependencies.events;
    this.stageRegistry = dependencies.stageRegistry ?? getDefaultNightStageRegistry();
    this.random = dependencies.random ?? createRandom();
  }

  /**
   * 执行完整夜间流程并返回结算摘要与伤害结果。
   */
  async execute(
    config: BoardConfig,
    actionProvider: ActionProvider,
    day: number,
    options: NightPipelineOptions = {},
  ): Promise<NightPipelineResult> {
    if (hasActiveGhostBride(this.world) || !ghostBrideReady(this.world))
      throw new Error("ghost_bride_setup_before_night_required");
    if (hasActiveLonelyGirl(this.world) || !lonelyGirlReady(this.world))
      throw new Error("lonely_girl_setup_before_night_required");
    if (hasActiveWildChild(this.world) || !wildChildReady(this.world))
      throw new Error("wild_child_setup_before_night_required");
    if (hasActiveInitialIdentitySetup(this.world) || !initialIdentitySetupReady(this.world))
      throw new Error(`${initialIdentityKind(this.world) ?? "thief"}_setup_before_night_required`);
    const isCurrent = options.isCurrent ?? (() => true);
    if (!isCurrent()) return { interrupted: true };
    const closeLonelyGirlNight = openLonelyGirlNight(this.world, day);
    const closeWildChildNight = openWildChildNight(this.world, day, this.events);
    const closeThiefNight = openInitialIdentityNight(this.world, day);
    const ownsWedding = weddingSetup(this.world) !== null;
    const ownsDemon = demonHunterActorId(this.world) !== null;
    let weddingHandedOff = false,
      demonHandedOff = false,
      demonAcquired = false;
    try {
      if (ownsDemon) {
        beginDemonHunterNight(this.world, day, isCurrent);
        demonAcquired = true;
      }
      const assertReadable = () => {
        assertEvilKnightRosterCurrent(this.world);
        if (!ownsDemon) return;
        assertDemonNightReadable(this.world);
        if (!this.world.entityIds().every((id) => demonWitchMarksSafe(this.world, id)))
          throw new Error("demon_hunter_unreadable_marks");
      };
      assertReadable();
      const nativeProvider =
        ownsDemon || isEvilKnightBoard(this.world)
          ? {
              getAction: async (request: ActionRequest) => {
                assertReadable();
                const action = await actionProvider.getAction(request);
                assertReadable();
                return action;
              },
            }
          : actionProvider;
      if (ownsWedding) {
        const capture = captureWeddingKnife(this.world, day, isCurrent);
        this.events.push({
          timestamp: Date.now(),
          type: "ghost_bride_knife_captured",
          payload: { ...capture, actorIds: [...capture.actorIds] },
          audience: Object.freeze([]),
        });
      }
      if (hasFoxInspectionNightCommit(this.world, day))
        throw new Error("fox_inspection_night_reentry_after_commit");
      if (hasDreamNightCommit(this.world, day)) throw new Error("dream_night_reentry_after_commit");
      if (hasRoleInspectionNightCommit(this.world, day))
        throw new Error("role_inspection_night_reentry_after_commit");
      if (hasMechanicalNightCommit(this.world, day))
        throw new Error("mechanical_night_reentry_after_commit");
      if (
        hasBlackMarketNightCommit(this.world, day) ||
        hasRecipientNightCommit(this.world, day, "black_market")
      )
        throw new Error("black_market_night_reentry_after_commit");
      if (hasLuckyNightCommit(this.world, day)) throw new Error("lucky_night_reentry_after_commit");
      if (hasMerchantNightCommit(this.world, day))
        throw new Error("merchant_night_reentry_after_commit");
      if (hasCupidNightCommit(this.world, day)) throw new Error("cupid_night_reentry_after_commit");
      if (hasHybridNightCommit(this.world, day))
        throw new Error("hybrid_night_reentry_after_commit");
      if (hasAwakenedNightCommit(this.world, day))
        throw new Error("awakened_night_reentry_after_commit");
      if (hasDeathAbilityActivationCommit(this.world, day))
        throw new Error("death_ability_night_reentry_after_commit");
      safeRecordLogicOp({
        scope: "phase_pipeline",
        op: "night_pipeline_start",
        phase: Phase.Night,
        status: "ok",
        input: {
          board_size: config.boardSize,
        },
      });

      const stageState: NightStageState = {
        wolfChatOrder: [],
        endedWolves: new Set<EntityId>(),
        wolfVotes: {},
        wolfTarget: null,
        seerChecks: [],
        dreamLinks: [],
        poisonClaims: [],
        guardClaims: [],
        merchantBacklashes: [],
        blackMarketBacklashes: [],
        mechanicalEffects: { shields: [], attacks: [], failures: [] },
        awakenedEffects: { shields: [], attacks: [] },
      };

      const requests = new GameActionRequestFactory(this.world, this.events, day);
      const stageCtx = {
        isCurrent,
        previousExile: options.previousExile ? structuredClone(options.previousExile) : null,
        world: this.world,
        roleCatalog: this.stageRegistry.roleCatalog,
        toolGateway: this.toolGateway,
        events: this.events,
        actionProvider: nativeProvider,
        currentDay: () => day,
        makeRequest: (
          actorId: EntityId,
          allowedTools: ActionRequest["allowedTools"],
          context: ActionRequestExtras & { stage: ActionStage; requiresAction?: boolean },
        ) => this.makeRequest(requests, actorId, allowedTools, context),
        getAliveByRole: (role: Role) => this.getAliveByRole(role),
        ensureMarks: (entityId: EntityId) => this.ensureMarks(entityId),
        pickMajorityTarget: (votes: Record<number, number>) =>
          this.pickMajorityTarget(votes, config.tieBreaker?.wolfKillVote ?? "min_id"),
        shuffleWolves: (ids: EntityId[]) =>
          shuffled(ids, this.random.fork(`day:${day}:wolf-order`)),
        state: stageState,
      };

      for (const stage of this.stageRegistry.getStages(config, this.world)) {
        assertEvilKnightRosterCurrent(this.world);
        if (!isCurrent()) return { interrupted: true };
        assertReadable();
        discardStaleWolfKnife(this.world, stageState);
        if (ownsWedding) discardStaleWeddingKnife(this.world, day, stageState);
        await stage.execute(stageCtx);
        assertEvilKnightRosterCurrent(this.world);
        assertReadable();
        if (!isCurrent()) return { interrupted: true };
        discardStaleWolfKnife(this.world, stageState);
        if (ownsWedding) discardStaleWeddingKnife(this.world, day, stageState);
      }

      discardStaleWolfKnife(this.world, stageState);
      if (ownsWedding) discardStaleWeddingKnife(this.world, day, stageState);
      const demonSources = ownsDemon ? sealDeliveredDemonWitchSources(this.world, day) : undefined;
      const demonWolfActors = [...(stageState.wolfTargetVoters ?? [])];
      const knifeScope = stageState.wolfTargetScope;
      const demonWolfTarget = knifeScope?.targetId;
      const demonWolfSourceCurrent = ownsDemon
        ? (targetId: number) =>
            targetId === demonWolfTarget &&
            demonOriginalWolfSourceCurrent(this.world, day, demonWolfActors) &&
            demonOriginalWolfTargetCurrent(this.world, day, targetId)
        : undefined;
      const demonGuardSources = ownsDemon
        ? (stageState.guardClaims ?? []).flatMap((claim) =>
            claim.contribution
              ? [{ claim, sealed: sealNativeGuardContribution(claim.contribution) }]
              : [],
          )
        : [];
      const demonUnknownGuard =
        knifeScope && statusMarkSnapshot(knifeScope.marks, StatusMark.GuardMark)?.present === true;
      const demonKnifeProtection =
        ownsDemon && knifeScope
          ? Object.freeze({
              targetId: knifeScope.targetId,
              wolf: statusMarkSnapshot(knifeScope.marks, StatusMark.WolfKillMark)?.present === true,
              guard:
                statusMarkSnapshot(knifeScope.marks, StatusMark.GuardMark)?.present === true &&
                (!(stageState.guardClaims ?? []).some(
                  (claim) => claim.target.id === knifeScope.targetId,
                ) ||
                  (stageState.guardClaims ?? []).some(
                    (claim) =>
                      claim.target.id === knifeScope.targetId &&
                      claim.marks === knifeScope.marks &&
                      livingNightLife(this.world, claim.target),
                  )),
              guardCurrent: () => {
                const sources = demonGuardSources.filter(
                  ({ claim }) => claim.target.id === knifeScope.targetId,
                );
                if (!sources.length)
                  return (
                    !!demonUnknownGuard ||
                    statusMarkSnapshot(
                      this.world.getComponent(knifeScope.targetId, COMPONENT.StatusMarks),
                      StatusMark.GuardMark,
                    )?.present === true
                  );
                return sources.some(
                  ({ claim, sealed }) =>
                    sealed.unknown ||
                    lateUnknownGuardContribution(claim.contribution!) ||
                    (sealed.native &&
                      claim.isCurrent?.() === true &&
                      livingNightLife(this.world, claim.target)),
                );
              },
              heal: statusMarkSnapshot(knifeScope.marks, StatusMark.HealMark)?.present === true,
            })
          : undefined;
      const dreamFrame = new DreamNightFrame(stageState.dreamLinks);
      const damage = this.damageResolutionSystem.resolve(this.world, {
        protectedTargets: dreamFrame.protectedTargets(this.world),
        immuneNightTargets: dreamFrame.immuneNightTargets(this.world),
        consecutiveDeaths: dreamFrame.consecutiveDeaths(this.world),
        poisonClaims: stageState.poisonClaims,
        retaliationAttacks: stageState.retaliationAttacks,
        nightImmunities: stageState.nightImmunities,
        inspectionAttacks: stageState.inspectionAttacks,
        foxInspections: stageState.foxInspections,
        wolfImmuneTargets: this.getAliveByRole(Role.CursedFox),
        guardClaims: stageState.guardClaims,
        merchantBacklashes: stageState.merchantBacklashes,
        blackMarketBacklashes: stageState.blackMarketBacklashes,
        mechanicalEffects: stageState.mechanicalEffects,
        awakenedEffects: stageState.awakenedEffects,
      });
      assertReadable();
      for (const reflection of damage.poisonReflections ?? [])
        this.events.push({
          timestamp: Date.now(),
          type: "mechanical_poison_reflected",
          payload: { ...reflection, day },
        });
      dreamFrame.expandInitialDamage(this.world, damage);
      safeRecordLogicOp({
        scope: "resolution",
        op: "night_damage_resolved",
        phase: Phase.Night,
        status: "ok",
        output: {
          deaths: damage.deaths,
          death_sources: damage.deathSources,
        },
      });

      const summary: NightSummary = {
        wolfTarget: stageState.wolfTarget,
        deaths: [...damage.deaths],
        seerChecks: stageState.seerChecks,
        interruptedBySelfDestruct: false,
      };

      const deathLives = ownsDemon
        ? originalDemonNightLives(this.world)
        : new Map(
            damage.deaths.map((id) => {
              const life = this.world.getComponent<AliveComponent>(id, COMPONENT.Alive)!;
              return [id, { life, version: aliveLifeVersion(life) }] as const;
            }),
          );
      weddingHandedOff = ownsWedding;
      demonHandedOff = ownsDemon;
      return {
        interrupted: false,
        summary,
        damage,
        dreamFrame,
        deathLives,
        retaliationAttacks: stageState.retaliationAttacks,
        evilKnightBindings: stageState.evilKnightBindings,
        inspectionAttacks: stageState.inspectionAttacks,
        foxInspections: stageState.foxInspections,
        ...(demonSources ? { demonSources, demonWolfSourceCurrent, demonKnifeProtection } : {}),
      };
    } finally {
      if (demonAcquired && !demonHandedOff) closeDemonHunterNight(this.world);
      if (ownsWedding && !weddingHandedOff) closeWeddingNight(this.world);
      closeThiefNight();
      closeWildChildNight();
      closeLonelyGirlNight();
    }
  }

  private makeRequest(
    requests: GameActionRequestFactory,
    actorId: EntityId,
    allowedTools: ActionRequest["allowedTools"],
    context: ActionRequestExtras & { stage: ActionStage; requiresAction?: boolean },
  ): ActionRequest {
    const { stage, requiresAction = true, ...extraContext } = context;
    return requests.create({
      phase: Phase.Night,
      actorId,
      allowedTools,
      stage,
      requiresAction,
      summary: { key: "request.summary.night_action" },
      context: {
        ...extraContext,
        ...(isEvilKnightBoard(this.world)
          ? { action_failure_policy: "error" as const, allow_fallback: false }
          : {}),
      },
    });
  }

  /**
   * 获取指定角色的存活玩家列表。
   */
  private getAliveByRole(role: Role): EntityId[] {
    return this.world.getAliveEntityIds().filter((id) => {
      const roleComp = this.world.getComponent<RoleComponent>(id, COMPONENT.Role);
      return roleComp?.role === role;
    });
  }

  /**
   * 获取或创建目标玩家的状态印记组件。
   */
  private ensureMarks(entityId: EntityId): StatusMarksComponent {
    let marks = this.world.getComponent<StatusMarksComponent>(entityId, COMPONENT.StatusMarks);
    if (!marks) {
      // 标记组件按需创建，避免无状态玩家占用冗余存储。
      marks = new StatusMarksComponent();
      this.world.addComponent(entityId, COMPONENT.StatusMarks, marks);
    }
    return marks;
  }

  /**
   * 依据票数选出狼刀目标，平票按编号最小值决议。
   */
  private pickMajorityTarget(
    votes: Record<number, number>,
    strategy: TieBreakerStrategy,
  ): EntityId | null {
    const entries = Object.entries(votes);
    if (entries.length === 0) {
      return null;
    }
    entries.sort((a, b) => {
      const voteDiff = b[1] - a[1];
      if (voteDiff !== 0) {
        return voteDiff;
      }
      return Number(a[0]) - Number(b[0]);
    });
    if (entries.length >= 2 && entries[0][1] === entries[1][1]) {
      if (strategy === "no_kill") {
        return null;
      }
    }
    return Number(entries[0][0]);
  }
}
