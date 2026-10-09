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
  type DeathSources,
  type DeathShotSelection,
} from "../../core/domain/model";
import type { RoleComponent } from "../../core/domain/components/role";
import { World } from "../../core/domain/world";
import { ToolGateway } from "../gateway/tool_gateway";
import { getDefaultLastWordsMechanism } from "../mechanisms/last_words/last_words_mechanism";
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

interface DeathWaveActions {
  phase: Phase;
  day: number;
  permits: Array<ReturnType<World["openDeathAction"]>>;
  isCurrent: () => boolean;
}

/** Resolves successive death waves without advancing the current action phase. */
export class DeathResolution {
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
      nightOriginIds?: readonly EntityId[];
      isCurrent?: () => boolean;
    },
  ): Promise<void> {
    const resolutionPhase = this.state.phase;
    const resolutionDay = this.state.day;
    const isCurrent = () =>
      this.state.phase === resolutionPhase &&
      this.state.day === resolutionDay &&
      !this.state.gameOver &&
      (nightEffects?.isCurrent?.() ?? true);
    const seen = new Set<EntityId>(
      deadIds.filter((id) => {
        return (
          this.world.getComponent<AliveComponent>(id, COMPONENT.Alive) !== undefined &&
          !this.isSettledLife(id)
        );
      }),
    );
    let pending = [...seen];
    const allSources: DeathSources = structuredClone(sources);
    const initialPhases = structuredClone(deathPhases);
    const nightOrigin = new Set(nightEffects?.nightOriginIds ?? []);
    let firstBatch = true;
    const gunsToExpire: ReturnType<typeof firstDeathGuns> = [];

    try {
      while (pending.length > 0) {
        if (!isCurrent()) return;
        const deathPhase = firstBatch ? phase : this.state.phase;
        this.markPlayersDead(pending, true, gunsToExpire);
        nightEffects?.dreams?.recordDeaths(pending, this.events);
        if (firstBatch) {
          this.lastWordsMechanism.recordLastWordsGranted(
            this.world,
            pending,
            phase,
            lastWordsPhase,
            this.state.day,
            this.events,
            allSources,
            initialPhases,
          );
          await this.collectLastWords(
            pending,
            lastWordsPhase,
            phase,
            allSources,
            actionProvider,
            initialPhases,
            isCurrent,
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
                  allSources,
                  actionProvider,
                  actions,
                  abilityId,
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
                const charmBindings: CharmBinding[] = [];
                for (const proposal of result.charmLinks ?? []) {
                  const binding = proposal.binding;
                  if (!claimCharm(this.world, binding, seen)) continue;
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
                for (const id of proposed) {
                  if (next.has(id)) {
                    allSources[id] = [
                      ...new Set([...(allSources[id] ?? []), ...(proposedSources[id] ?? [])]),
                    ];
                    continue;
                  }
                  if (seen.has(id) || this.isSettledLife(id)) {
                    if (linked.has(id))
                      allSources[id] = [...new Set([...(allSources[id] ?? []), DeathCause.Dream])];
                    if (charmTargets.has(id))
                      allSources[id] = [...new Set([...(allSources[id] ?? []), DeathCause.Charm])];
                    continue;
                  }
                  if (!this.world.getComponent<AliveComponent>(id, COMPONENT.Alive)) continue;
                  let shot = shots.get(id);
                  if (
                    shot &&
                    (!livingNightLife(this.world, shot.targetScope) || shot.isCurrent?.() === false)
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
                  this.markPlayersDead([id], false, gunsToExpire);
                  newlyMarked = true;
                  if (shot) this.events.push(shot.event);
                  if (
                    charmTargets.has(id) ||
                    (linked.has(id) && !result.extraDeaths.includes(id)) ||
                    (!shot && !(proposedSources[id] ?? []).includes(DeathCause.Shot))
                  )
                    publicLinked.push(id);
                  next.add(id);
                }
                if (newlyMarked) {
                  refreshHiddenWolfInheritance(this.world, this.events, this.state.day);
                  refreshGargoyleInheritance(this.world, this.events, this.state.day);
                  refreshMechanicalInheritance(this.world, this.state.day, this.events);
                  refreshAwakenedInheritance(this.world, this.state.day, this.events);
                }
                if (publicLinked.length)
                  this.events.push({
                    timestamp: Date.now(),
                    type: "additional_deaths",
                    payload: { deaths: publicLinked },
                  });
                for (const binding of charmBindings)
                  if (commitCharmDeath(this.world, binding))
                    this.events.push({
                      timestamp: Date.now(),
                      type: "charm_death",
                      payload: { actorId: binding.actorId, targetId: binding.targetId },
                    });
                nightEffects?.dreams?.recordDeaths([...next, ...linked], this.events);
                for (const permit of actions.permits.splice(0)) permit.close();
              },
              {
                day: resolutionDay,
                deferShotCommit: true,
                nightEffect: nightOrigin.has(deadId),
                blocksNightShot: (targetId) =>
                  nightEffects?.dreams?.blocksNightShot(this.world, targetId) ?? false,
                blocksNightCharm: (targetId) =>
                  nightEffects?.dreams?.blocksNightCharm(this.world, targetId, seen) ?? false,
                eligibleDead: seen,
                isCurrent,
              },
            );
          } finally {
            for (const permit of actions.permits) permit.close();
          }
        }

        pending = [...next];
        firstBatch = false;
      }
    } finally {
      finishDeathGuns(gunsToExpire, this.events);
    }
  }

  private async collectDeathShot(
    actorId: EntityId,
    deathPhase: Phase,
    sources: DeathSources,
    actionProvider: ActionProvider,
    actions: DeathWaveActions,
    abilityId?: string,
  ): Promise<DeathShotSelection> {
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
    const eligible = gun
      ? captureDeathGun(this.world, actorId, gun, actions.day, isCurrent).isEligible
      : isCurrent;
    if (!eligible()) return { kind: "invalid" };
    const permit = this.world.openDeathAction(
      actorId,
      "shoot",
      actions.phase,
      actions.day,
      isCurrent,
      abilityId,
    );
    actions.permits.push(permit);
    const requests = new GameActionRequestFactory(this.world, this.events, actions.day);
    for (let attempt = 1; attempt <= 3; attempt++) {
      const targets = new Map(
        this.world.getAliveEntityIds().map((id) => [id, captureNightLife(this.world, id)]),
      );
      const action = await actionProvider.getAction(
        requests.create({
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
            ...(abilityId !== undefined ||
            this.world.getComponent<RoleComponent>(actorId, COMPONENT.Role)?.role ===
              Role.AwakenedHiddenWolf
              ? { action_failure_policy: "error" as const, allow_fallback: false }
              : {}),
            ...(abilityId === undefined ? {} : { ability_id: abilityId }),
            trigger: "on_death",
            death_phase: deathPhase,
            death_sources: [...(sources[actorId] ?? [])],
            death_action_id: permit.id,
            ...(attempt === 1 ? {} : { retry_attempt: attempt - 1, retry_max: 2 }),
          },
        }),
      );
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
      if (action?.name !== "shoot") continue;
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
      if (!validated.ok || !validated.sanitizedCall) continue;
      const targetId = validated.sanitizedCall.args.target_id;
      if (targetId === null) return { kind: "pass", deathActionId: permit.id };
      const targetScope = targets.get(targetId);
      if (!targetScope || !livingNightLife(this.world, targetScope)) continue;
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
  ): Promise<void> {
    const requests = new GameActionRequestFactory(this.world, this.events, this.state.day);
    const day = this.state.day;
    for (const deadId of deadIds) {
      const actualDeathPhase = deathPhases[deadId] ?? deathPhase;
      if (
        !this.lastWordsMechanism.shouldGrantLastWords(actualDeathPhase, day, sources[deadId] ?? [])
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
        const action = await actionProvider.getAction(
          requests.create({
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
          }),
        );
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
  ): void {
    for (const id of playerIds) {
      const alive = this.world.getComponent<AliveComponent>(id, COMPONENT.Alive);
      if (!alive) {
        continue;
      }
      alive.alive = false;
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
