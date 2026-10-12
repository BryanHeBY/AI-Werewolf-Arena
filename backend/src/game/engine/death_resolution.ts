import { getSessionRecorder } from "../../recording/recording_context";
import { FRAGRANT_PAIR_POLICY } from "@ai-werewolf-arena/game-text";
import {
  isAnimalDreamBoard,
  filterAnimalLethalWave,
  prepareAnimalCatExpiry,
  animalAuthoritySnapshot,
  commitAnimalPufferKnifeDeath,
} from "../mechanisms/roles/animal_dream/authority";
import { appendAnimalFact } from "../mechanisms/roles/animal_dream/facts";
import {
  isFragrantPairBoard,
  prepareFragrantDeathWave,
  commitFragrantDeathWave,
  publishFragrantDeathWave,
  cancelFragrantDeathWave,
  fragrantAuthoritySnapshot,
  type FragrantWaveReceipt,
} from "../mechanisms/roles/fragrant_pair_seer/authority";
import {
  isNobleBodyBoard,
  closeServantForDeath,
} from "../mechanisms/roles/noble_secret_body/authority";
import { appendNobleContractClosure } from "../mechanisms/roles/noble_secret_body/facts";
import { assertMagicianRosterCurrent } from "../mechanisms/roles/magician/night_frame";
import {
  isMagicianBoard,
  resolveMagicianNightTarget,
} from "../mechanisms/roles/magician/night_frame";
import { nightmareFearBlocks } from "../mechanisms/roles/nightmare_shadow/night_frame";
import { demonHunterNativeGunCurrent } from "../mechanisms/roles/demon_hunter/authority";
import { expandWeddingDeaths, weddingGroup } from "../mechanisms/roles/ghost_bride/authority";
import { GHOST_BRIDE_POLICY } from "@ai-werewolf-arena/game-text";
import {
  recordWildChildDeathCommit,
  resolveWildChildDeathWave,
} from "../mechanisms/roles/wild_child/lifecycle";
import { expandLoversWave } from "../mechanisms/roles/cupid/relation";
import { permitsCharm } from "../mechanisms/roles/wolf_beauty/relation";
import { isRoleId } from "@ai-werewolf-arena/game-catalog";
import type { BoardConfig, LastWordsPolicy } from "../../core/domain/board";
import { captureNightLife, livingNightLife } from "../../core/domain/night_effects";
import { AliveComponent, aliveLifeVersion } from "../../core/domain/components/alive";
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
import type { DreamNightFrame } from "../mechanisms/roles/dreamer/night_frame";
import {
  claimCharm,
  commitCharmDeath,
  type CharmBinding,
} from "../mechanisms/roles/wolf_beauty/relation";
import { refreshHiddenWolfInheritance } from "../mechanisms/roles/hidden_wolf/inheritance";
import { refreshGargoyleInheritance } from "../mechanisms/roles/gargoyle/inheritance";
import { refreshMechanicalInheritance } from "../mechanisms/roles/mechanical_wolf/inheritance";
import { refreshAwakenedInheritance } from "../mechanisms/roles/awakened_hidden_wolf/inheritance";
import { expireLuckyAbilitiesOnDeath } from "../mechanisms/roles/ability_changes";
import {
  activeDeathGun,
  captureDeathGun,
  firstDeathGuns,
  finishDeathGuns,
} from "../mechanisms/roles/death_abilities";

import { getHunterState, getWolfKingState } from "../mechanisms/roles/private_state";

interface DeathWaveActions {
  phase: Phase;
  day: number;
  permits: Array<ReturnType<World["openDeathAction"]>>;
  isCurrent: () => boolean;
}

