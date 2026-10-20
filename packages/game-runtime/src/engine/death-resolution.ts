/**
 * 负责有序死亡波、角色死亡钩子、枪击选择、遗言与警徽交接。输入是待处理的死亡名单、
 * 原死因与原生命行动权限；输出是按原顺序提交的死亡、事件和内部关联凭证。实际生命修改和唯一已结算
 * 账本委托 DeathCommitter，双生、动物、婚约及狼美人关系事实归具体贡献；已提交整波在梦／遗言前交角色扩展，
 * 野孩子贡献自行核对榜样原生命。参数仍使用同一深只读规则视图，不建立第二份角色状态。
 * 初始和枪后追加关系准备归各自具名规则组合；本结算器仍在原逐目标时点登记来源阶段、标死并提交／发布双生回执。
 * 未提交预约只在已进入的原 finally 处取消，已提交回执不因后续发布失败而回滚。
 * 枪的资格归共同所有者，请求、等待与目标复验归规则组合；本结算器持同一许可数组并在原时点关闭。
 * 本模块不切换阶段或确定最终胜负；关系扩展、遗言、警徽和枪的最终过期保留原执行顺序。
 */
import {
  resumeDeathActionContinuation,
  queueDeathActionContinuations,
  type DeathActionContinuation,
} from "./hooks/death-action-continuation";
import type { DeathHookResult } from "./hooks/registry";
import { bindDreamLifeQueries } from "../domain/dream-night-effects";
import { refreshWolfKnifeInheritanceAtCheckpoint } from "../rulesets/wolf-knife-inheritance-plan";
import { AnimalDeathWavePreparation } from "../features/animal-dream/ports";
import {
  planDeathWave,
  bindDeathWaveOriginalLives,
  openDeathWave,
  deathExecutionContext,
  type DeathExecutionContext,
  deathWaveOriginalLives,
  deathWavePoisonMetadata,
  type DeathWaveUnit,
  preflightDeathWaveData,
  DeathCommitReceipt,
  type DeathOriginalLife,
} from "./death-wave";
import {
  hasAwakenedDeathPrevention,
  prepareAwakenedDeaths,
} from "../rulesets/awakened-death-prevention";
import { collectDeathPatrol } from "../rulesets/death-patrol-selection";
import type { NightPoisonRoute } from "../domain/night-effects";
import { DeathCommitter } from "./death-committer";
import type { ReadonlyBoardConfig } from "@ai-werewolf-arena/game-contract";
import { AWAKENED_BEAUTY_POLICY } from "@ai-werewolf-arena/game-contract/facts/awakened-beauty";
import { FRAGRANT_PAIR_POLICY } from "@ai-werewolf-arena/game-contract/facts/fragrant-pair-seer";
import {
  FragrantDeathWavePublication,
  isFragrantPairBoard,
  commitFragrantDeathWave,
  publishFragrantDeathWave,
  cancelFragrantDeathWave,
  fragrantAuthoritySnapshot,
} from "../features/fragrant-pair-seer/ports";
import { collectDeathShot, type DeathWaveActions } from "../rulesets/death-shot-selection";
import { prepareInitialDeathRelations } from "../rulesets/initial-death-relations";
import { bindWeddingDeathWavePublication } from "../features/ghost-bride/ports";
import { prepareAdditionalDeathRelations } from "../rulesets/additional-death-relations";
import type { BoardConfig } from "../domain/board";
import { livingNightLife } from "../domain/night-effects";
import { COMPONENT } from "../domain/components/names";
import {
  ActionProvider,
  EntityId,
  GameEvent,
  Phase,
  Role,
  RuntimeSnapshot,
  DeathCause,
  type DeathSources,
} from "../domain/model";
import type { RoleComponent } from "../domain/components/role";
import { World } from "../domain/world";
import { ToolGateway } from "./actions/tool-gateway";
import { getDefaultLastWordsMechanism } from "../features/last-words/grant-ports";
import type { LastWordsGrantContext } from "../features/last-words/grant-ports";
import { LastWordsWindow } from "../features/last-words/window-ports";
import { resolveSheriffBadge } from "../features/sheriff/choice-ports";
import { GameActionRequestFactory } from "./actions/action-request-factory";
import { EventRegistry } from "./events/event-registry";
import type { DreamNightEffects } from "../domain/dream-night-effects";
import { firstDeathGuns, finishDeathGuns } from "../features/death-actions/gift-gun-ports";
import {
  openDuelLastWordsScope,
  duelLastWordsMetadata,
  assertDuelLastWordsScope,
  appendDuelWordCommit,
  beginDuelWordsFlush,
  readDuelWordEntitlement,
  duelWordEntitlementCurrent,
  markDuelWordGranted,
  closeDuelLastWordsScope,
  type DuelLastWordsScope,
} from "./duel-last-words";

