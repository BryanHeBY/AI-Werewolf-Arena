import { AliveComponent, aliveLifeVersion } from "../../../../core/domain/components/alive";
import { COMPONENT } from "../../../../core/domain/components/names";
import { DeathCause, type EntityId, type GameEvent } from "../../../../core/domain/model";
import type { World } from "../../../../core/domain/world";
import type { DamageResolutionResult } from "../../../../core/domain/systems/damage_resolution_system";

export interface DreamNightLink {
  actorId: EntityId;
  targetId: EntityId;
  day: number;
  abilityId?: string;
  consecutive: boolean;
  protectionPolicy?: import("../../../../core/domain/board").DreamProtectionPolicy;
  actorLife: AliveComponent;
  actorVersion: number | undefined;
  targetLife: AliveComponent;
  targetVersion: number | undefined;
}
type DreamReason = Extract<GameEvent, { type: "dream_death" }>["payload"];
const committedNights = new WeakMap<World, Set<number>>();
export function markDreamNightCommitted(world: World, day: number): void {
  const days = committedNights.get(world) ?? new Set<number>();
  days.add(day);
  committedNights.set(world, days);
}
export function hasDreamNightCommit(world: World, day: number): boolean {
  return committedNights.get(world)?.has(day) === true;
}

/** One night's private effects. Component references never enter player state or recordings. */
export class DreamNightFrame {
  private readonly reasons = new Map<EntityId, DreamReason[]>();
  private readonly emitted = new Set<string>();
  constructor(private readonly links: readonly DreamNightLink[]) {}

  private targetCurrent(world: World, link: DreamNightLink): boolean {
    return (
      world.getComponent(link.targetId, COMPONENT.Alive) === link.targetLife &&
      link.targetLife.alive &&
      link.targetVersion !== undefined &&
      aliveLifeVersion(link.targetLife) === link.targetVersion
    );
  }
  private targetDeathCurrent(
    world: World,
    link: DreamNightLink,
    eligible: ReadonlySet<EntityId>,
  ): boolean {
    return (
      eligible.has(link.targetId) &&
      world.getComponent(link.targetId, COMPONENT.Alive) === link.targetLife &&
      !link.targetLife.alive &&
      link.targetVersion !== undefined &&
      aliveLifeVersion(link.targetLife) === link.targetVersion + 1
    );
  }
  private actorCurrent(world: World, link: DreamNightLink): boolean {
    return (
      world.getComponent(link.actorId, COMPONENT.Alive) === link.actorLife &&
      link.actorVersion !== undefined &&
      aliveLifeVersion(link.actorLife) === link.actorVersion + (link.actorLife.alive ? 0 : 1)
    );
  }
  protectedTargets(world: World): EntityId[] {
    return [
      ...new Set(
        this.links
          .filter((link) => this.targetCurrent(world, link) && this.actorCurrent(world, link))
          .map((link) => link.targetId),
      ),
    ];
  }
  immuneNightTargets(world: World): EntityId[] {
    return this.links
      .filter(
        (link) =>
          link.protectionPolicy === "netease_2026_night_immunity_v1" &&
          this.targetCurrent(world, link) &&
          this.actorCurrent(world, link),
      )
      .map((link) => link.targetId);
  }
  blocksNightShot(world: World, targetId: EntityId): boolean {
    return this.protectedTargets(world).includes(targetId);
  }
  blocksNightCharm(world: World, targetId: EntityId, eligibleDead: ReadonlySet<EntityId>): boolean {
    return this.links.some(
      (link) =>
        link.targetId === targetId &&
        this.actorCurrent(world, link) &&
        (this.targetCurrent(world, link) || this.targetDeathCurrent(world, link, eligibleDead)),
    );
  }

  consecutiveDeaths(world: World): EntityId[] {
    const deaths = new Set<EntityId>();
    for (const link of this.links)
      if (link.consecutive && this.targetCurrent(world, link) && this.actorCurrent(world, link)) {
        deaths.add(link.targetId);
        this.reason(link, "consecutive");
      }
    return [...deaths];
  }
  private reason(link: DreamNightLink, reason: DreamReason["reason"]): void {
    const facts = this.reasons.get(link.targetId) ?? [];
    if (
      !facts.some(
        (fact) =>
          fact.actorId === link.actorId &&
          fact.abilityId === link.abilityId &&
          fact.reason === reason,
      )
    )
      facts.push({
        actorId: link.actorId,
        targetId: link.targetId,
        day: link.day,
        reason,
        ...(link.abilityId ? { abilityId: link.abilityId } : {}),
      });
    this.reasons.set(link.targetId, facts);
  }
  linkedDeaths(
    world: World,
    nightDeaths: readonly EntityId[],
    eligibleDead: ReadonlySet<EntityId> = new Set(),
  ): EntityId[] {
    const deaths = new Set(nightDeaths),
      added = new Set<EntityId>();
    let changed = true;
    while (changed) {
      changed = false;
      for (const link of this.links)
        if (
          deaths.has(link.actorId) &&
          this.actorCurrent(world, link) &&
          (this.targetCurrent(world, link) || this.targetDeathCurrent(world, link, eligibleDead))
        ) {
          added.add(link.targetId);
          this.reason(link, "linked");
          if (!deaths.has(link.targetId)) {
            deaths.add(link.targetId);
            changed = true;
          }
        }
    }
    return [...added];
  }
  expandInitialDamage(world: World, damage: DamageResolutionResult): void {
    for (const targetId of this.linkedDeaths(world, damage.deaths)) {
      if (!damage.deaths.includes(targetId)) damage.deaths.push(targetId);
      damage.deathSources[targetId] = [
        ...new Set([...(damage.deathSources[targetId] ?? []), DeathCause.Dream]),
      ];
    }
  }
  recordDeaths(deadIds: readonly EntityId[], events: GameEvent[]): void {
    for (const targetId of deadIds)
      for (const fact of this.reasons.get(targetId) ?? []) {
        const key = `${fact.actorId}:${fact.abilityId ?? "native"}:${fact.targetId}:${fact.reason}`;
        if (this.emitted.has(key)) continue;
        this.emitted.add(key);
        events.push({ timestamp: Date.now(), type: "dream_death", payload: { ...fact } });
      }
  }
}