/** Resolves successive death waves without advancing the current action phase. */
export class DeathResolution {
  /** All inert actual facts precede fallible recording, so a failed prefix remains auditable. */
  private recordFragrantWave(
    receipt: FragrantWaveReceipt | null,
    ids: readonly number[],
    sources: DeathSources,
    origins: ReadonlyMap<number, Phase>,
    initialWave: boolean,
  ): void {
    const actorId = this.world.getEntityIdsByRole(Role.FragrantPhantom)[0]!,
      phases: Record<string, "night" | "day" | "voting"> = {};
    for (const id of ids) {
      const origin = origins.get(id) ?? this.state.phase;
      if (origin === Phase.GameOver) throw Error("fragrant_death_origin_invalid");
      phases[String(id)] = origin;
    }
    const wave = {
      policy: FRAGRANT_PAIR_POLICY,
      actorId,
      day: this.state.day,
      deaths: [...ids],
      deathSources: Object.fromEntries(ids.map((id) => [String(id), [...(sources[id] ?? [])]])),
      deathPhases: phases,
      initialWave,
    };
    this.events.push({
      timestamp: Date.now(),
      type: "fragrant_wave_committed",
      payload: wave,
      audience: Object.freeze([]),
    });
    const rootPhase = receipt ? phases[String(receipt.rootId)]! : null,
      link = receipt && {
        policy: FRAGRANT_PAIR_POLICY,
        actorId,
        day: receipt.day,
        bindingId: `fragrant:night:${receipt.day}`,
        pairIds: receipt.pairIds,
        rootId: receipt.rootId,
        addedTargetId: receipt.addedTargetId,
        rootPhase: rootPhase!,
        initialWave,
      };
    if (link)
      this.events.push({
        timestamp: Date.now(),
        type: "fragrant_link_triggered",
        payload: link,
        audience: Object.freeze([]),
      });
    // A public root may precede this wave (exile) or its recording (gun).
    if (receipt) {
      const publicRoot = [...this.events]
        .reverse()
        .find(
          (e) =>
            (e.type === "wolf_self_destruct" && e.payload.wolfId === receipt.rootId) ||
            (e.type === "voted_out" && e.payload.target === receipt.rootId) ||
            (e.type === "hunter_shot" && e.payload.targetId === receipt.rootId),
        );
      if (publicRoot) publishFragrantDeathWave(this.world, receipt, publicRoot);
    }
    getSessionRecorder()?.recordRequiredLogicOp({
      scope: "resolution",
      op: "fragrant_wave_committed",
      phase: this.state.phase,
      status: "ok",
      output: wave,
    });
    if (link)
      getSessionRecorder()?.recordRequiredLogicOp({
        scope: "resolution",
        op: "fragrant_link_triggered",
        phase: this.state.phase,
        status: "ok",
        output: link,
      });
  }
  private publishFragrantWave(receipt: FragrantWaveReceipt | null, event: GameEvent): void {
    if (
      receipt &&
      (event.type === "night_resolved" || event.type === "additional_deaths") &&
      event.payload.deaths.some((id) => receipt.pairIds.includes(id))
    )
      publishFragrantDeathWave(this.world, receipt, event);
  }
  private expandWeddingWave(
    ids: number[],
    sources: DeathSources,
    seen: ReadonlySet<number>,
    nightOrigin: Set<number>,
  ): number[] {
    const before = new Set(ids);
    for (const edge of expandWeddingDeaths(this.world, ids, sources, seen, nightOrigin)) {
      const group = weddingGroup(this.world)!;
      this.events.push({
        timestamp: Date.now(),
        type: "ghost_bride_partner_death",
        payload: {
          policy: GHOST_BRIDE_POLICY,
          groupId: group.groupId,
          day: this.state.day,
          phase: this.state.phase,
          ...edge,
        },
        audience: Object.freeze([]),
      });
    }
    return ids.filter((id) => !before.has(id));
  }
  private readonly lastWordsMechanism = getDefaultLastWordsMechanism();
  private readonly settledLives = new Map<
    EntityId,
    { component: AliveComponent; version: number | undefined }
  >();

  constructor(
    private readonly world: World,
    private readonly events: GameEvent[],
    private readonly toolGateway: ToolGateway,
    private readonly eventRegistry: EventRegistry,
    private readonly state: RuntimeSnapshot,
    private readonly config?: BoardConfig,
  ) {}