/** 连续结算死亡波，动作阶段仍由 PhaseManager 推进。 */
export class DeathResolution {
  // 只捕获原结算器；每条关系边在原表达式处晚读 World、事件、日期及阶段。
  private readonly weddingDeathWave = (() => {
    const resolution = this;
    return bindWeddingDeathWavePublication({
      get world() {
        return resolution.world;
      },
      get events() {
        return resolution.events;
      },
      get day() {
        return resolution.state.day;
      },
      get phase() {
        return resolution.state.phase;
      },
    });
  })();
  private readonly lastWordsMechanism = getDefaultLastWordsMechanism();
  // 只捕获原结算器；遗言窗口在原读取点取依赖，不在装配时创建请求工厂或开放许可。
  private readonly lastWordsWindow = (() => {
    const resolution = this;
    return new LastWordsWindow({
      get requestFactory() {
        return GameActionRequestFactory;
      },
      get world() {
        return resolution.world;
      },
      get events() {
        return resolution.events;
      },
      get state() {
        return resolution.state;
      },
      get toolGateway() {
        return resolution.toolGateway;
      },
      get lastWordsMechanism() {
        return resolution.lastWordsMechanism;
      },
    });
  })();
  // 只捕获结算器本身；每次 World、事件和运行状态读取仍发生在原命令表达式处。
  private readonly deathCommitter = (() => {
    const resolution = this;
    return new DeathCommitter({
      get world() {
        return resolution.world;
      },
      get events() {
        return resolution.events;
      },
      get state() {
        return resolution.state;
      },
    });
  })();
  // 只捕获原结算器；每次窄查询/读取/发布仍在原表达式处使用当前 World 与状态。
  private readonly fragrantDeathWave = (() => {
    const resolution = this;
    return new FragrantDeathWavePublication({
      actorId: () => resolution.world.getEntityIdsByRole(Role.FragrantPhantom)[0]!,
      get phase() {
        return resolution.state.phase;
      },
      get day() {
        return resolution.state.day;
      },
      get events() {
        return resolution.events;
      },
      publish(receipt, event) {
        publishFragrantDeathWave(resolution.world, receipt, event);
      },
    });
  })();

  constructor(
    private readonly world: World,
    private readonly events: GameEvent[],
    private readonly toolGateway: ToolGateway,
    private readonly eventRegistry: EventRegistry,
    private readonly state: RuntimeSnapshot,
    private readonly config?: ReadonlyBoardConfig,
  ) {}

  /** 连续决斗只延后授词；真实死亡、警徽、钩子仍逐次完整结算，许可不由玩家请求或JSON重建。 */
  openDuelLastWords(current: () => boolean): DuelLastWordsScope {
    const day = this.state.day,
      phase = this.state.phase;
    return openDuelLastWordsScope(
      this,
      this.world,
      day,
      phase,
      () =>
        current() && this.state.day === day && this.state.phase === phase && !this.state.gameOver,
    );
  }

  /** 仅正常链尾调用；每份真实授词和发言分别保留，失败后关闭scope而不伪造后续正常终止。 */
  async flushDuelLastWords(scope: DuelLastWordsScope, provider: ActionProvider): Promise<void> {
    try {
      for (const entitlement of beginDuelWordsFlush(scope, this)) {
        const info = readDuelWordEntitlement(entitlement);
        const events = this.events,
          publish = events.push;
        const event: GameEvent = {
          timestamp: Date.now(),
          type: "last_words_granted",
          payload: { playerId: info.id, phase: info.phase, day: info.day },
        };
        const args: [GameEvent] = [event],
          invoke = Reflect.apply.bind(Reflect);
        if (!duelWordEntitlementCurrent(entitlement)) throw new Error("duel_last_words_revoked");
        invoke(publish, events, args);
        markDuelWordGranted(entitlement);
        await this.lastWordsWindow.collectDuel(entitlement, provider);
      }
    } finally {
      closeDuelLastWordsScope(scope, this);
    }
  }

  /** 失败只收权；已经提交的死亡、徽章、钩子和授词／发言事实均不回滚，也不补正常遗言。 */
  abortDuelLastWords(scope: DuelLastWordsScope): void {
    closeDuelLastWordsScope(scope, this);
  }

