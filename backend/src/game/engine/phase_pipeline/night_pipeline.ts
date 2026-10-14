/**
 * 负责：顺序执行夜间阶段、收集有来源的效果并准备黎明伤害。
 * 输入：当前 World、真实 RulePlan、阶段贡献和行动提供者；输出：原夜间摘要与死亡提案。
 * 原生策略和具体生命周期单位由同一计划装配；actor、目标、库存和原体资格仍现场查询。
 * 默认阶段固定成员及顺序，注入惰性来源在前一阶段提交后才拉取下一项。
 * 取消检查后，参数仍在首次 acquired 的原 World 参数位置绑定；改变参数不隐式重编译。
 * 来源元数据不授予资格；原 handler receiver 与 execute getter 保持晚读取。
 * 已捕获 day 原值交给伤害折叠，机械／觉醒／原毒 intent 单独保留来源及原体；
 * intent 元数据不进入夜间摘要、事件或 schema2，旧注入 claim 保持兼容。
 * 晚交接保留真实单位的 owned 状态和原失败前缀，result 与最终伤害仍在原已付效果之后准备。
 * 已提交重入准入交有限规则组合，在原婚约开夜之后检查；拒绝不撤销原已付效果，原 finally 仍收尾。
 * 明辉／梦及增益伤害与猎魔来源交付各归具名规则组合；本流水线保封存、伤害结算及死亡生命捕获的原检查点。
 * 运行梦句柄、猎魔 token 与晚保护闭包不进入玩家摘要或归档。
 */
import { attachNightUnit } from "../../../core/domain/night-unit";
import type { ReadonlyBoardConfig } from "@ai-werewolf-arena/game-contract";
import { prepareNightPipelineLifecycle, type NightLifecycleHandoff } from "../../../rulesets/night-lifecycle-plan";


import { assertNightSetupReady, assertNightReadable } from "../../../rulesets/night-readability";
import { RulePlan } from "../../../rulesets/rule-plan";
import { bindNightAbilityActorQuery } from "../../mechanisms/roles/night-ability-actors";
import { isFragrantPairBoard, fragrantAuthoritySnapshot } from "../../mechanisms/roles/fragrant_pair_seer/ports";
import { createNobleNightAbortReceiver, attachNobleNightReceiver, checkpointNobleBodyAuthority, isNobleBodyBoard } from "../../mechanisms/roles/noble_secret_body/ports";
import { animalAuthoritySnapshot } from "../../mechanisms/roles/animal_dream/ports";
import { isRadiantEclipseBoard } from "../../mechanisms/roles/radiant_eclipse/ports";
import { isScholarMentorBoard } from "../../mechanisms/roles/scholar_mentor/ports";
import { mistKnifeTargets, isMistRavenBoard } from "../../mechanisms/roles/mist_raven/ports";
import { assertNightModifierBonusEffects } from "../../../rulesets/night-damage-composition";
import { isTimeConsortBoard } from "../../mechanisms/roles/time_wolf_consort/ports";
import { isMagicianBoard } from "../../mechanisms/roles/magician/ports";
import { isRedMoonBoard } from "../../mechanisms/roles/demon_hunter/ports";
import {
  isNightmareBoard,
} from "../../mechanisms/roles/nightmare_shadow/ports";
import {
  isEvilKnightBoard,
  assertEvilKnightRosterCurrent,
  captureEvilKnightNightShotProtection,
} from "../../mechanisms/roles/evil_knight/ports";
import { demonHunterActorId, originalDemonNightLives } from "../../mechanisms/roles/demon_hunter/ports";
import type { DemonKnifeProtection } from "../../mechanisms/roles/demon_hunter/ports";
import { weddingSetup } from "../../mechanisms/roles/ghost_bride/ports";
import { COMPONENT } from "../../../core/domain/components/names";
import { RoleComponent } from "../../../core/domain/components/role";
import {
  StatusMarksComponent,
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
  DeathCause,
} from "../../../core/domain/model";
import {
  DamageResolutionResult,
  DamageResolutionSystem,
} from "../../../core/domain/systems/damage_resolution_system";
import { World } from "../../../core/domain/world";
import { ToolGateway } from "../../gateway/tool_gateway";
import { NightStageState } from "../../mechanisms";
import type { NightStageContext } from "../../mechanisms/stages/night/contracts";
import {
  getDefaultNightStageRegistry,
  NightStageRegistry,
} from "../../../rulesets/night-stage-plan";
import { getSessionRecorder } from "../../../recording/recording_context";
import { safeRecordLogicOp } from "../../../recording/session_recorder";
import { GameActionRequestFactory } from "../action_request_factory";
import { createRandom, shuffled, type RandomSource } from "../../../core/domain/random";
import type { DreamNightEffects } from "../../../core/domain/dream-night-effects";
import { composeNightDamage } from "../../../rulesets/night-damage-composition";
import { prepareNightSourceDelivery } from "../../../rulesets/night-source-delivery";
import { discardStaleNightKnives } from "../../../rulesets/night-knife-admission";
import { livingNightLife } from "../../../core/domain/night_effects";
import { AliveComponent, aliveLifeVersion } from "../../../core/domain/components/alive";
import { assertNightCommitAdmission } from "../../../rulesets/night-commit-admission";

