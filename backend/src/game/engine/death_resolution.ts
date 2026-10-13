/**
 * 负责有序死亡波、角色死亡钩子、枪击选择、遗言与警徽交接。输入是待处理的死亡名单、
 * 原死因与原生命行动权限；输出是按原顺序提交的死亡、事件和内部关联凭证。实际生命修改和唯一已结算
 * 账本委托 DeathCommitter，双生、动物及婚约关系事实归具体贡献；已提交整波在梦／遗言前交角色扩展，
 * 野孩子贡献自行核对榜样原生命。参数仍使用同一深只读规则视图，不建立第二份角色状态。
 * 本模块不切换阶段或确定最终胜负；关系扩展、遗言、警徽和枪的最终过期保留原执行顺序。
 */
import { refreshWolfKnifeInheritanceAtCheckpoint } from "../../rulesets/wolf-knife-inheritance-plan";
import { AnimalDeathWavePreparation } from "../mechanisms/roles/animal_dream/ports";
import {
  planDeathWave,
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
import type { NightPoisonRoute } from "../../core/domain/night_effects";
import { DeathCommitter } from "./death-committer";
import type { ReadonlyBoardConfig } from "@ai-werewolf-arena/game-contract";
import { FRAGRANT_PAIR_POLICY } from "@ai-werewolf-arena/game-contract/facts/fragrant-pair-seer";
import {
  FragrantDeathWavePublication,
  isFragrantPairBoard,
  prepareFragrantDeathWave,
  commitFragrantDeathWave,
  publishFragrantDeathWave,
  cancelFragrantDeathWave,
  fragrantAuthoritySnapshot,
} from "../mechanisms/roles/fragrant_pair_seer/ports";
import { assertMagicianRosterCurrent } from "../mechanisms/roles/magician/night_frame";
import {
  isMagicianBoard,
  resolveMagicianNightTarget,
} from "../mechanisms/roles/magician/night_frame";
import { nightmareFearBlocks } from "../mechanisms/roles/nightmare_shadow/night_frame";
import { demonHunterNativeGunCurrent } from "../mechanisms/roles/demon_hunter/authority";
import { WeddingDeathWavePublication } from "../mechanisms/roles/ghost_bride/ports";
import { expandLoversWave } from "../mechanisms/roles/cupid/relation";
import type { BoardConfig, LastWordsPolicy } from "../../core/domain/board";
import { captureNightLife, livingNightLife } from "../../core/domain/night_effects";
import { COMPONENT } from "../../core/domain/components/names";
import {
  ActionProvider,
  EntityId,
  GameEvent,
  Phase,
  Role,
  RuntimeSnapshot,
  DeathCause,
  permitsDeathShot,
  type DeathSources,
  type DeathShotSelection,
} from "../../core/domain/model";
import type { RoleComponent } from "../../core/domain/components/role";
import { World } from "../../core/domain/world";
import { ToolGateway } from "../gateway/tool_gateway";
import { getDefaultLastWordsMechanism } from "../mechanisms/last_words/last_words_mechanism";
import type { LastWordsGrantContext } from "../mechanisms/last_words/last_words_mechanism";
import { resolveSheriffBadge } from "../mechanisms/sheriff/badge_choice";
import { GameActionRequestFactory } from "./action_request_factory";
import { EventRegistry } from "./event_registry";
import type { DreamNightEffects } from "../../core/domain/dream-night-effects";
import {
  attemptCharmTrigger,
  commitCharmDeath,
  type CharmBinding,
  type CharmClaimReceipt,
} from "../mechanisms/roles/wolf_beauty/ports";
import {
  activeDeathGun,
  captureDeathGun,
  firstDeathGuns,
  finishDeathGuns,
} from "../mechanisms/roles/death_abilities";
import { getHunterState } from "../mechanisms/roles/hunter/ports";
import { getWolfKingState } from "../mechanisms/roles/wolf_king/ports";

/** 一次角色死亡动作的窗口；所有 permit 在退出该回调时关闭，不跨波复用。 */
interface DeathWaveActions {
  phase: Phase;
  day: number;
  permits: Array<ReturnType<World["openDeathAction"]>>;
  isCurrent: () => boolean;
}

/** 连续结算死亡波，动作阶段仍由 PhaseManager 推进。 */
export class DeathResolution {
  // 只捕获原结算器；每条关系边在原表达式处晚读 World、事件、日期及阶段。
  private readonly weddingDeathWave = (() => {
    const resolution = this;
    return new WeddingDeathWavePublication({
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
    },
  ): Promise<void> {
    const resolutionPhase = this.state.phase;
    const resolutionDay = this.state.day;
    const lastWordsPolicy = this.config?.lastWords?.policy ?? "awa_initial_wave_v1";
    const revealPolicy = this.config?.disclosure?.deathRevealPolicy ?? "awa_hidden_v1";
    const ownsFragrant = isFragrantPairBoard(this.world);
    const isCurrent = () =>
      this.state.phase === resolutionPhase &&
      this.state.day === resolutionDay &&
      !this.state.gameOver &&
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
    // 关系闭包先于标死、遗言和枪权判断；恋人／婚约追加的抑制死因不能等死亡 hook 后再补。
    const weddingInitial = this.weddingDeathWave.expand(pending, allSources, seen, nightOrigin);
    const linkedInitial = expandLoversWave(
      this.world,
      pending,
      allSources,
      this.events,
      nightOrigin,
      seen,
      nightEffects?.dreams,
    );
    for (const id of [...linkedInitial, ...weddingInitial]) {
      seen.add(id);
      initialPhases[id] = nightOrigin.has(id) ? Phase.Night : phase;
    }
    const fragrantInitial = ownsFragrant
      ? prepareFragrantDeathWave(this.world, resolutionDay, pending)
      : null;
    const fragrantRootPhase = fragrantInitial
      ? (initialPhases[fragrantInitial.rootId] ??
        (nightOrigin.has(fragrantInitial.rootId) ? Phase.Night : phase))
      : phase;
    if (fragrantInitial?.addedTargetId !== null && fragrantInitial?.addedTargetId !== undefined) {
      const id = fragrantInitial.addedTargetId;
      pending.push(id);
      seen.add(id);
      allSources[id] = [DeathCause.FragrantLink];
      initialPhases[id] = fragrantRootPhase;
      if (fragrantRootPhase === Phase.Night) nightOrigin.add(id);
    }
    const originPhases = new Map(
      pending.map((id) => [id, initialPhases[id] ?? (nightOrigin.has(id) ? Phase.Night : phase)]),
    );
    const publicLinkedInitial = [
      ...linkedInitial,
      ...(phase === Phase.Night ? [] : weddingInitial),
    ];
    if (publicLinkedInitial.length && !ownsFragrant)
      this.events.push({
        timestamp: Date.now(),
        type: "additional_deaths",
        payload: { deaths: publicLinkedInitial },
      });
    const initialUnit = openDeathWave("initial", resolutionDay, resolutionPhase, deathExecutionContext(nightEffects));
    let pendingUnits: readonly DeathWaveUnit[] = [initialUnit];
    let previousCommits: readonly DeathCommitReceipt[] = [];
    let firstBatch = true;
    let fragrantInitialCommitted = false;
    // 只收集原实例，在原 finally 位置尝试过期；先取消未提交双生波凭据，取消失败时过期尚未执行。
    // 已付款和死亡不回滚，不为统一清理吞掉原取消异常。
    const gunsToExpire: ReturnType<typeof firstDeathGuns> = [];

    try {
      // 空初始波仍执行原发布回调；空条目凭证只关联这次发布，不证明枪付款或整个死亡链完成。
      if (pending.length === 0 && nightEffects?.onInitialWaveCommitted && isCurrent()) {
        const receipt = new DeathCommitReceipt(
          planDeathWave(
            [],
            {},
            "initial",
            originPhases,
            deathWaveOriginalLives(nightEffects),
            deathWavePoisonMetadata(nightEffects),
            pendingUnits,
          ),
          Object.freeze([]),
        );
        const event = nightEffects.onInitialWaveCommitted([], {}, receipt);
        receipt.recordPublication(event, []);
      }
      while (pending.length > 0) {
        if (!isCurrent()) return;
        const deathPhase = firstBatch ? phase : this.state.phase;
        // 初始波整批标死；追加目标已在前一角色回调标死，再访仍执行原收尾，但不重复首次生命事实。
        const receipt = this.deathCommitter.markPlayersDead(
          pending,
          true,
          gunsToExpire,
          revealPolicy === "netease_2017_open_v1",
          allSources,
          nightEffects?.animalUnit ?? isCurrent,
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
        );
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
          await this.collectLastWords(
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
          );
          if (!isCurrent()) return;
        }

        const next = new Set<EntityId>();
        const nextCommits: DeathCommitReceipt[] = [];
        const nextUnits: DeathWaveUnit[] = [];
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
          try {
            await this.eventRegistry.onDeath(
              this.world,
              [deadId],
              allSources,
              (actorId, abilityId) =>
                this.collectDeathShot(
                  actorId,
                  firstBatch ? (initialPhases[actorId] ?? deathPhase) : deathPhase,
                  sourcePhase,
                  allSources,
                  actionProvider,
                  actions,
                  abilityId,
                  nightOrigin.has(actorId) && !(firstBatch && initialPhases[actorId] === Phase.Day),
                ),
              this.events,
              // 每个成功钩子提案同步进入这里；后面的钩子可见已标死目标，失败不丢弃先前提交。
              (result) => {
                if (!isCurrent()) return;
                const proposed = [...result.extraDeaths],
                  proposedSources = structuredClone(result.extraDeathSources),
                  nightTargets = [...(result.nightEffectTargets ?? [])];
                preflightDeathWaveData(proposed, proposedSources);
                preflightDeathWaveData(nightTargets, {});
                const additionalUnit = openDeathWave("additional", resolutionDay, resolutionPhase, deathExecutionContext(nightEffects));
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
                const charmTriggers: Array<{ binding: CharmBinding; receipt: CharmClaimReceipt }> =
                  [];
                for (const proposal of result.charmLinks ?? []) {
                  const binding = proposal.binding;
                  // 具体关系 owner 在原位置领取和查询保护；延迟 World，permit 失败不新增读取。
                  const trigger = attemptCharmTrigger(
                    binding,
                    allSources,
                    nativeHunterShotTargets,
                    seen,
                    () => this.world,
                    () =>
                      proposal.nightEffect &&
                      nightEffects?.dreams?.blocksNightCharm(this.world, binding.targetId, seen),
                  );
                  if (!trigger) continue;
                  if (trigger.kind === "blocked") {
                    this.events.push({
                      timestamp: Date.now(),
                      type: "charm_blocked",
                      payload: {
                        actorId: binding.actorId,
                        targetId: binding.targetId,
                        reason: "night_protection",
                      },
                    });
                    continue;
                  }
                  charmTriggers.push({ binding, receipt: trigger });
                  if (!proposed.includes(binding.targetId)) proposed.push(binding.targetId);
                  proposedSources[binding.targetId] = [
                    ...new Set([...(proposedSources[binding.targetId] ?? []), DeathCause.Charm]),
                  ];
                  if (proposal.nightEffect) nightTargets.push(binding.targetId);
                }
                const charmTargets = new Set(charmTriggers.map(({ binding }) => binding.targetId));
                for (const id of nightTargets) nightOrigin.add(id);
                if (nightEffects?.dreams && nightTargets.length)
                  for (const id of nightEffects.dreams.linkedDeaths(
                    this.world,
                    nightTargets,
                    new Set(Object.keys(allSources).map(Number)),
                  )) {
                    linked.add(id);
                    if (!proposed.includes(id)) proposed.push(id);
                    proposedSources[id] = [
                      ...new Set([...(proposedSources[id] ?? []), DeathCause.Dream]),
                    ];
                    nightOrigin.add(id);
                  }
                this.weddingDeathWave.expand(proposed, proposedSources, seen, nightOrigin);
                expandLoversWave(
                  this.world,
                  proposed,
                  proposedSources,
                  this.events,
                  nightOrigin,
                  seen,
                  nightEffects?.dreams,
                );
                const fragrantRoots = ownsFragrant
                  ? proposed.filter(
                      (id) =>
                        !next.has(id) &&
                        !seen.has(id) &&
                        !this.deathCommitter.isSettledLife(id) &&
                        this.world.getComponent(id, COMPONENT.Alive)?.alive,
                    )
                  : [];
                const fragrantGun = ownsFragrant
                  ? prepareFragrantDeathWave(this.world, resolutionDay, fragrantRoots)
                  : null;
                if (
                  fragrantGun?.addedTargetId !== null &&
                  fragrantGun?.addedTargetId !== undefined
                ) {
                  proposed.push(fragrantGun.addedTargetId);
                  proposedSources[fragrantGun.addedTargetId] = [DeathCause.FragrantLink];
                }
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
                      if (charmTargets.has(id))
                        allSources[id] = [
                          ...new Set([...(allSources[id] ?? []), DeathCause.Charm]),
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
                    originPhases.set(id, ownsFragrant ? this.state.phase : sourcePhase);
                    const commitIds = [id];
                    const receipt = this.deathCommitter.markPlayersDead(
                      commitIds,
                      false,
                      gunsToExpire,
                      revealCurrent(),
                      allSources,
                      nightEffects?.animalUnit ?? isCurrent,
                      planDeathWave(
                        commitIds,
                        allSources,
                        "additional",
                        originPhases,
                        shot ? new Map([[id, shot.targetScope]]) : undefined,
                        [],
                        [additionalUnit],
                      ),
                    );
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
                      charmTargets.has(id) ||
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
                  for (const { binding, receipt } of charmTriggers) {
                    const applied = commitCharmDeath(this.world, receipt);
                    if (applied?.kind === "applied")
                      this.events.push({
                        timestamp: Date.now(),
                        type: "charm_death",
                        payload: { actorId: binding.actorId, targetId: binding.targetId },
                      });
                  }
                  nightEffects?.dreams?.recordDeaths([...next, ...linked], this.events);
                  for (const permit of actions.permits.splice(0)) permit.close();
                } finally {
                  if (fragrantGun && !fragrantGunCommitted)
                    cancelFragrantDeathWave(this.world, fragrantGun);
                }
              },
              Object.freeze({
                day: resolutionDay,
                nativeHunterShotTargets,
                deferShotCommit: true,
                deathOriginPhase: sourcePhase,
                nightEffect: nightOrigin.has(deadId),
                blocksNightShot: (targetId: EntityId) =>
                  (nightEffects?.blocksPassiveNightShot?.(targetId) ?? false) ||
                  (nightEffects?.dreams?.blocksNightShot(this.world, targetId) ?? false),
                blocksNightCharm: (targetId: EntityId) =>
                  nightEffects?.dreams?.blocksNightCharm(this.world, targetId, seen) ?? false,
                eligibleDead: seen,
                isCurrent,
              }),
            );
          } finally {
            for (const permit of actions.permits) permit.close();
          }
        }

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

  /** 收集枪的选择而非消费弹药或杀死目标；窗口绑定原生命，回复和校验后仍须复核当前性。 */
  private async collectDeathShot(
    actorId: EntityId,
    deathPhase: Phase,
    deathOriginPhase: Phase,
    sources: DeathSources,
    actionProvider: ActionProvider,
    actions: DeathWaveActions,
    abilityId?: string,
    nightExchange: boolean = false,
  ): Promise<DeathShotSelection> {
    if (deathPhase === Phase.Night && nightmareFearBlocks(this.world, actorId, actions.day, true))
      return { kind: "invalid" };
    const isCurrent = () =>
      actions.isCurrent() &&
      this.state.phase === actions.phase &&
      this.state.day === actions.day &&
      !this.state.gameOver;
    const gun =
      abilityId === undefined
        ? undefined
        : activeDeathGun(this.world, actorId, abilityId, actions.day, true);
    if (abilityId !== undefined && !gun) return { kind: "invalid" };
    const role = this.world.getComponent(actorId, COMPONENT.Role);
    const nativeState =
      abilityId === undefined && role
        ? role.role === Role.Hunter
          ? getHunterState(role)
          : role.role === Role.WolfKing
            ? getWolfKingState(role)
            : undefined
        : undefined;
    const nativeHunter = role?.role === Role.Hunter;
    const nativePolicy = nativeState?.deathActionPolicy ?? "awa_qualified_sources_v1";
    const causeIdentity = JSON.stringify(sources[actorId] ?? []);
    const nativeCurrent = () =>
      !nativeState ||
      (this.world.getComponent(actorId, COMPONENT.Role) === role &&
        (role?.role === Role.Hunter
          ? getHunterState(role)
          : role?.role === Role.WolfKing
            ? getWolfKingState(role)
            : undefined) === nativeState &&
        (nativeState.deathActionPolicy ?? "awa_qualified_sources_v1") === nativePolicy &&
        JSON.stringify(sources[actorId] ?? []) === causeIdentity &&
        permitsDeathShot(sources[actorId] ?? [], nativePolicy, deathOriginPhase));
    const gunCurrent = gun
      ? captureDeathGun(this.world, actorId, gun, actions.day, isCurrent).isEligible
      : isCurrent;
    const permissionCurrent = () =>
      (!nativeHunter || demonHunterNativeGunCurrent(this.world, actorId)) &&
      gunCurrent() &&
      nativeCurrent();
    const eligible = () => permissionCurrent() && (!nativeState || nativeState.canShoot);
    if (!eligible()) return { kind: "invalid" };
    const permit = this.world.openDeathAction(
      actorId,
      "shoot",
      actions.phase,
      actions.day,
      permissionCurrent,
      abilityId,
    );
    actions.permits.push(permit);
    const requests = new GameActionRequestFactory(this.world, this.events, actions.day);
    for (let attempt = 1; attempt <= 3; attempt++) {
      // 每次重试重新捕获候选生命；同一编号复活或替换组件后，上一轮回复不能命中新生命。
      const targets = new Map(
        this.world.getAliveEntityIds().map((id) => [id, captureNightLife(this.world, id)]),
      );
      if (!eligible()) return { kind: "invalid" };
      const request = requests.create({
        phase: actions.phase,
        actorId: actorId,
        allowedTools: ["shoot"],
        stage:
          abilityId === undefined &&
          this.world.getComponent(actorId, COMPONENT.Role)?.role === Role.Hunter
            ? "hunter_shot"
            : "death_shot",
        requiresAction: true,
        summary: { key: "request.summary.death_shot" },
        context: {
          ...(this.config?.magician ||
          this.config?.evilKnight ||
          abilityId !== undefined ||
          this.world.getComponent(actorId, COMPONENT.Role)?.role === Role.AwakenedHiddenWolf
            ? { action_failure_policy: "error" as const, allow_fallback: false }
            : {}),
          ...(abilityId === undefined ? {} : { ability_id: abilityId }),
          trigger: "on_death",
          death_phase: deathPhase,
          ...(nativePolicy === "awa_day_deaths_v1" ? { death_origin_phase: deathOriginPhase } : {}),
          death_sources: [...(sources[actorId] ?? [])],
          death_action_id: permit.id,
          shoot_candidates: [...targets.keys()].filter((id) => id !== actorId),
          ...(attempt === 1 ? {} : { retry_attempt: attempt - 1, retry_max: 2 }),
        },
      });
      if (!eligible()) return { kind: "invalid" };
      if (this.config?.magician) assertMagicianRosterCurrent(this.world);
      const action = await actionProvider.getAction(request);
      if (this.config?.magician) assertMagicianRosterCurrent(this.world);
      if (
        !eligible() ||
        !this.world.hasDeathAction(
          actorId,
          "shoot",
          actions.phase,
          actions.day,
          permit.id,
          abilityId,
        )
      )
        return { kind: "invalid" };
      if (action?.name !== "shoot") {
        if (this.config?.magician) throw new Error("magician_shot_action_missing");
        if (this.config?.evilKnight) throw new Error("evil_knight_hunter_action_missing");
        continue;
      }
      const validated = this.toolGateway.validateAndSanitize(this.world, actorId, action, {
        phase: actions.phase,
        day: actions.day,
        deathActionId: permit.id,
        abilityId,
      });
      if (
        !eligible() ||
        !this.world.hasDeathAction(
          actorId,
          "shoot",
          actions.phase,
          actions.day,
          permit.id,
          abilityId,
        )
      )
        return { kind: "invalid" };
      if (!validated.ok || !validated.sanitizedCall) {
        if (this.config?.magician) throw new Error("magician_shot_action_invalid");
        if (this.config?.evilKnight) throw new Error("evil_knight_hunter_action_invalid");
        continue;
      }
      const targetId = validated.sanitizedCall.args.target_id;
      // 空枪也只是已授权选择，真正消耗留给随后处理该选择的角色钩子。
      if (targetId === null) return { kind: "pass", deathActionId: permit.id };
      const targetScope = targets.get(targetId);
      if (!targetScope || !livingNightLife(this.world, targetScope)) {
        if (this.config?.magician) throw new Error("magician_shot_target_stale");
        continue;
      }
      if (nightExchange && isMagicianBoard(this.world)) {
        const mapped = resolveMagicianNightTarget(this.world, actions.day, targetId, "death_shot");
        if (!mapped.isCurrent()) throw new Error("magician_shot_target_stale");
        return {
          kind: "shot",
          targetId: mapped.effectiveId,
          deathActionId: permit.id,
          targetScope: mapped.scope,
          mappingCurrent: mapped.isCurrent,
          ...(!mapped.scope.life.alive ? { mappedMiss: true as const } : {}),
        };
      }
      return { kind: "shot", targetId, deathActionId: permit.id, targetScope };
    }
    if (abilityId !== undefined && eligible()) throw new Error("gift_gun_valid_action_missing");
    return { kind: "invalid" };
  }

  /** 授予事实不替代发言窗口；每位死者等待回复后复核阶段、日期、终局与原生命许可，再写发言。 */
  private async collectLastWords(
    deadIds: EntityId[],
    phase: Phase,
    deathPhase: Phase,
    sources: DeathSources,
    actionProvider: ActionProvider,
    deathPhases: Readonly<Record<EntityId, Phase>>,
    scopeCurrent: () => boolean = () => true,
    policy: LastWordsPolicy = "awa_initial_wave_v1",
    wordsContext?: LastWordsGrantContext,
  ): Promise<void> {
    const requests = new GameActionRequestFactory(this.world, this.events, this.state.day);
    const day = this.state.day;
    for (const deadId of deadIds) {
      const actualDeathPhase = deathPhases[deadId] ?? deathPhase;
      if (
        !this.lastWordsMechanism.shouldGrantLastWords(
          actualDeathPhase,
          day,
          sources[deadId] ?? [],
          policy,
          wordsContext,
        )
      )
        continue;
      if (
        !scopeCurrent() ||
        this.state.phase !== phase ||
        this.state.day !== day ||
        this.state.gameOver
      )
        return;
      const permit = this.world.openDeathAction(deadId, "speak", phase, day, scopeCurrent);
      try {
        const request = requests.create({
          phase,
          actorId: deadId,
          allowedTools: ["speak"],
          stage: "last_words",
          requiresAction: true,
          summary: { key: "request.summary.last_words" },
          context: {
            trigger: "last_words",
            death_phase: actualDeathPhase,
            death_action_id: permit.id,
          },
        });
        if (!scopeCurrent() || !this.world.hasDeathAction(deadId, "speak", phase, day, permit.id))
          return;
        const action = await actionProvider.getAction(request);
        if (
          !scopeCurrent() ||
          this.state.phase !== phase ||
          this.state.day !== day ||
          this.state.gameOver ||
          !this.world.hasDeathAction(deadId, "speak", phase, day, permit.id)
        )
          return;
        if (action?.name !== "speak") {
          continue;
        }
        const validated = this.toolGateway.validateAndSanitize(this.world, deadId, action, {
          phase,
          day: this.state.day,
          deathActionId: permit.id,
        });
        if (!validated.ok || !validated.sanitizedCall) {
          continue;
        }
        if (
          !scopeCurrent() ||
          this.state.phase !== phase ||
          this.state.day !== day ||
          this.state.gameOver ||
          !this.world.hasDeathAction(deadId, "speak", phase, day, permit.id)
        )
          return;
        this.events.push({
          timestamp: Date.now(),
          type: "last_words_spoken",
          payload: {
            playerId: deadId,
            phase,
            day: this.state.day,
            text: validated.sanitizedCall.args.text,
          },
        });
      } finally {
        permit.close();
      }
    }
  }
}
