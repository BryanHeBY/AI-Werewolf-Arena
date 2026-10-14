/**
 * 负责：拥有对局阶段时钟、真实死亡/胜负提交与一次执行的 RulePlan。
 * 输入：World、只读配置、原 gateway/registry/RNG；输出：原阶段快照、事件和封盘结果。
 * 与流水线、开局上下文及记录入口共享同一 BoardParameters/RulePlan 引用；
 * 每夜仍创建独立生命周期 receiver，沿原 current 检查和重复 finally 消费同一已交接单位。
 * 计划中的具名 checkpoint 只提供原值；同步重入准入由同一计划组合，
 * 首夜四个准备窗口由具名规则组合串行推进，日期／当前性回调及中断快照仍归本经理；
 * 雾鸦延迟夜的原体检查与反应准备归具名同步序列；本经理持唯一 pending、原两次 await，
 * 公开夜报、真实死亡提交、周期时钟、判胜及失败清理仍归本经理。
 * 终局候选规则只选择配置、改写狐狸候选并校验婚约／成员；原评估点、故障核对与唯一封盘写入仍归本经理。
 * 放逐名单／来源和反馈门控归具体规则组合；动物板先标死后反馈，普通板先捕获后死亡，原 await 与提交仍在这里。
 * 狼美人候选和屠边覆盖归具名组合，原两处捕获／评估点、配置首命中顺序和唯一封盘仍由本经理推进。
 * 熊夜前采样与黎明知识发布归具名同步组合；本经理保原阶段、await／当前性和发布之后的判胜。
 * 动物单元关闭→快照→完成事实归本族发布owner；四原调用点的守卫、死亡await、反馈和判胜仍在这里。
 * 赤月到期查询、候选和提交发布归具名同步序列；本经理保原追加死亡等待、复验、夜报及唯一封盘。
 */
import { openExileUnit, exileUnitOf, type ExileUnit } from "../../core/domain/exile-unit";
import { nightUnitOf } from "../../core/domain/night-unit";
import { PhaseRevisionClock } from "./phase-revision";
import { damagePoisonRoutes } from "../../core/domain/damage-evidence";
import type { DeathCommitReceipt, DeathOriginalLife } from "./death-wave";
import type { DamageResolutionResult } from "../../core/domain/systems/damage_resolution_system";
import type { ReadonlyBoardConfig } from "@ai-werewolf-arena/game-contract";
import { NightManagerLifecycle } from "../../rulesets/night-lifecycle-plan";
import { prepareGameSetup } from "../../rulesets/game-setup";
import { prepareSpecialNightDamage } from "../../rulesets/special-night-damage-preparation";

import { bindBoardParameters } from "../../rulesets/board-parameters";
import { RulePlan } from "../../rulesets/rule-plan";
import {
  checkpointNobleBodyAuthority,
} from "../mechanisms/roles/noble_secret_body/ports";

import { prepareMistDelayedNight, settleMistDelayedNight, type MistPreparedNightDamage } from "../../rulesets/mist-delayed-night-settlement";

import {
  demonHunterActorId,
  assertDemonOriginalRoster,
  assertDemonNightReadable,
} from "../mechanisms/roles/demon_hunter/ports";
import { demonWitchMarksSafe } from "../mechanisms/roles/demon_hunter/ports";
import {
  weddingSetup,
} from "../mechanisms/roles/ghost_bride/ports";
import { publishInitialIdentityDeal } from "../mechanisms/roles/initial_identity/ports";
import { WallNotesWindow } from "../mechanisms/events/wall_notes/window";
import { GameActionRequestFactory } from "./action_request_factory";
import { TERMINAL_VICTORY_POLICY } from "../../rulesets/terminal-victory-policy";
import { settleRedMoonExpiry } from "../../rulesets/red-moon-expiry-settlement";
import type { VictoryCheckpoint } from "@ai-werewolf-arena/game-contract";
import { text } from "@ai-werewolf-arena/game-text";
import { NightFaultPlan, type FaultPlan } from "./fault_plan";
import { getSessionRecorder } from "../../recording/recording_context";
import { safeRecordLogicOp } from "../../recording/session_recorder";
import {
  ActionProvider,
  ActionWindow,
  BoardConfig,
  EntityId,
  GameEvent,
  ExileFeedback,
  GameResult,
  type WinDecision,
  Camp,
  Phase,
  RuntimeSnapshot,
  DeathCause,
  type DeathSources,
  WinCondition,
} from "../../core/domain/model";
import { ConditionRegistry } from "../../core/domain/registries/condition_registry";
import { DamageResolutionSystem } from "../../core/domain/systems/damage_resolution_system";
import { World } from "../../core/domain/world";
import { ToolGateway } from "../gateway/tool_gateway";
import { findSheriffId } from "../mechanisms/sheriff/badge";
import { DeathResolution } from "./death_resolution";
import { EventRegistry } from "./event_registry";
import { DayPipeline } from "./phase_pipeline/day_pipeline";
import { NightPipeline } from "./phase_pipeline/night_pipeline";
import { installFragrantPairAuthority } from "../mechanisms/roles/fragrant_pair_seer/authority";
import { Role } from "../../core/domain/identity";
import { VotingPipeline } from "./phase_pipeline/voting_pipeline";
import { RoleRegistry } from "../../core/domain/registries/role_registry";
import { COMPONENT } from "../../core/domain/components/names";
import { commitSelfDestructSelection } from "../mechanisms/self_destruct/commit";
import { commitKnightDuel } from "../mechanisms/roles/knight/commit";
import { prepareAnimalExileDeaths, captureAnimalExileFeedback, captureOrdinaryExileFeedback, prepareOrdinaryExileDeaths } from "../../rulesets/exile-death-preparation";
import {
  prepareBeautyExileVictory,
  resolveBeautyExileVictory,
  beautyExileVictoryOverrides,
  type BeautyExileCandidate,
} from "../../rulesets/beauty-exile-victory";
import { captureDawnKnowledge, publishDawnKnowledge } from "../../rulesets/dawn-knowledge-publication";
import type { AliveComponent } from "../../core/domain/components/alive";
import {
  beginAnimalExileUnit,
  prepareAnimalCatExpiry,
  completeAndPublishAnimalExileUnit,
  animalPufferReaction,
} from "../mechanisms/roles/animal_dream/ports";
import { aliveLifeVersion } from "../../core/domain/components/alive";
import { VotingRightComponent } from "../../core/domain/components/voting_right";
import { IdentityComponent } from "../../core/domain/entities/player";
import { RoleComponent } from "../../core/domain/components/role";
import { createRandom, type RandomSource } from "../../core/domain/random";