export interface NightPipelineDependencies {
  readonly rulePlan?: RulePlan;
  world: World;
  toolGateway: ToolGateway;
  damageResolutionSystem: DamageResolutionSystem;
  events: GameEvent[];
  stageRegistry?: NightStageRegistry;
  random?: RandomSource;
}

export interface NightPipelineOptions {
  readonly lifecycleHandoff?: NightLifecycleHandoff;
  previousExile?: Readonly<ExileFeedback> | null;
  isCurrent?: () => boolean;
}
export type NightPipelineResult =
  | {
      interrupted: false;
      summary: NightSummary;
      damage: DamageResolutionResult;
      dreamFrame: DreamNightEffects;
      mistDelay?: boolean;
      demonSources?: object;
      retaliationAttacks?: readonly import("../../../core/domain/night_effects").NightRetaliationAttack[];
      /** 本族捕获的运行查询；不携带可替换 Map 或私有库存结构。 */
      blocksPassiveNightShot?: (targetId: EntityId) => boolean;
      inspectionAttacks?: readonly import("../../../core/domain/night_effects").NightInspectionAttack[];
      demonWolfSourceCurrent?: (targetId: number) => boolean;
      demonKnifeProtection?: DemonKnifeProtection;
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
  #rulePlan?: RulePlan;

  constructor(dependencies: NightPipelineDependencies) {
    this.world = dependencies.world;
    this.toolGateway = dependencies.toolGateway;
    this.damageResolutionSystem = dependencies.damageResolutionSystem;
    this.events = dependencies.events;
    this.stageRegistry = dependencies.stageRegistry ?? getDefaultNightStageRegistry();
    this.random = dependencies.random ?? createRandom();
    this.#rulePlan = dependencies.rulePlan;
  }

  /**
   * 执行完整夜间流程并返回结算摘要与伤害结果。
   */
  async execute(
    config: ReadonlyBoardConfig,
    actionProvider: ActionProvider,
    day: number,
    options: NightPipelineOptions = {},
  ): Promise<NightPipelineResult> {
    assertNightSetupReady({ world: () => this.world });
    const isCurrent = options.isCurrent ?? (() => true);
    if (!isCurrent())
      return attachNobleNightReceiver({ interrupted: true }, createNobleNightAbortReceiver());
    const pipeline = this;
    const prepare = this.#rulePlan
      ? this.#rulePlan.prepareNightPipelineLifecycle.bind(this.#rulePlan)
      : prepareNightPipelineLifecycle;
    const lifecycle = prepare(
      {
        get world() { return pipeline.world; },
        get events() { return pipeline.events; },
        get random() { return pipeline.random; },
      },
      config,
      day,
      () => options.lifecycleHandoff,
    );
    config = lifecycle.config;
    const rulePlan = this.#rulePlan ??= RulePlan.compile(lifecycle.parameters);
    const {
      ownsWedding, ownsDemon, ownsNoble, ownsFragrant, ownsAnimal, ownsRadiant, ownsMist,
      animalNight, fragrantNight, nobleNight, radiantNight, mistNight,
      weddingNight,
    } = lifecycle;
    try {
      lifecycle.open(isCurrent);
      // 归属保持本次生命周期的原值；World／config只在每个具体检查点晚读，不缓存玩家名单。
      const readability = {
        world: () => this.world,
        config: () => config,
        ownsAnimal: () => ownsAnimal,
        ownsFragrant: () => ownsFragrant,
        ownsNoble: () => ownsNoble,
        ownsRadiant: () => ownsRadiant,
        ownsMist: () => ownsMist,
        ownsDemon: () => ownsDemon,
      };
      const assertReadable = () => assertNightReadable(readability);
      assertReadable();
      const nativeProvider =
        ownsAnimal ||
        ownsRadiant ||
        ownsMist ||
        ownsDemon ||
        isEvilKnightBoard(this.world) ||
        isNightmareBoard(this.world) ||
        config.magician !== undefined ||
        config.scholarMentor !== undefined
          ? {
              getAction: async (request: ActionRequest) => {
                assertReadable();
                const action = await actionProvider.getAction(request);
                assertReadable();
                return action;
              },
            }
          : actionProvider;
      if (ownsWedding) weddingNight.open(day, isCurrent);
      // 保原同步检查点：若有婚约，已完成原开夜；起始记录和阶段状态尚未建立，拒绝仍走原 finally。
      assertNightCommitAdmission({ world: () => this.world, day: () => day });
      safeRecordLogicOp({
        scope: "phase_pipeline",
        op: "night_pipeline_start",
        phase: Phase.Night,
        status: "ok",
        input: {
          board_size: config.boardSize,
        },
      });

      // 摄梦关系由本族按此对象身份首次使用时建立；通用状态不保存私有数组或其镜像。
      const stageState: NightStageState = {
        wolfChatOrder: [],
        endedWolves: new Set<EntityId>(),
        wolfVotes: {},
        wolfTarget: null,
        seerChecks: [],
        poisonClaims: [],
        guardClaims: [],
        merchantBacklashes: [],
        blackMarketBacklashes: [],
        mechanicalEffects: { shields: [], attacks: [], failures: [] },
        awakenedEffects: { shields: [], attacks: [] },
      };

      const requests = new GameActionRequestFactory(this.world, this.events, day);
      const stageCtx: NightStageContext = {
        isCurrent,
        previousExile: options.previousExile ? structuredClone(options.previousExile) : null,
        world: this.world,
        get nightActors() {
          return bindNightAbilityActorQuery(this.world);
        },
        get nativeNightFailure() {
          return rulePlan.nativeNightFailure(() => this.world);
        },
        get nativeNightTargets() {
          return rulePlan.nativeNightTargets(() => this);
        },
        get nativeNightEffects() {
          return rulePlan.nativeNightEffects(() => this);
        },
        roleCatalog: this.stageRegistry.roleCatalog,
        toolGateway: this.toolGateway,
        events: this.events,
        actionProvider: nativeProvider,
        currentDay: () => day,
        // 只提供晚类读取；机制仍在各自原 new 点使用原 World／events／day 参数。
        get requestFactory() { return GameActionRequestFactory; },
        makeRequest: (
          actorId: EntityId,
          allowedTools: ActionRequest["allowedTools"],
          context: ActionRequestExtras & { stage: ActionStage; requiresAction?: boolean },
        ) => this.makeRequest(requests, actorId, allowedTools, context),
        getAliveByRole: (role: Role) => this.getAliveByRole(role),
        ensureMarks: (entityId: EntityId) => this.ensureMarks(entityId),
        pickMajorityTarget: (votes: Record<number, number>) =>
          this.pickMajorityTarget(votes, config.tieBreaker?.wolfKillVote ?? "min_id"),
        pickMistKnife: (ids: readonly EntityId[]) =>
          ids.length
            ? ids[Math.floor(this.random.fork(`day:${day}:mist-knife`).next() * ids.length)]!
            : null,
        shuffleWolves: (ids: EntityId[]) =>
          shuffled(ids, this.random.fork(`day:${day}:wolf-order`)),
        state: stageState,
      };

      // 同一运行输入只持延迟表达式；各检查点按原次序读取 World／state、婚约归属和日期。
      const knifeAdmission = {
        world: () => this.world,
        state: () => stageState,
        ownsWedding: () => ownsWedding,
        day: () => day,
      };

      for (const entry of rulePlan.nightPlan(this.stageRegistry, () => this.world).entries) {
        const stage = entry.handler;
        assertEvilKnightRosterCurrent(this.world);
        if (!isCurrent())
          return attachNightUnit(attachNobleNightReceiver({ interrupted: true }, nobleNight.receiver), lifecycle.nightUnit);
        assertReadable();
        discardStaleNightKnives(knifeAdmission);
        assertNightModifierBonusEffects({ config: () => config, stageContext: () => stageCtx });
        await stage.execute(stageCtx);
        assertNightModifierBonusEffects({ config: () => config, stageContext: () => stageCtx });
        assertEvilKnightRosterCurrent(this.world);
        assertReadable();
        if (!isCurrent())
          return attachNightUnit(attachNobleNightReceiver({ interrupted: true }, nobleNight.receiver), lifecycle.nightUnit);
        discardStaleNightKnives(knifeAdmission);
      }

      discardStaleNightKnives(knifeAdmission);
      const { demonSources, demonWolfSourceCurrent, demonKnifeProtection } = prepareNightSourceDelivery({
        ownsDemon: () => ownsDemon,
        world: () => this.world,
        day: () => day,
        claims: () => stageState,
      });
      const { dreamFrame, damage } = composeNightDamage({
        ownsRadiant: () => ownsRadiant,
        world: () => this.world,
        day: () => day,
        claims: () => stageState,
        config: () => config,
        stageContext: () => stageCtx,
        solver: () => this.damageResolutionSystem,
        aliveByRole: (role) => this.getAliveByRole(role()),
      });
      if (ownsNoble) {
        const payload = {
          policy: "awa_noble_secret_body_v1" as const,
          actorId: checkpointNobleBodyAuthority(this.world, false).bodyId,
          day,
        };
        this.events.push({
          timestamp: Date.now(),
          type: "noble_body_native_damage_committed",
          payload,
          audience: Object.freeze([]),
        });
        getSessionRecorder()?.recordRequiredLogicOp({
          scope: "resolution",
          op: "noble_body_native_damage_committed",
          phase: Phase.Night,
          status: "ok",
          output: payload,
        });
      }
      assertReadable();
      for (const reflection of damage.poisonReflections ?? [])
        this.events.push({
          timestamp: Date.now(),
          type: "mechanical_poison_reflected",
          payload: { ...reflection, day },
        });
      const mist = ownsMist
        ? mistNight.captureDamage(this.world, day, stageState.wolfTarget)
        : null;
      if (mist?.extra && livingNightLife(this.world, mist.extra)) {
        const id = mist.extra.id;
        if (!damage.deaths.includes(id)) damage.deaths.push(id);
        damage.deathSources[id] = [
          ...new Set([...(damage.deathSources[id] ?? []), DeathCause.RavenClawKnife]),
        ];
      }
      if (!mist?.delayEligible) dreamFrame.expandInitialDamage(this.world, damage);
      if (!mist?.delayEligible && !ownsNoble)
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
            (mist?.delayEligible ? this.world.getAliveEntityIds() : damage.deaths).map((id) => {
              const life = this.world.getComponent(id, COMPONENT.Alive)!;
              return [id, { life, version: aliveLifeVersion(life) }] as const;
            }),
          );
      lifecycle.finishPipeline();
      return attachNightUnit(attachNobleNightReceiver(
        {
          interrupted: false,
          summary,
          damage,
          dreamFrame,
          ...(mist ? { mistDelay: mist.delayEligible } : {}),
          deathLives,
          retaliationAttacks: stageState.retaliationAttacks,
          blocksPassiveNightShot: captureEvilKnightNightShotProtection(stageState),
          inspectionAttacks: stageState.inspectionAttacks,
          foxInspections: stageState.foxInspections,
          ...(demonSources ? { demonSources, demonWolfSourceCurrent, demonKnifeProtection } : {}),
        },
        nobleNight.receiver,
      ), lifecycle.nightUnit);
    } finally {
      lifecycle.abortPipeline();
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
        ...(isMistRavenBoard(this.world) &&
        (allowedTools.includes("kill_vote") || allowedTools.includes("speak_to_wolves"))
          ? { wolf_kill_candidates: mistKnifeTargets(this.world) ?? this.world.getAliveEntityIds() }
          : {}),
        ...((isFragrantPairBoard(this.world) &&
          (allowedTools.includes("kill_vote") || allowedTools.includes("speak_to_wolves"))) ||
        isNobleBodyBoard(this.world) ||
        isRadiantEclipseBoard(this.world) ||
        isMistRavenBoard(this.world) ||
        isScholarMentorBoard(this.world) ||
        isTimeConsortBoard(this.world) ||
        isMagicianBoard(this.world) ||
        isEvilKnightBoard(this.world) ||
        isNightmareBoard(this.world) ||
        isRedMoonBoard(this.world)
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
      const roleComp = this.world.getComponent(id, COMPONENT.Role);
      return roleComp?.role === role;
    });
  }

  /**
   * 获取或创建目标玩家的状态印记组件。
   */
  private ensureMarks(entityId: EntityId): StatusMarksComponent {
    let marks = this.world.getComponent(entityId, COMPONENT.StatusMarks);
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