  async resolve(
    deadIds: EntityId[],
    sources: DeathSources,
    actionProvider: ActionProvider,
    phase: Phase,
    lastWordsPhase: Phase,
    deathPhases: Readonly<Record<EntityId, Phase>> = {},
    nightEffects?: {
      dreams?: DreamNightFrame;
      blocksPassiveNightShot?: (targetId: EntityId) => boolean;
      nightOriginIds?: readonly EntityId[];
      isCurrent?: () => boolean;
      onInitialWaveCommitted?: (deaths: readonly EntityId[], sources?: DeathSources) => GameEvent;
      animalUnit?: object;
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
    const ownsAnimal = isAnimalDreamBoard(this.world);
    const prepareAnimal = (
      ids: EntityId[],
      waveSources: DeathSources,
      sourcePhase: Phase,
    ): EntityId[] => {
      if (!ownsAnimal) return ids;
      const proposed = [...ids],
        filtered = filterAnimalLethalWave(
          this.world,
          resolutionDay,
          sourcePhase as "night" | "day" | "voting",
          ids,
          waveSources,
          nightEffects?.animalUnit ?? isCurrent,
        );
      appendAnimalFact(this.world, this.events, "animal_wave_prepared", {
        policy: "awa_animal_dream_v1",
        day: resolutionDay,
        phase: sourcePhase as "night" | "day" | "voting",
        proposedIds: proposed,
        blockedCatId: filtered.blockedCatId,
      });
      if (filtered.revealedCatId !== null)
        appendAnimalFact(this.world, this.events, "animal_cat_revealed", {
          policy: "awa_animal_dream_v1",
          day: resolutionDay,
          actorId: filtered.revealedCatId,
        });
      const actual = [...filtered.deaths],
        cat = filtered.blockedCatId,
        currentCatSources =
          cat === null
            ? []
            : (waveSources[cat] ?? []).filter(
                (c) => c === DeathCause.Exile || c === DeathCause.PufferRetaliation,
              );
      if (cat !== null) delete waveSources[cat];
      if (nightEffects?.animalUnit && !animalAuthoritySnapshot(this.world)!.unit!.expiryPrepared) {
        const expiry = prepareAnimalCatExpiry(this.world, nightEffects.animalUnit);
        if (expiry !== null) {
          const u = animalAuthoritySnapshot(this.world)!.unit!;
          appendAnimalFact(this.world, this.events, "animal_cat_expiry_prepared", {
            policy: "awa_animal_dream_v1",
            day: resolutionDay,
            actorId: expiry,
            unit: u.number,
            unitKind: u.kind,
          });
          if (!actual.includes(expiry)) actual.push(expiry);
          waveSources[expiry] = [
            ...new Set([
              ...(waveSources[expiry] ?? []),
              ...currentCatSources,
              DeathCause.WhiteCatExpiry,
            ]),
          ];
        }
      }
      return actual;
    };
    const preparedSources: DeathSources = structuredClone(sources);
    deadIds = prepareAnimal(deadIds, preparedSources, phase);
    const seen = new Set<EntityId>(
      deadIds.filter((id) => {
        return (
          this.world.getComponent<AliveComponent>(id, COMPONENT.Alive) !== undefined &&
          !this.isSettledLife(id)
        );
      }),
    );
    let pending = [...seen];
    const allSources: DeathSources = preparedSources;
    const nativeHunterShotTargets = new Set<EntityId>();
    const initialPhases: Record<EntityId, Phase> = structuredClone(deathPhases);
    const nightOrigin = new Set(nightEffects?.nightOriginIds ?? []);
    if (!isCurrent()) return;
    const weddingInitial = this.expandWeddingWave(pending, allSources, seen, nightOrigin);
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
    let firstBatch = true;
    let fragrantInitialCommitted = false;
    const gunsToExpire: ReturnType<typeof firstDeathGuns> = [];

    try {
      if (pending.length === 0 && nightEffects?.onInitialWaveCommitted && isCurrent())
        nightEffects.onInitialWaveCommitted([], {});
      while (pending.length > 0) {
        if (!isCurrent()) return;
        const deathPhase = firstBatch ? phase : this.state.phase;
        this.markPlayersDead(
          pending,
          true,
          gunsToExpire,
          revealPolicy === "netease_2017_open_v1",
          allSources,
          nightEffects?.animalUnit ?? isCurrent,
        );
        if (firstBatch && fragrantInitial) {
          commitFragrantDeathWave(this.world, fragrantInitial);
          fragrantInitialCommitted = true;
        }
        // Later gun waves were already marked and recorded in the gun callback.
        if (ownsFragrant && firstBatch)
          this.recordFragrantWave(
            firstBatch ? fragrantInitial : null,
            pending,
            allSources,
            originPhases,
            firstBatch,
          );
        if (firstBatch && nightEffects?.onInitialWaveCommitted) {
          const event = nightEffects.onInitialWaveCommitted(pending, allSources);
          this.publishFragrantWave(fragrantInitial, event);
        }
        if (ownsAnimal && firstBatch) {
          for (const id of pending)
            if (
              this.world.getComponent<RoleComponent>(id, COMPONENT.Role)?.role ===
                Role.Pufferfish &&
              (allSources[id] ?? []).includes(DeathCause.WolfKill)
            )
              appendAnimalFact(this.world, this.events, "animal_puffer_revealed", {
                policy: "awa_animal_dream_v1",
                day: resolutionDay,
                actorId: id,
                reason: "knife_death",
              });
          appendAnimalFact(this.world, this.events, "animal_wave_committed", {
            policy: "awa_animal_dream_v1",
            day: resolutionDay,
            phase: deathPhase as "night" | "day" | "voting",
            deaths: [...pending],
            deathSources: Object.fromEntries(
              pending.map((id) => [String(id), [...(allSources[id] ?? [])]]),
            ),
          });
        }
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
          this.publishFragrantWave(fragrantInitial, event);
        }
        resolveWildChildDeathWave(
          this.world,
          pending,
          allSources,
          resolutionDay,
          deathPhase,
          this.events,
        );
        nightEffects?.dreams?.recordDeaths(pending, this.events);
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
        for (const deadId of pending) {
          if (!isCurrent()) return;
          // Origin belongs to this death, independently of the current action phase.
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
              (result) => {
                if (!isCurrent()) return;
                const proposed = [...result.extraDeaths],
                  proposedSources = structuredClone(result.extraDeathSources),
                  nightTargets = [...(result.nightEffectTargets ?? [])];
                const shots = new Map(
                  (result.pendingShots ?? []).map((shot) => [shot.targetScope.id, shot]),
                );
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
                const charmBindings: CharmBinding[] = [];
                for (const proposal of result.charmLinks ?? []) {
                  const binding = proposal.binding;
                  if (
                    !permitsCharm(
                      allSources[binding.actorId] ?? [],
                      binding.deathLinkPolicy,
                      nativeHunterShotTargets.has(binding.actorId),
                    ) ||
                    !claimCharm(this.world, binding, seen)
                  )
                    continue;
                  if (
                    proposal.nightEffect &&
                    nightEffects?.dreams?.blocksNightCharm(this.world, binding.targetId, seen)
                  ) {
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
                  charmBindings.push(binding);
                  if (!proposed.includes(binding.targetId)) proposed.push(binding.targetId);
                  proposedSources[binding.targetId] = [
                    ...new Set([...(proposedSources[binding.targetId] ?? []), DeathCause.Charm]),
                  ];
                  if (proposal.nightEffect) nightTargets.push(binding.targetId);
                }
                const charmTargets = new Set(charmBindings.map((binding) => binding.targetId));
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
                this.expandWeddingWave(proposed, proposedSources, seen, nightOrigin);
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
                        !this.isSettledLife(id) &&
                        this.world.getComponent<AliveComponent>(id, COMPONENT.Alive)?.alive,
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
                  for (const id of proposed) {
                    if (next.has(id)) {
                      allSources[id] = [
                        ...new Set([...(allSources[id] ?? []), ...(proposedSources[id] ?? [])]),
                      ];
                      continue;
                    }
                    if (seen.has(id) || this.isSettledLife(id)) {
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
                    if (!this.world.getComponent<AliveComponent>(id, COMPONENT.Alive)) continue;
                    if (
                      ownsAnimal &&
                      !prepareAnimal([id], proposedSources, sourcePhase).includes(id)
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
                    this.markPlayersDead(
                      [id],
                      false,
                      gunsToExpire,
                      revealCurrent(),
                      allSources,
                      nightEffects?.animalUnit ?? isCurrent,
                    );
                    if (ownsAnimal)
                      appendAnimalFact(this.world, this.events, "animal_wave_committed", {
                        policy: "awa_animal_dream_v1",
                        day: resolutionDay,
                        phase: sourcePhase as "night" | "day" | "voting",
                        deaths: [id],
                        deathSources: { [String(id)]: [...(allSources[id] ?? [])] },
                      });
                    newlyMarked = true;
                    marked.push(id);
                    if (shot) {
                      if (shot.event.type === "hunter_shot") nativeHunterShotTargets.add(id);
                      this.events.push(shot.event);
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
                    if (fragrantGun) {
                      commitFragrantDeathWave(this.world, fragrantGun);
                      fragrantGunCommitted = true;
                    }
                    if (ownsFragrant)
                      this.recordFragrantWave(fragrantGun, marked, allSources, originPhases, false);
                    refreshHiddenWolfInheritance(this.world, this.events, this.state.day);
                    refreshGargoyleInheritance(this.world, this.events, this.state.day);
                    refreshMechanicalInheritance(this.world, this.state.day, this.events);
                    refreshAwakenedInheritance(this.world, this.state.day, this.events);
                  }
                  if (publicLinked.length) {
                    const event: GameEvent = {
                      timestamp: Date.now(),
                      type: "additional_deaths",
                      payload: { deaths: publicLinked },
                    };
                    this.events.push(event);
                    this.publishFragrantWave(fragrantGun, event);
                  }
                  for (const binding of charmBindings)
                    if (commitCharmDeath(this.world, binding))
                      this.events.push({
                        timestamp: Date.now(),
                        type: "charm_death",
                        payload: { actorId: binding.actorId, targetId: binding.targetId },
                      });
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

        pending = [...next];
        firstBatch = false;
      }
    } finally {
      if (fragrantInitial && !fragrantInitialCommitted)
        cancelFragrantDeathWave(this.world, fragrantInitial);
      finishDeathGuns(gunsToExpire, this.events);
    }
  }

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
    const role = this.world.getComponent<RoleComponent>(actorId, COMPONENT.Role);
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
          this.world.getComponent<RoleComponent>(actorId, COMPONENT.Role)?.role === Role.Hunter
            ? "hunter_shot"
            : "death_shot",
        requiresAction: true,
        summary: { key: "request.summary.death_shot" },
        context: {
          ...(this.config?.magician ||
          this.config?.evilKnight ||
          abilityId !== undefined ||
          this.world.getComponent<RoleComponent>(actorId, COMPONENT.Role)?.role ===
            Role.AwakenedHiddenWolf
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

  private isSettledLife(id: EntityId): boolean {
    const alive = this.world.getComponent<AliveComponent>(id, COMPONENT.Alive),
      settled = this.settledLives.get(id);
    return (
      alive !== undefined &&
      settled?.component === alive &&
      settled.version === aliveLifeVersion(alive)
    );
  }

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

  /**
   * 将待结算死亡名单真正写入存活状态。
   */
  private markPlayersDead(
    playerIds: EntityId[],
    refreshInheritance = true,
    gunsToExpire: ReturnType<typeof firstDeathGuns> = [],
    reveal = false,
    sources: DeathSources = {},
    animalScope?: object | (() => boolean),
  ): void {
    for (const id of playerIds) {
      const alive = this.world.getComponent<AliveComponent>(id, COMPONENT.Alive);
      if (!alive) {
        continue;
      }
      const firstSettlement = !this.isSettledLife(id);
      if (firstSettlement) recordWildChildDeathCommit(this.world, id);
      alive.alive = false;
      if (firstSettlement && isAnimalDreamBoard(this.world)) {
        if (
          (sources[id] ?? []).includes(DeathCause.WolfKill) &&
          this.world.getComponent<RoleComponent>(id, COMPONENT.Role)?.role === Role.Pufferfish
        ) {
          commitAnimalPufferKnifeDeath(
            this.world,
            this.state.day,
            sources[id] ?? [],
            animalScope ?? (() => !this.state.gameOver),
          );
        }
        if ((sources[id] ?? []).includes(DeathCause.Exile))
          this.events.push({ timestamp: Date.now(), type: "voted_out", payload: { target: id } });
        else if (
          (sources[id] ?? []).some(
            (c) => c === DeathCause.PufferRetaliation || c === DeathCause.WhiteCatExpiry,
          )
        )
          this.events.push({
            timestamp: Date.now(),
            type: "additional_deaths",
            payload: { deaths: [id] },
          });
      }
      if (firstSettlement && isNobleBodyBoard(this.world)) {
        const closed = closeServantForDeath(this.world, this.state.day, id);
        const payload = {
          policy: "awa_noble_secret_body_v1" as const,
          actorId: id,
          day: this.state.day,
          causes: [...(sources[id] ?? [])],
        };
        this.events.push({
          timestamp: Date.now(),
          type: "noble_body_death_committed",
          payload,
          audience: Object.freeze([]),
        });
        getSessionRecorder()?.recordRequiredLogicOp({
          scope: "resolution",
          op: "noble_body_death_committed",
          phase: this.state.phase,
          status: "ok",
          output: {
            policy: payload.policy,
            playerId: id,
            day: payload.day,
            causes: payload.causes,
          },
        });
        if (closed)
          appendNobleContractClosure(
            this.world,
            this.state.day,
            closed,
            this.events,
            this.state.phase,
          );
      }
      const role = this.world.getComponent<RoleComponent>(id, COMPONENT.Role)?.role;
      if (reveal && firstSettlement && isRoleId(role))
        this.events.push({
          timestamp: Date.now(),
          type: "player_role_revealed",
          payload: { playerId: id, role },
        });
      gunsToExpire.push(...firstDeathGuns(this.world, id));
      expireLuckyAbilitiesOnDeath(this.world, id, this.events);
      this.settledLives.set(id, { component: alive, version: aliveLifeVersion(alive) });
    }
    if (refreshInheritance) {
      refreshHiddenWolfInheritance(this.world, this.events, this.state.day);
      refreshGargoyleInheritance(this.world, this.events, this.state.day);
      refreshMechanicalInheritance(this.world, this.state.day, this.events);
      refreshAwakenedInheritance(this.world, this.state.day, this.events);
    }
  }
}