/**
 * PhaseManager 是游戏引擎的时序中枢。
 * 负责串行驱动夜晚/白天/投票，并在每个阶段后执行死亡钩子与胜负裁决。
 */
export class PhaseManager {
  readonly #rulePlan: RulePlan;
  private readonly config: ReadonlyBoardConfig;
  private readonly events: GameEvent[] = [];
  private readonly eventRegistry: EventRegistry;
  private readonly nightPipeline: NightPipeline;
  private readonly dayPipeline: DayPipeline;
  private readonly votingPipeline: VotingPipeline;
  private readonly deathResolution: DeathResolution;
  private previousExile: ExileFeedback | null = null;
  // 修订号唯一归此实例；正常同阶段不推进，debug 撤销与真实变化仍可分别推进。
  private readonly phaseRevision = new PhaseRevisionClock();
  // 唯一待处理实例仍归经理字段；本族序列不保存镜像，旧读取也观察同一实例。
  private mistPending: ReturnType<typeof prepareMistDelayedNight> | null = null;
  private readonly nightFaultPlan?: NightFaultPlan;

  private state: RuntimeSnapshot = {
    day: 1,
    phase: Phase.Night,
    gameOver: false,
    result: null,
  };

  constructor(
    private readonly world: World,
    config: ReadonlyBoardConfig,
    private readonly toolGateway: ToolGateway,
    private readonly roleRegistry: RoleRegistry,
    private readonly conditionRegistry: ConditionRegistry,
    private readonly damageResolutionSystem: DamageResolutionSystem,
    private readonly random: RandomSource = createRandom(),
    options: { faultPlan?: unknown } = {},
  ) {
    const parameters = bindBoardParameters(world, config);
    config = parameters.board;
    this.#rulePlan = RulePlan.compile(parameters);
    this.config = config;
    if (config.fragrantPairSeer)
      installFragrantPairAuthority(
        world,
        this.events,
        world.getEntityIdsByRole(Role.FragrantPhantom)[0]!,
        world.getEntityIdsByRole(Role.AwakenedSeer)[0]!,
      );
    if (options.faultPlan !== undefined) {
      if (demonHunterActorId(world) === null) throw new Error("fault_plan_demon_board_required");
      this.nightFaultPlan = new NightFaultPlan(world, options.faultPlan);
    }
    this.eventRegistry = new EventRegistry();
    this.deathResolution = new DeathResolution(
      world,
      this.events,
      toolGateway,
      this.eventRegistry,
      this.state,
      config,
    );
    this.nightPipeline = new NightPipeline({
      rulePlan: this.#rulePlan,
      world,
      toolGateway,
      damageResolutionSystem,
      events: this.events,
      random: random.fork("night"),
    });
    this.dayPipeline = new DayPipeline({
      world,
      roleRegistry,
      toolGateway,
      events: this.events,
    });
    this.votingPipeline = new VotingPipeline({
      world,
      roleRegistry,
      toolGateway,
      eventRegistry: this.eventRegistry,
      events: this.events,
    });
    // 仅上帝可见：开局完整牌面信息（玩家身份与阵营映射）。
    this.events.push({
      timestamp: Date.now(),
      type: "god_private_game_info",
      payload: {
        boardSize: this.config.boardSize,
        players: this.world.getAliveEntityIds().map((id) => {
          const identity = this.world.getComponent(id, COMPONENT.Identity);
          const role = this.world.getComponent(id, COMPONENT.Role);
          return {
            id,
            seat: identity?.seat ?? id,
            name: identity?.name ?? text(this.world.locale, "common.player_name", { id }),
            role: role?.role ?? "unknown",
            camp: role?.camp ?? "unknown",
          };
        }),
      },
    });
    // 仅发布原整副公共牌组；各运行引用晚读，前面的私密牌表与后续阶段广播顺序不变。
    publishInitialIdentityDeal({
      world: () => this.world,
      events: () => this.events,
      boardSize: () => this.config.boardSize,
    });
    // 初始阶段也写入上帝公开广播，确保首轮请求前玩家可见当前阶段。
    this.events.push({
      timestamp: Date.now(),
      type: "phase_changed",
      payload: {
        phase: Phase.Night,
        day: this.state.day,
      },
    });
    const initialSheriffId = findSheriffId(this.world);
    // 只派发原检查点；每个贡献仍在原参数位置读取 World、事件与当前日期。
    this.#rulePlan.wolfKnifeInheritance({
      world: () => this.world,
      events: () => this.events,
      day: () => this.state.day,
    });
    if (initialSheriffId !== null) {
      this.events.push({
        timestamp: Date.now(),
        type: "sheriff_elected",
        payload: {
          winnerId: initialSheriffId,
          source: "initial_configuration",
        },
      });
    }
  }

  /** 获取不可变的离线故障输入；它与板子参数、已记录的取消事实分别持有。 */
  getFaultPlan(): FaultPlan | undefined {
    return this.nightFaultPlan?.plan;
  }

  assertFaultPlanConsumed(): void {
    this.nightFaultPlan?.assertConsumed();
  }

  /** 脱离克隆当前运行状态和完整结果数据，调用方不能通过快照修改内部胜利成员。 */
  getSnapshot(): RuntimeSnapshot {
    return structuredClone(this.state);
  }

  /** 获取脱离克隆的累计事件；历史 audience 数组在副本中保持冻结。 */
  getEvents(): GameEvent[] {
    return this.events.map((event) => {
      const copy = structuredClone(event);
      if ("audience" in copy) Object.freeze(copy.audience);
      return copy;
    });
  }

  /**
   * 手动跳转阶段（主要用于中断流程控制）。
   */
  jumpTo(phase: Phase): void {
    if (
      this.config.mistRaven &&
      !this.state.gameOver &&
      this.pureWhiteStartedDays.has(this.state.day)
    )
      throw new Error("mist_phase_reentry");
    // 雾鸦周期登记先行；其余机制通过后才推进原阶段时钟，拒绝不改变时钟。
    const manager = this;
    this.#rulePlan.phaseJumpAdmission({
      get world() { return manager.world; },
      get state() { return manager.state; },
    });
    this.phaseRevision.advance();
    this.setPhase(phase);
  }

  private readonly pureWhiteStartedDays = new Set<number>();

  async runSingleCycle(
    actionProvider: ActionProvider,
    maxDays: number = 20,
  ): Promise<RuntimeSnapshot> {
    if (
      (this.config.animalDream ||
        this.config.fragrantPairSeer ||
        this.config.mistRaven ||
        this.config.pureWhite ||
        this.config.evilKnight ||
        this.config.magician) &&
      !this.state.gameOver
    ) {
      if (this.pureWhiteStartedDays.has(this.state.day))
        throw new Error(
          this.config.animalDream
            ? "animal_cycle_reentry"
            : this.config.fragrantPairSeer
              ? "fragrant_cycle_reentry"
              : this.config.mistRaven
                ? "mist_cycle_reentry"
                : this.config.magician
                  ? "magician_cycle_reentry"
                  : this.config.evilKnight
                    ? "evil_knight_cycle_reentry"
                    : "pure_white_cycle_reentry",
        );
      this.pureWhiteStartedDays.add(this.state.day);
    }
    const startedDay = this.state.day;
    const manager = this;
    const lifecycle = this.#rulePlan.createNightManagerLifecycle({
      get world() {
        return manager.world;
      },
      get config() {
        return manager.config;
      },
      abortMistPending() {
        manager.mistPending?.abort();
      },
    });
    let completed = false;
    try {
      const result = await this.runSingleCycleInternal(actionProvider, maxDays, lifecycle);
      completed = this.state.gameOver || this.state.day > startedDay;
      return result;
    } catch (error) {
      lifecycle.abortOnError();
      throw error;
    } finally {
      lifecycle.abortCycle(completed);
    }
  }

  private async runSingleCycleInternal(
    actionProvider: ActionProvider,
    maxDays: number = 20,
    lifecycle: NightManagerLifecycle,
  ): Promise<RuntimeSnapshot> {
    // 不收集状态快照：每个原谓词仍在原参数位置读取 World、gameOver 和日期。
    const manager = this;
    this.#rulePlan.cycleAdmission({
      get world() { return manager.world; },
      get state() { return manager.state; },
    });
    if (this.state.gameOver) {
      return this.getSnapshot();
    }
    if (demonHunterActorId(this.world) !== null) {
      const underlying = actionProvider;
      const assertReadable = () => this.assertDemonReadable();
      actionProvider = {
        getAction: async (request) => {
          assertReadable();
          const action = await underlying.getAction(request);
          assertReadable();
          return action;
        },
      };
    }

    if (this.state.day > maxDays) {
      this.sealResult(
        { winner: null, reason: "max_days_reached", outcome: { kind: "no_winner" } },
        this.#rulePlan.checkpoints.maxDays,
        Phase.Night,
      );
      return this.getSnapshot();
    }

    this.setPhase(Phase.Night);
    if (this.config.mistRaven) {
      this.mistPending?.abort();
      this.mistPending = null;
    }
    const nightDay = this.state.day,
      nightRevision = this.phaseRevision.current;
    const nightIsCurrent = () =>
      this.state.day === nightDay &&
      this.state.phase === Phase.Night &&
      !this.state.gameOver &&
      this.phaseRevision.current === nightRevision;
    const setupSequence = prepareGameSetup({
      world: () => this.world,
      toolGateway: () => this.toolGateway,
      events: () => this.events,
      config: () => this.config,
    }, actionProvider, nightDay, nightIsCurrent);
    let setupStep = setupSequence.next();
    // 只等待原窗口的 execute；四项都已就绪时不让出微任务，阶段当前性也不额外查询。
    while (!setupStep.done) setupStep = setupSequence.next(await setupStep.value);
    if (!setupStep.value) return this.getSnapshot();
    assertDemonOriginalRoster(this.world);
    // 夜前只捕获同一熊 frame；原 World／policy 读取保持晚读，不提前发表或授予许可。
    const bearFrame = captureDawnKnowledge({
      world: () => this.world,
      signalPolicy: () => this.config.bear?.signalPolicy,
    }, nightDay);
    const night = await this.nightPipeline.execute(this.config, actionProvider, this.state.day, {
      previousExile: this.previousExile,
      isCurrent: nightIsCurrent,
      lifecycleHandoff: lifecycle,
    });
    if (night.interrupted || !nightIsCurrent()) {
      lifecycle.abortSpecialNight(night, nightDay);
      return this.getSnapshot();
    }
    const ownsWedding = weddingSetup(this.world) !== null;
    const ownsDemon = demonHunterActorId(this.world) !== null;
    const ownsPureWhite = this.config.pureWhite !== undefined;
    const ownsEvilKnight = this.config.evilKnight !== undefined;
    if (ownsWedding || ownsDemon || ownsPureWhite || ownsEvilKnight) {
      try {
        const { deaths, sources, originalLives, sourceDamage, livingBeforeChain } = prepareSpecialNightDamage(
          {
            get world() { return manager.world; },
            get config() { return manager.config; },
            get events() { return manager.events; },
            get nightFaultPlan() { return manager.nightFaultPlan; },
            assertReadable() { manager.assertDemonReadable(); },
          },
          night,
          nightDay,
          ownsWedding,
          ownsDemon,
          lifecycle,
        );
        await this.deathResolution.resolve(
          deaths,
          sources,
          actionProvider,
          Phase.Night,
          Phase.Night,
          {},
          {
            nightOriginIds: deaths,
            isCurrent: nightIsCurrent,
            originalLives,
            poisonRoutes: damagePoisonRoutes(sourceDamage!),
            execution: { night: nightUnitOf(night), phaseRevision: nightRevision },
            // 在原夜枪检查点晚读结果查询；本族闭包保同一 Map 与原体／政策顺序，不重抓 World。
            blocksPassiveNightShot: (id) => night.blocksPassiveNightShot?.(id) ?? false,
          },
        );
        this.assertDemonReadable();
        if (!nightIsCurrent()) return this.getSnapshot();
        const expirySettlement = settleRedMoonExpiry({
          get world() { return manager.world; },
          get events() { return manager.events; },
          get registry() { return manager.conditionRegistry; },
          get config() { return manager.config; },
          get checkpoint() { return manager.#rulePlan.checkpoints.nightSettled; },
        }, ownsDemon, nightDay);
        const expiryStep = expirySettlement.next();
        let beforeExpiryResult = expiryStep.done ? expiryStep.value : null;
        if (!expiryStep.done) {
          const expiryActor = expiryStep.value;
          await this.deathResolution.resolve(
            [expiryActor],
            { [expiryActor]: [DeathCause.RedMoonExpiry] },
            actionProvider,
            Phase.Night,
            Phase.Night,
            {},
            { nightOriginIds: [expiryActor], isCurrent: nightIsCurrent, execution: { night: nightUnitOf(night), phaseRevision: nightRevision } },
          );
          this.assertDemonReadable();
          if (!nightIsCurrent()) return this.getSnapshot();
          // 只有原死亡等待、可读性及当前性均成功，才恢复到期提交和事实发布；失败不补跑。
          beforeExpiryResult = expirySettlement.next().value as WinDecision | null;
        }
        const completeDeaths = [
          ...deaths,
          ...[...livingBeforeChain]
            .filter(
              ([id, scope]) =>
                !deaths.includes(id) &&
                this.world.getComponent(id, COMPONENT.Alive) === scope.life &&
                !scope.life.alive &&
                aliveLifeVersion(scope.life) === scope.version! + 1,
            )
            .map(([id]) => id),
        ];
        this.emitNightResolved(completeDeaths);
        if (beforeExpiryResult) {
          this.sealResult(
            TERMINAL_VICTORY_POLICY.replaceFactionResult(this.world, beforeExpiryResult),
            this.#rulePlan.checkpoints.nightSettled,
            this.state.phase,
          );
          return this.getSnapshot();
        }
        if (this.checkAndSealResult(this.#rulePlan.checkpoints.nightSettled))
          return this.getSnapshot();
      } finally {
        lifecycle.abortSpecialNight(night, nightDay);
      }
    }
    const firstDaySheriffBeforeNightInfo =
      !ownsWedding &&
      !ownsDemon &&
      !ownsPureWhite &&
      !ownsEvilKnight &&
      this.state.day === 1 &&
      this.config.enableSheriff === true;

    this.setPhase(Phase.Day);
    const cycleDay = this.state.day,
      dayRevision = this.phaseRevision.current;
    const dayIsCurrent = () =>
      this.state.day === cycleDay &&
      this.state.phase === Phase.Day &&
      !this.state.gameOver &&
      this.phaseRevision.current === dayRevision;
    let nightSettled = ownsWedding || ownsDemon || ownsPureWhite || ownsEvilKnight;
    if (night.mistDelay) {
      this.mistPending = prepareMistDelayedNight({
        get world() { return manager.world; },
        get cycleDay() { return cycleDay; },
        get night() { return night; },
      });
    }
    const settleMist = async (alreadyClaimed = false, interrupted = false): Promise<boolean> => {
      if (nightSettled) return this.state.gameOver;
      const settlement = settleMistDelayedNight({
        get pending() { return manager.mistPending; },
        get world() { return manager.world; },
        get events() { return manager.events; },
        get toolGateway() { return manager.toolGateway; },
        get lifecycle() { return lifecycle; },
        get cycleDay() { return cycleDay; },
      }, actionProvider, dayIsCurrent, alreadyClaimed);
      // 两个协议位置固定：第一次只有原蛇 Promise，第二次交原伤害和同一 current 闭包。
      const healed = await (settlement.next().value as Promise<number | null>);
      const { damage, current } = settlement.next(healed).value as MistPreparedNightDamage;
      this.emitNightResolved(damage.deaths);
      await this.deathResolution.resolve(
        damage.deaths,
        damage.deathSources,
        actionProvider,
        Phase.Night,
        Phase.Day,
        {},
        {
          dreams: night.dreamFrame,
          nightOriginIds: damage.deaths,
          isCurrent: current,
          poisonRoutes: damagePoisonRoutes(damage),
          execution: { night: nightUnitOf(night), phaseRevision: dayRevision },
        },
      );
      // 仅真实死亡 resolve 成功后恢复完成段；抛错不 finish／正常 close，外层仍按原路径 abort。
      settlement.next();
      nightSettled = true;
      return this.checkAndSealResult(
        interrupted
          ? this.#rulePlan.checkpoints.dayInterrupted
          : this.#rulePlan.checkpoints.nightSettled,
      );
    };
    const settleNight = async (
      blast?: { deaths: number[]; sources: DeathSources },
      animalSkip?: object,
      skippedUnit?: ExileUnit,
    ) => {
      if (nightSettled) return this.state.gameOver;
      nightSettled = true;
      let sourceDamage: DamageResolutionResult;
      let originalLives: ReadonlyMap<EntityId, DeathOriginalLife> | undefined;
      const retainedSources: DeathSources = Object.fromEntries(
        (sourceDamage = night.damage).deaths.map((id) => [
          id,
          (night.damage.deathSources[id] ?? []).filter(
            (source) =>
              source !== DeathCause.FoxInspection ||
              night.foxInspections?.some(
                (claim) => claim.target.id === id && claim.isTargetCurrent(),
              ),
          ),
        ]),
      );
      const nightDeaths = night.damage.deaths.filter((id) => {
        const scope = (originalLives = night.deathLives).get(id);
        return (
          scope &&
          retainedSources[id]?.length &&
          this.world.getComponent(id, COMPONENT.Alive) === scope.life &&
          scope.life.alive &&
          scope.version !== undefined &&
          aliveLifeVersion(scope.life) === scope.version
        );
      });
      if (!this.config.fragrantPairSeer && !this.config.animalDream)
        this.emitNightResolved(nightDeaths);
      const sources: DeathSources = Object.fromEntries(
        nightDeaths.map((id) => [id, [...(retainedSources[id] ?? [])]]),
      );
      const deaths = [...nightDeaths];
      const deathPhases: Record<EntityId, Phase> = {};
      if (blast !== undefined) {
        for (const id of blast.deaths) {
          if (!deaths.includes(id)) deaths.push(id);
          sources[id] = [...new Set([...(sources[id] ?? []), ...(blast.sources[id] ?? [])])];
          deathPhases[id] = Phase.Day;
        }
      }
      try {
        await this.deathResolution.resolve(
          deaths,
          sources,
          actionProvider,
          Phase.Night,
          Phase.Day,
          deathPhases,
          {
            dreams: night.dreamFrame,
            nightOriginIds: nightDeaths,
            isCurrent: dayIsCurrent,
            originalLives,
            poisonRoutes: damagePoisonRoutes(sourceDamage!),
            execution: { night: nightUnitOf(night), exile: skippedUnit, phaseRevision: dayRevision },
            ...(animalSkip ? { animalUnit: animalSkip } : {}),
            ...(this.config.fragrantPairSeer || this.config.animalDream
              ? {
                  onInitialWaveCommitted: (
                    actualIds: readonly number[],
                    actualSources: DeathSources | undefined,
                    receipt: DeathCommitReceipt,
                  ) => {
                    const event = this.emitNightResolved(
                      this.config.animalDream
                        ? nightDeaths.filter(
                            (id) =>
                              actualIds.includes(id) &&
                              (retainedSources[id] ?? []).some((c) =>
                                (actualSources?.[id] ?? []).includes(c),
                              ),
                          )
                        : nightDeaths,
                    );
                    // 只关联真正的公开事件；不以凭证缺项更改原 Animal／双生 pending 筛选。
                    receipt.recordPublication(event, actualIds);
                    return event;
                  },
                }
              : {}),
          },
        );
        lifecycle.finishDay(cycleDay, dayIsCurrent);
      } finally {
        lifecycle.abortInner();
      }
      if (!dayIsCurrent()) return this.state.gameOver;
      if (animalSkip) {
        completeAndPublishAnimalExileUnit({
          world: () => this.world,
          events: () => this.events,
          day: () => cycleDay,
        }, () => animalSkip!);
      }
      // 原死亡波／清理和当前性之后，串行发表熊→Animal 知识→Beauty 通知，再进入原判胜。
      publishDawnKnowledge(bearFrame, {
        world: () => this.world,
        events: () => this.events,
        animalDream: () => this.config.animalDream,
      }, cycleDay, dayIsCurrent);
      return this.checkAndSealResult(
        blast !== undefined
          ? this.#rulePlan.checkpoints.dayInterrupted
          : this.#rulePlan.checkpoints.nightSettled,
      );
    };
    if (!night.mistDelay && !firstDaySheriffBeforeNightInfo && (await settleNight()))
      return this.getSnapshot();

    const dayResult = await this.dayPipeline.execute(this.config, actionProvider, {
      day: cycleDay,
      isCurrent: dayIsCurrent,
      commitSelfDestruct: async (choice, window) => {
        if (!dayIsCurrent()) return false;
        // 尚未发表的夜间信息继续保密；已注定死亡的白狼王不能用此技能吞掉自身死亡。
        if (
          !nightSettled &&
          choice.kind === "white_wolf_king" &&
          night.damage.deaths.includes(choice.actorId)
        )
          return false;
        const blast = commitSelfDestructSelection(
          this.world,
          choice,
          window,
          Phase.Day,
          this.events,
        );
        if (!blast) return false;
        const animalSkip = this.config.animalDream
          ? beginAnimalExileUnit(this.world, cycleDay, "skipped_day", dayIsCurrent)
          : undefined;
        const skippedUnit = openExileUnit(cycleDay, "skipped_day", animalSkip);
        if (!nightSettled && this.mistPending) {
          this.mistPending.claim(dayIsCurrent);
          await this.deathResolution.resolve(
            blast.deaths,
            blast.sources,
            actionProvider,
            Phase.Day,
            Phase.Day,
            {},
            { isCurrent: dayIsCurrent, execution: { exile: skippedUnit, phaseRevision: dayRevision } },
          );
          if (dayIsCurrent()) await settleMist(true, true);
        } else if (!nightSettled) await settleNight(blast, animalSkip, skippedUnit);
        else {
          await this.deathResolution.resolve(
            blast.deaths,
            blast.sources,
            actionProvider,
            Phase.Day,
            Phase.Day,
            {},
            { isCurrent: dayIsCurrent, execution: { exile: skippedUnit, phaseRevision: dayRevision }, ...(animalSkip ? { animalUnit: animalSkip } : {}) },
          );
          if (animalSkip) {
            completeAndPublishAnimalExileUnit({
              world: () => this.world,
              events: () => this.events,
              day: () => cycleDay,
            }, () => animalSkip!);
          }
        }
        return true;
      },
      ...(firstDaySheriffBeforeNightInfo && !night.mistDelay
        ? { afterSheriffElection: () => settleNight() }
        : {}),
      commitKnightDuel: async (choice) => {
        if (!dayIsCurrent() || !nightSettled) return "rejected";
        const duel = commitKnightDuel(this.world, choice, Phase.Day, this.events);
        if (!duel) return "rejected";
        // 原决斗没有 nightEffects；新元数据包无原型，不让缺项读取继承的回调／保护 getter。
        const duelMetadata = Object.create(null) as { execution: { phaseRevision: number } };
        duelMetadata.execution = { phaseRevision: dayRevision };
        await this.deathResolution.resolve(
          duel.deaths,
          duel.sources,
          actionProvider,
          Phase.Day,
          Phase.Day,
          {},
          duelMetadata,
        );
        if (!dayIsCurrent()) return "terminal";
        if (this.checkAndSealResult(this.#rulePlan.checkpoints.dayInterrupted)) return "terminal";
        return duel.endsDay ? "night" : "continue";
      },
    });

    if (night.mistDelay && !nightSettled && dayIsCurrent()) await settleMist();

    if (this.state.gameOver || !dayIsCurrent()) return this.getSnapshot();
    if (dayResult.interrupted) {
      // 白天被自爆中断时直接结束当日并切到下一夜。
      if (
        this.state.gameOver ||
        this.checkAndSealResult(this.#rulePlan.checkpoints.dayInterrupted)
      ) {
        return this.getSnapshot();
      }
      this.state.day += 1;
      this.setPhase(Phase.Night);
      return this.getSnapshot();
    }

    this.setPhase(Phase.Voting);
    const votingRevision = this.phaseRevision.current;
    const votingIsCurrent = () =>
      this.state.day === cycleDay &&
      this.state.phase === Phase.Voting &&
      !this.state.gameOver &&
      this.phaseRevision.current === votingRevision;
    const votingResult = await this.votingPipeline.execute(this.config, actionProvider, {
      day: cycleDay,
      isCurrent: votingIsCurrent,
      commitSelfDestruct: async (choice) => {
        if (!votingIsCurrent()) return false;
        const blast = commitSelfDestructSelection(
          this.world,
          choice,
          ActionWindow.OnPreVote,
          Phase.Voting,
          this.events,
        );
        if (!blast) return false;
        const animalSkip = this.config.animalDream
          ? beginAnimalExileUnit(this.world, cycleDay, "skipped_day", votingIsCurrent)
          : undefined;
        const skippedUnit = openExileUnit(cycleDay, "skipped_day", animalSkip);
        await this.deathResolution.resolve(
          blast.deaths,
          blast.sources,
          actionProvider,
          Phase.Voting,
          Phase.Voting,
          {},
          { isCurrent: votingIsCurrent, execution: { exile: skippedUnit, phaseRevision: votingRevision }, ...(animalSkip ? { animalUnit: animalSkip } : {}) },
        );
        if (animalSkip) {
          completeAndPublishAnimalExileUnit({
            world: () => this.world,
            events: () => this.events,
            day: () => cycleDay,
          }, () => animalSkip!);
        }
        return true;
      },
    });

    if (!votingIsCurrent()) return this.getSnapshot();
    if (votingResult.interrupted) {
      // 投票前窗口发生自爆，同样跳过当日剩余流程。
      if (this.checkAndSealResult(this.#rulePlan.checkpoints.dayInterrupted)) {
        return this.getSnapshot();
      }
      this.state.day += 1;
      this.setPhase(Phase.Night);
      return this.getSnapshot();
    }

    let beautyCandidate: BeautyExileCandidate | null = null;
    if (votingResult.animalUnit) {
      const { sources, ids } = prepareAnimalExileDeaths(votingResult);
      await this.deathResolution.resolve(
        ids,
        sources,
        actionProvider,
        Phase.Voting,
        Phase.Voting,
        {},
        { isCurrent: votingIsCurrent, animalUnit: votingResult.animalUnit, execution: { exile: exileUnitOf(votingResult), phaseRevision: votingRevision } },
      );
      if (!votingIsCurrent()) return this.getSnapshot();
      completeAndPublishAnimalExileUnit({
        world: () => this.world,
        events: () => this.events,
        day: () => cycleDay,
      }, () => votingResult.animalUnit!);
      this.previousExile = captureAnimalExileFeedback(() => this.world, votingResult, sources, cycleDay);
    } else if (votingResult.removed.length > 0) {
      // 普通放逐在死亡波前捕获末狼／目标侧；动物分支不借此特殊胜利候选。
      const { target, candidate } = prepareBeautyExileVictory(votingResult, () => this.world);
      beautyCandidate = candidate;
      this.previousExile = captureOrdinaryExileFeedback(() => this.world, votingResult, target, cycleDay);
      const sources = prepareOrdinaryExileDeaths(votingResult);
      await this.deathResolution.resolve(
        votingResult.removed,
        sources,
        actionProvider,
        Phase.Voting,
        Phase.Voting,
        {},
        { isCurrent: votingIsCurrent, execution: { exile: exileUnitOf(votingResult), phaseRevision: votingRevision } },
      );
    }
    if (!votingIsCurrent()) return this.getSnapshot();
    // await 后先保原当前性守卫，再核整侧；查询不是封盘，已提交死亡不因失败退款。
    const beautyResult = resolveBeautyExileVictory(this.world, beautyCandidate);
    if (
      this.checkAndSealResult(
        this.#rulePlan.checkpoints.exileSettled,
        beautyExileVictoryOverrides(beautyResult),
      )
    ) {
      return this.getSnapshot();
    }

    await new WallNotesWindow(this.world, this.toolGateway, this.events).execute(
      this.config,
      new GameActionRequestFactory(this.world, this.events, cycleDay),
      actionProvider,
      cycleDay,
      votingIsCurrent,
      () => this.random.fork("wall_notes"),
    );
    if (!votingIsCurrent()) return this.getSnapshot();
    this.state.day += 1;
    return this.getSnapshot();
  }

  async runUntilGameOver(
    actionProvider: ActionProvider,
    maxDays: number = 20,
  ): Promise<RuntimeSnapshot> {
    while (!this.state.gameOver) {
      await this.runSingleCycle(actionProvider, maxDays);
    }
    return this.getSnapshot();
  }

  /** 流水线、开局上下文及归档编码共享的唯一执行计划。 */
  getRulePlan(): RulePlan {
    return this.#rulePlan;
  }

  /**
   * 检查胜负并在命中时封盘写入 game_over 事件。
   */
  private checkAndSealResult(
    checkpoint: VictoryCheckpoint,
    overrides: Partial<Record<WinCondition, WinDecision>> = {},
  ): boolean {
    if (this.state.gameOver) return true;
    const result = this.conditionRegistry.evaluateMany(
      this.world,
      TERMINAL_VICTORY_POLICY.conditions({ world: () => this.world, config: () => this.config }),
      checkpoint,
      overrides,
    );
    if (!result) return false;
    this.sealResult(TERMINAL_VICTORY_POLICY.replaceFactionResult(this.world, result), checkpoint, this.state.phase);
    return true;
  }

  private sealResult(decision: WinDecision, checkpoint: VictoryCheckpoint, phase: Phase): void {
    if (this.state.gameOver) return;
    this.assertFaultPlanConsumed();
    // 先核故障计划，再由规则组合核婚约分配与原成员／时点；任何拒绝都先于本经理的终态写入。
    const { winner, outcome, decidedAt } = TERMINAL_VICTORY_POLICY.validateCandidate(
      decision,
      checkpoint,
      phase,
      () => this.world,
      () => this.state.day,
    );
    this.state.result = { winner, reason: decision.reason, outcome, decidedAt };
    this.state.gameOver = true;
    this.setPhase(Phase.GameOver);
    this.events.push({
      timestamp: Date.now(),
      type: "game_over",
      payload: structuredClone(this.state.result),
    });
  }

  /** 只检验猎魔原体／夜状态和全体药印记可读性；失败原样拒绝，不发布夜报或恢复资源。 */
  private assertDemonReadable(): void {
    if (demonHunterActorId(this.world) === null) return;
    assertDemonNightReadable(this.world);
    if (!this.world.entityIds().every((id) => demonWitchMarksSafe(this.world, id)))
      throw new Error("demon_hunter_unreadable_marks");
  }

  /** 发布原“昨夜死亡／平安夜”公开事实；名单当时取副本，广播时点仍由阶段经理决定。 */
  private emitNightResolved(deaths: EntityId[]): GameEvent {
    const event: GameEvent = {
      timestamp: Date.now(),
      type: "night_resolved",
      payload: {
        deaths: [...deaths],
      },
    };
    this.events.push(event);
    return event;
  }

  /**
   * 调试接口：返回当前终局结果。
   */
  debugResult(): GameResult | null {
    return this.state.result === null ? null : structuredClone(this.state.result);
  }

  /**
   * 切换阶段并写入 `phase_changed` 事件。
   */
  private setPhase(phase: Phase): void {
    const previous = this.state.phase;
    this.state.phase = phase;
    if (previous === phase) {
      return;
    }
    this.phaseRevision.advance();
    this.world.closeDeathActions();
    const gameOverPayload =
      phase === Phase.GameOver && this.state.result
        ? {
            winner: this.state.result.winner,
            reason: this.state.result.reason,
            outcome: structuredClone(this.state.result.outcome),
            decidedAt: { ...this.state.result.decidedAt },
          }
        : {};
    this.events.push({
      timestamp: Date.now(),
      type: "phase_changed",
      payload: {
        phase,
        day: this.state.day,
        ...gameOverPayload,
      },
    });
  }
}