  /**
   * 初始波完成标死和必要发布后，再收遗言、交警徽、逐角色处理死亡动作；追加目标先同步标死，
   * 下一波再处理其死后动作。来源昼夜与动作执行阶段分别保存，不能用当前阶段覆盖夜间来源。
   * 当前性撤销可提前返回，异常保留已提交前缀；是否继续阶段或封盘仍由 PhaseManager 决定。
   */
  async resolve(
    deadIds: EntityId[],
    sources: DeathSources,
    actionProvider: ActionProvider,
    phase: Phase,
    lastWordsPhase: Phase,
    deathPhases: Readonly<Record<EntityId, Phase>> = {},
    nightEffects?: {
      dreams?: DreamNightEffects;
      blocksPassiveNightShot?: (targetId: EntityId) => boolean;
      nightOriginIds?: readonly EntityId[];
      isCurrent?: () => boolean;
      onInitialWaveCommitted?: (
        deaths: readonly EntityId[],
        sources: DeathSources | undefined,
        receipt: DeathCommitReceipt,
      ) => GameEvent;
      originalLives?: ReadonlyMap<EntityId, DeathOriginalLife>;
      poisonRoutes?: readonly NightPoisonRoute[];
      animalUnit?: object;
      execution?: DeathExecutionContext;
      duelLastWords?: DuelLastWordsScope;
    },
  ): Promise<void> {
    const resolutionPhase = this.state.phase;
    const resolutionDay = this.state.day;
    const duelWords = duelLastWordsMetadata(nightEffects);
    if (duelWords !== undefined)
      assertDuelLastWordsScope(duelWords, this, resolutionDay, resolutionPhase);
    const lastWordsPolicy = this.config?.lastWords?.policy ?? "awa_initial_wave_v1";
    const revealPolicy = this.config?.disclosure?.deathRevealPolicy ?? "awa_hidden_v1";
    let ownedWorld: World;
    const ownsFragrant = isFragrantPairBoard((ownedWorld = this.world));
    const ownsAwakened = hasAwakenedDeathPrevention(ownedWorld);
    const isCurrent = () =>
      this.state.phase === resolutionPhase &&
      this.state.day === resolutionDay &&
      !this.state.gameOver &&
      (!ownsAwakened || this.world === ownedWorld) &&
      (nightEffects?.isCurrent?.() ?? true) &&
      (!ownsFragrant || !!fragrantAuthoritySnapshot(this.world));
    const revealCurrent = () =>
      revealPolicy === "netease_2017_open_v1" &&
      this.config?.disclosure?.deathRevealPolicy === revealPolicy;
    const lastWordsCurrent = () =>
      isCurrent() && (this.config?.lastWords?.policy ?? "awa_initial_wave_v1") === lastWordsPolicy;
    const resolution = this;
    const animalDeathWave = AnimalDeathWavePreparation.fromRuntime(
      {
        get world() {
          return resolution.world;
        },
        get events() {
          return resolution.events;
        },
      },
      resolutionDay,
      nightEffects,
      isCurrent,
    );
    const ownsAnimal = animalDeathWave.enabled;
    const preparedSources: DeathSources = structuredClone(sources);
    // 普通静态输入在任何角色事实前完成整波预检；getter／Proxy 仍沿旧表达式惰性读取。
    preflightDeathWaveData(deadIds, preparedSources, deathPhases);
    deadIds = animalDeathWave.prepare(deadIds, preparedSources, phase);
    // seen 追踪本次结算已纳入的席位；DeathCommitter 的账本另按原体及版本判断已结算生命。
    const seen = new Set<EntityId>(
      deadIds.filter((id) => {
        return (
          this.world.getComponent(id, COMPONENT.Alive) !== undefined &&
          !this.deathCommitter.isSettledLife(id)
        );
      }),
    );
    let pending = [...seen];
    const allSources: DeathSources = preparedSources;
    const nativeHunterShotTargets = new Set<EntityId>();
    const initialPhases: Record<EntityId, Phase> = structuredClone(deathPhases);
    const nightOrigin = new Set(nightEffects?.nightOriginIds ?? []);
    if (!isCurrent()) return;
    const { fragrantInitial, originPhases } = prepareInitialDeathRelations(
      {
        wedding: () => this.weddingDeathWave,
        world: () => this.world,
        events: () => this.events,
        phase: () => phase,
        resolutionDay: () => resolutionDay,
        ownsFragrant: () => ownsFragrant,
        dreams: () => nightEffects?.dreams,
      },
      pending,
      allSources,
      seen,
      nightOrigin,
      initialPhases,
    );
    // 新有限板先准备真实防护／替死，再登记实际名单；旧板没有新owner时不新增World查询。
    const ownedLives = new Map<EntityId, DeathOriginalLife>();
    const awakenedInitial = ownsAwakened
      ? prepareAwakenedDeaths(
          {
            world: ownedWorld,
            day: resolutionDay,
            phase: resolutionPhase,
            events: this.events,
            isCurrent,
          },
          pending,
          allSources,
          originPhases,
          deathWaveOriginalLives(nightEffects),
        )
      : undefined;
    if (awakenedInitial) {
      seen.clear();
      for (const id of pending) {
        seen.add(id);
        initialPhases[id] = originPhases.get(id)!;
        if (originPhases.get(id) === Phase.Night) nightOrigin.add(id);
        else nightOrigin.delete(id);
      }
      for (const id of [...nightOrigin]) if (!pending.includes(id)) nightOrigin.delete(id);
      for (const [id, life] of awakenedInitial.lives) ownedLives.set(id, life);
    }
    const ownedPlan = (plan: ReturnType<typeof planDeathWave>) => {
      if (ownsAwakened) bindDeathWaveOriginalLives(plan, ownedWorld, ownedLives);
      return plan;
    };
    const initialUnit = openDeathWave(
      "initial",
      resolutionDay,
      resolutionPhase,
      deathExecutionContext(nightEffects),
    );
    let pendingUnits: readonly DeathWaveUnit[] = [initialUnit];
    let previousCommits: readonly DeathCommitReceipt[] = [];
    let firstBatch = true;
    let fragrantInitialCommitted = false;
    // 只收集原实例，在原 finally 位置尝试过期；先取消未提交双生波凭据，取消失败时过期尚未执行。
    // 已付款和死亡不回滚，不为统一清理吞掉原取消异常。
    const gunsToExpire: ReturnType<typeof firstDeathGuns> = [];
    type QueuedDeathAction = {
      token: DeathActionContinuation;
      commit(result: DeathHookResult): void;
      actions: DeathWaveActions;
    };
    // 栈只保存原动作的继续点，不保存第二份生命或库存。兄弟按原 actor/hook/标记顺序；新后代先于父继续。
    const continuations: QueuedDeathAction[] = [];
    let next = new Set<EntityId>();
    let nextCommits: DeathCommitReceipt[] = [];
    let nextUnits: DeathWaveUnit[] = [];
    let nextContinuations: QueuedDeathAction[] = [];

    try {
      // 空初始波仍执行原发布回调；空条目凭证只关联这次发布，不证明枪付款或整个死亡链完成。
      if (pending.length === 0 && nightEffects?.onInitialWaveCommitted && isCurrent()) {
        const receipt = new DeathCommitReceipt(
          ownedPlan(
            planDeathWave(
              [],
              {},
              "initial",
              originPhases,
              deathWaveOriginalLives(nightEffects),
              deathWavePoisonMetadata(nightEffects),
              pendingUnits,
            ),
          ),
          Object.freeze([]),
        );
        const event = nightEffects.onInitialWaveCommitted([], {}, receipt);
        receipt.recordPublication(event, []);
        awakenedInitial?.publishAfterCommit(new Set());
      }
      while (pending.length > 0 || continuations.length > 0) {
        if (!isCurrent()) return;
        if (pending.length === 0) {
          // 当前目标的全部追加波已经完成，才恢复原动作。下一份提案使用新的工作容器，不重访旧死者。
          next = new Set<EntityId>();
          nextCommits = [];
          nextUnits = [];
          nextContinuations = [];
          const continuation = continuations.pop()!;
          try {
            const result = await resumeDeathActionContinuation(continuation.token);
            if (!isCurrent()) return;
            continuation.commit(result);
          } finally {
            // 原 callback 的首次 finally 已关闭首枪；继续期间重新登记的许可同样只由结算器关闭。
            for (const permit of continuation.actions.permits.splice(0)) permit.close();
          }
          continuations.push(...nextContinuations.reverse());
          pending = [...next];
          pendingUnits = nextUnits;
          previousCommits = nextCommits;
          firstBatch = false;
          continue;
        }
        const deathPhase = firstBatch ? phase : this.state.phase;
        // 初始波整批标死；追加目标已在前一角色回调标死，再访仍执行原收尾，但不重复首次生命事实。
        const receipt = this.deathCommitter.markPlayersDead(
          pending,
          true,
          gunsToExpire,
          revealPolicy === "netease_2017_open_v1",
          allSources,
          nightEffects?.animalUnit ?? isCurrent,
          ownedPlan(
            planDeathWave(
              pending,
              allSources,
              firstBatch ? "initial" : "revisit",
              originPhases,
              deathWaveOriginalLives(nightEffects),
              deathWavePoisonMetadata(nightEffects),
              pendingUnits,
              previousCommits,
            ),
          ),
        );
        if (duelWords) appendDuelWordCommit(duelWords, this, receipt, allSources, deathPhase);
        if (firstBatch && fragrantInitial) {
          commitFragrantDeathWave(this.world, fragrantInitial);
          fragrantInitialCommitted = true;
        }
        // 后续枪波已在枪回调逐目标标死并记录；这里不再重复双生发布。
        if (ownsFragrant && firstBatch)
          this.fragrantDeathWave.recordCommittedWave(
            firstBatch ? fragrantInitial : null,
            pending,
            allSources,
            originPhases,
            firstBatch,
          );
        // 此处生命及账本已提交；发布回调抛错不撤销死亡，凭证只把原事件与提交条目关联。
        if (firstBatch && nightEffects?.onInitialWaveCommitted) {
          const event = nightEffects.onInitialWaveCommitted(pending, allSources, receipt);
          receipt.recordPublication(event, pending);
          this.fragrantDeathWave.publishVisibleWave(fragrantInitial, event);
        }
        if (ownsAnimal && firstBatch)
          animalDeathWave.recordInitialWave(pending, allSources, deathPhase);
        if (
          firstBatch &&
          fragrantInitial?.addedTargetId !== null &&
          fragrantInitial?.addedTargetId !== undefined
        ) {
          const event: GameEvent = {
            timestamp: Date.now(),
            type: "additional_deaths",
            payload: { deaths: [fragrantInitial.addedTargetId] },
          };
          this.events.push(event);
          receipt.recordPublication(event, [fragrantInitial.addedTargetId]);
          this.fragrantDeathWave.publishVisibleWave(fragrantInitial, event);
        }
        if (firstBatch && awakenedInitial) {
          // 原票目标仍在投票摘要；死亡事实只描述实际commit，不把被替死的狼美人说成出局。
          const replaced: EntityId[] = [];
          for (const id of pending) {
            if ((allSources[id] ?? []).includes(DeathCause.Exile)) {
              const event: GameEvent = {
                timestamp: Date.now(),
                type: "voted_out",
                payload: { target: id },
              };
              this.events.push(event);
              receipt.recordPublication(event, [id]);
            } else if (
              (allSources[id] ?? []).includes(DeathCause.AwakenedBeautyReplacement) &&
              (!nightEffects?.onInitialWaveCommitted || originPhases.get(id) !== Phase.Night)
            )
              replaced.push(id);
          }
          if (replaced.length) {
            const event: GameEvent = {
              timestamp: Date.now(),
              type: "additional_deaths",
              payload: { deaths: replaced },
            };
            this.events.push(event);
            receipt.recordPublication(event, replaced);
          }
          awakenedInitial.publishAfterCommit(
            new Set(pending.filter((id) => receipt.committed(id) !== undefined)),
          );
        }
        // 整波角色扩展先看到已提交死亡，随后记录梦链，再按政策授予并收集遗言。
        this.eventRegistry.onCommittedDeathWave(
          this.world,
          pending,
          allSources,
          resolutionDay,
          deathPhase,
          this.events,
        );
        nightEffects?.dreams?.recordDeaths(pending, this.events);
        // 基础政策只考察初始波；网易具名政策还考察追加波，逐人昼夜与死因资格仍由遗言机制核对。
        if (
          !duelWords &&
          (firstBatch || lastWordsPolicy === "netease_2017_day_and_first_night_v1") &&
          lastWordsCurrent()
        ) {
          const wordsPhases = firstBatch
            ? initialPhases
            : Object.fromEntries(
                pending.map((id) => [id, nightOrigin.has(id) ? Phase.Night : deathPhase]),
              );
          const wordsContext: LastWordsGrantContext | undefined = ownsFragrant
            ? { policy: FRAGRANT_PAIR_POLICY, initialWave: firstBatch }
            : ownsAwakened
              ? { policy: AWAKENED_BEAUTY_POLICY, initialWave: firstBatch }
              : undefined;
          this.lastWordsMechanism.recordLastWordsGranted(
            this.world,
            pending,
            phase,
            lastWordsPhase,
            this.state.day,
            this.events,
            allSources,
            wordsPhases,
            lastWordsPolicy,
            wordsContext,
          );
          await this.lastWordsWindow.collect(
            pending,
            lastWordsPhase,
            phase,
            allSources,
            actionProvider,
            wordsPhases,
            lastWordsCurrent,
            lastWordsPolicy,
            wordsContext,
          );
        }
        if (!isCurrent()) return;

        // 先处理警长死亡带来的警徽逻辑，再执行角色死亡钩子。
        for (const deadId of pending) {
          const causes = allSources[deadId] ?? [];
          const actualDeathPhase = firstBatch ? (initialPhases[deadId] ?? deathPhase) : deathPhase;
          const reason = causes.includes(DeathCause.SelfDestruct)
            ? "self_destruct"
            : causes.includes(DeathCause.Exile)
              ? "voted_out"
              : `${actualDeathPhase}_death`;
          await resolveSheriffBadge(
            this.world,
            deadId,
            reason,
            this.events,
            this.toolGateway,
            actionProvider,
            resolutionPhase,
            resolutionDay,
            isCurrent,
            {
              // 每次死亡警徽调用只分配依赖视图；实际构造器仍在许可开启后的原 new 点读取。
              get requestFactory() {
                return GameActionRequestFactory;
              },
            },
          );
          if (!isCurrent()) return;
        }

        next = new Set<EntityId>();
        nextCommits = [];
        nextUnits = [];
        nextContinuations = [];
        for (const deadId of pending) {
          if (!isCurrent()) return;
          // 来源阶段属于这次死亡；黎明后处理夜间死亡仍必须保留夜间枪权／关系保护规则。
          const sourcePhase =
            originPhases.get(deadId) ?? (nightOrigin.has(deadId) ? Phase.Night : deathPhase);
          const actions: DeathWaveActions = {
            phase: resolutionPhase,
            day: resolutionDay,
            permits: [],
            isCurrent,
          };
          const callbackInitialBatch = firstBatch;
          let commitAdditionalDeaths!: (
            result: DeathHookResult,
            capturedContinuations?: readonly DeathActionContinuation[] | null,
          ) => void;
          try {
            await this.eventRegistry.onDeath(
              this.world,
              [deadId],
              allSources,
              (actorId, abilityId, qualification) =>
                collectDeathShot(
                  {
                    // 只创建闭包；每次成员读取仍在原选择表达式处，不提前取得 World／规则／状态。
                    get world() {
                      return resolution.world;
                    },
                    get events() {
                      return resolution.events;
                    },
                    get toolGateway() {
                      return resolution.toolGateway;
                    },
                    get state() {
                      return resolution.state;
                    },
                    get config() {
                      return resolution.config;
                    },
                  },
                  actorId,
                  callbackInitialBatch ? (initialPhases[actorId] ?? deathPhase) : deathPhase,
                  sourcePhase,
                  allSources,
                  actionProvider,
                  actions,
                  abilityId,
                  nightOrigin.has(actorId) &&
                    !(callbackInitialBatch && initialPhases[actorId] === Phase.Day),
                  qualification,
                ),
              this.events,
              // 每个成功钩子提案同步进入这里；后面的钩子可见已标死目标，失败不丢弃先前提交。
              (commitAdditionalDeaths = (result, capturedContinuations) => {
                if (!isCurrent()) return;
                // 继续结果同样经过此入口；先捕获一次并验证标记，不能先真标死再发现下一步伪造。
                const continuedActions = queueDeathActionContinuations(
                  capturedContinuations === undefined
                    ? result.deathActionContinuations
                    : (capturedContinuations ?? undefined),
                );
                const proposed = [...result.extraDeaths],
                  proposedSources = structuredClone(result.extraDeathSources),
                  nightTargets = [...(result.nightEffectTargets ?? [])];
                preflightDeathWaveData(proposed, proposedSources);
                preflightDeathWaveData(nightTargets, {});
                const additionalUnit = openDeathWave(
                  "additional",
                  resolutionDay,
                  resolutionPhase,
                  deathExecutionContext(nightEffects),
                );
                const shots = new Map(
                  (result.pendingShots ?? []).map((shot) => [shot.targetScope.id, shot]),
                );
                // 旧目标或已撤权的枪只移除自己的 Shot 原因；其它独立原因仍可进入实际死亡提交。
                for (const [id, shot] of shots) {
                  if (livingNightLife(this.world, shot.targetScope) && (shot.isCurrent?.() ?? true))
                    continue;
                  proposedSources[id] = (proposedSources[id] ?? []).filter(
                    (cause) => cause !== DeathCause.Shot,
                  );
                  if (!proposedSources[id].length) {
                    const index = proposed.indexOf(id);
                    if (index >= 0) proposed.splice(index, 1);
                  }
                  if (!proposedSources[id].length)
                    for (let i = nightTargets.length - 1; i >= 0; i--)
                      if (nightTargets[i] === id) nightTargets.splice(i, 1);
                  shots.delete(id);
                }
                const linked = new Set<EntityId>(),
                  publicLinked: EntityId[] = [];
                let newlyMarked = false;
                const marked: number[] = [];
                const additionalReceipts: DeathCommitReceipt[] = [];
                // 每个 hook 的贡献在原准备点同步完成；描述只影响追加原因和公开关联，不授予标死权限。
                const resolution = this;
                const preparedContributions = (result.deathWaveContributions ?? []).map(
                  (contribution) =>
                    contribution.prepare(
                      {
                        blocksNightLinkedDeath: (target) =>
                          nightEffects?.dreams?.blocksNightCharm(
                            bindDreamLifeQueries(this.world),
                            target(),
                            seen,
                          ),
                      },
                      proposed,
                      proposedSources,
                      nightTargets,
                      allSources,
                      nativeHunterShotTargets,
                      seen,
                    ),
                );
                const contributedCauses = new Map<EntityId, readonly DeathCause[]>();
                const publicContributionTargets = new Set<EntityId>();
                for (const contribution of preparedContributions)
                  for (const linkedDeath of contribution.linkedDeaths) {
                    contributedCauses.set(linkedDeath.targetId, [
                      ...new Set([
                        ...(contributedCauses.get(linkedDeath.targetId) ?? []),
                        ...linkedDeath.addedCauses,
                      ]),
                    ]);
                    if (linkedDeath.publicAdditionalDeath)
                      publicContributionTargets.add(linkedDeath.targetId);
                  }
                // 同一局部容器进入同步关系准备；查询只捕获本结算器，不提前读原体、梦或当前阶段。
                const additionalRelations = prepareAdditionalDeathRelations(
                  {
                    world: () => this.world,
                    events: () => this.events,
                    wedding: () => this.weddingDeathWave,
                    dreams: () => nightEffects?.dreams,
                    isSettledLife: (id) => this.deathCommitter.isSettledLife(id),
                    phase: () => this.state.phase,
                  },
                  {
                    proposed,
                    proposedSources,
                    nightTargets,
                    allSources,
                    next,
                    seen,
                    nightOrigin,
                    linked,
                    ownsFragrant,
                    resolutionDay,
                    sourcePhase,
                  },
                );
                const awakenedRoots = ownsAwakened
                  ? new Map(proposed.map((id) => [id, sourcePhase]))
                  : undefined;
                const awakenedAdditional = awakenedRoots
                  ? prepareAwakenedDeaths(
                      {
                        world: ownedWorld,
                        day: resolutionDay,
                        phase: resolutionPhase,
                        events: this.events,
                        isCurrent,
                      },
                      proposed,
                      proposedSources,
                      awakenedRoots,
                      new Map([...shots].map(([id, shot]) => [id, shot.targetScope])),
                      result.pendingPatrols,
                    )
                  : undefined;
                if (awakenedAdditional)
                  for (const [id, life] of awakenedAdditional.lives) ownedLives.set(id, life);
                const { fragrantGun } = additionalRelations;
                let fragrantGunCommitted = false;
                try {
                  // 枪造成的追加波逐目标提交：后一个失败时，前一个的死亡、事实和库存仍有效。
                  for (const id of proposed) {
                    if (next.has(id)) {
                      allSources[id] = [
                        ...new Set([...(allSources[id] ?? []), ...(proposedSources[id] ?? [])]),
                      ];
                      continue;
                    }
                    if (seen.has(id) || this.deathCommitter.isSettledLife(id)) {
                      if ((proposedSources[id] ?? []).includes(DeathCause.Lovers))
                        allSources[id] = [
                          ...new Set([...(allSources[id] ?? []), DeathCause.Lovers]),
                        ];
                      if (linked.has(id))
                        allSources[id] = [
                          ...new Set([...(allSources[id] ?? []), DeathCause.Dream]),
                        ];
                      if (contributedCauses.has(id))
                        allSources[id] = [
                          ...new Set([...(allSources[id] ?? []), ...contributedCauses.get(id)!]),
                        ];
                      continue;
                    }
                    if (!this.world.getComponent(id, COMPONENT.Alive)) continue;
                    if (
                      ownsAnimal &&
                      !animalDeathWave.prepare([id], proposedSources, sourcePhase).includes(id)
                    )
                      continue;
                    let shot = shots.get(id);
                    if (
                      shot &&
                      (!livingNightLife(this.world, shot.targetScope) ||
                        (!fragrantGun && shot.isCurrent?.() === false))
                    ) {
                      proposedSources[id] = (proposedSources[id] ?? []).filter(
                        (cause) => cause !== DeathCause.Shot,
                      );
                      shots.delete(id);
                      shot = undefined;
                      if (!proposedSources[id].length) continue;
                    }
                    seen.add(id);
                    allSources[id] = [...new Set(proposedSources[id] ?? [])];
                    // 先前 seen／allSources 已原序写入；阶段查询失败仍保该前缀，不提前到关系准备时读取。
                    originPhases.set(
                      id,
                      awakenedRoots?.get(id) ?? additionalRelations.originPhase(),
                    );
                    if (ownsAwakened) {
                      if (originPhases.get(id) === Phase.Night) nightOrigin.add(id);
                      else nightOrigin.delete(id);
                    }
                    const commitIds = [id];
                    const receipt = this.deathCommitter.markPlayersDead(
                      commitIds,
                      false,
                      gunsToExpire,
                      revealCurrent(),
                      allSources,
                      nightEffects?.animalUnit ?? isCurrent,
                      ownedPlan(
                        planDeathWave(
                          commitIds,
                          allSources,
                          "additional",
                          originPhases,
                          shot ? new Map([[id, shot.targetScope]]) : undefined,
                          [],
                          [additionalUnit],
                        ),
                      ),
                    );
                    if (duelWords)
                      appendDuelWordCommit(duelWords, this, receipt, allSources, sourcePhase);
                    additionalReceipts.push(receipt);
                    nextCommits.push(receipt);
                    if (ownsAnimal)
                      animalDeathWave.recordAdditionalDeath(id, allSources, sourcePhase);
                    newlyMarked = true;
                    marked.push(id);
                    // 枪资源由角色钩子消费；这里在目标实际标死后发布命中，事件关联不再次付款。
                    if (shot) {
                      if (shot.event.type === "hunter_shot") nativeHunterShotTargets.add(id);
                      this.events.push(shot.event);
                      receipt.recordPublication(shot.event, [id]);
                    }
                    if (
                      publicContributionTargets.has(id) ||
                      (linked.has(id) && !result.extraDeaths.includes(id)) ||
                      (!shot && !(proposedSources[id] ?? []).includes(DeathCause.Shot))
                    )
                      publicLinked.push(id);
                    next.add(id);
                  }
                  if (newlyMarked) {
                    nextUnits.push(additionalUnit);
                    if (fragrantGun) {
                      commitFragrantDeathWave(this.world, fragrantGun);
                      fragrantGunCommitted = true;
                    }
                    if (ownsFragrant)
                      this.fragrantDeathWave.recordCommittedWave(
                        fragrantGun,
                        marked,
                        allSources,
                        originPhases,
                        false,
                      );
                    // 已提交死亡和必需关系贡献之后，沿原次序逐角色检查继承；失败保留该前缀。
                    refreshWolfKnifeInheritanceAtCheckpoint({
                      world: () => this.world,
                      events: () => this.events,
                      day: () => this.state.day,
                    });
                  }
                  if (publicLinked.length) {
                    const event: GameEvent = {
                      timestamp: Date.now(),
                      type: "additional_deaths",
                      payload: { deaths: publicLinked },
                    };
                    this.events.push(event);
                    for (const receipt of additionalReceipts)
                      receipt.recordPublication(
                        event,
                        publicLinked.filter((id) => receipt.committed(id) !== undefined),
                      );
                    this.fragrantDeathWave.publishVisibleWave(fragrantGun, event);
                  }
                  awakenedAdditional?.publishAfterCommit(new Set(marked));
                  // 只在原标死／公开追加事实之后交回本族发布；异常保留前缀并阻止后续 hook。
                  for (const contribution of preparedContributions)
                    contribution.publishAfterDeaths();
                  nightEffects?.dreams?.recordDeaths([...next, ...linked], this.events);
                  for (const permit of actions.permits.splice(0)) permit.close();
                  for (const token of continuedActions)
                    nextContinuations.push({ token, commit: commitAdditionalDeaths, actions });
                } finally {
                  if (fragrantGun && !fragrantGunCommitted)
                    cancelFragrantDeathWave(this.world, fragrantGun);
                }
              }),
              Object.freeze({
                day: resolutionDay,
                nativeHunterShotTargets,
                deferShotCommit: true,
                deathOriginPhase: sourcePhase,
                nightEffect: nightOrigin.has(deadId),
                blocksNightShot: (targetId: EntityId) =>
                  (nightEffects?.blocksPassiveNightShot?.(targetId) ?? false) ||
                  (nightEffects?.dreams?.blocksNightShot(
                    bindDreamLifeQueries(this.world),
                    targetId,
                  ) ??
                    false),
                blocksNightCharm: (targetId: EntityId) =>
                  nightEffects?.dreams?.blocksNightCharm(
                    bindDreamLifeQueries(this.world),
                    targetId,
                    seen,
                  ) ?? false,
                eligibleDead: seen,
                isCurrent,
              }),
              {
                world: () => resolution.world,
                events: () => resolution.events,
                chooseDeathPatrol: (actorId, qualification) =>
                  collectDeathPatrol(
                    {
                      get world() {
                        return resolution.world;
                      },
                      get events() {
                        return resolution.events;
                      },
                      get toolGateway() {
                        return resolution.toolGateway;
                      },
                      get state() {
                        return resolution.state;
                      },
                    },
                    actorId,
                    qualification,
                    actionProvider,
                    actions,
                    callbackInitialBatch ? (initialPhases[actorId] ?? deathPhase) : deathPhase,
                    sourcePhase,
                    allSources[actorId] ?? [],
                  ),
              },
            );
          } finally {
            for (const permit of actions.permits) permit.close();
          }
        }

        // 同波的多个继续项保原 actor/hook 顺序；后续波新增的项压在旧父项之上，先完成后代链。
        continuations.push(...nextContinuations.reverse());
        // Set 保留追加目标首次加入顺序；再访沿用真实提案单位及成功凭证，不重新制造波次来源。
        pending = [...next];
        pendingUnits = nextUnits;
        previousCommits = nextCommits;
        firstBatch = false;
      }
    } finally {
      if (fragrantInitial && !fragrantInitialCommitted)
        cancelFragrantDeathWave(this.world, fragrantInitial);
      finishDeathGuns(gunsToExpire, this.events);
    }
  }
}
