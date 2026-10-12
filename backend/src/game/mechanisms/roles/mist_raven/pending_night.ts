/**
 * Owns handed-off Mist damage and the bounded Snake reaction window. Inputs are captured
 * original lives and copied pending damage; outputs are claimed reactions and finalized damage.
 * Finish or abort retires the pending night without replacing any target body.
 */
import {
  AliveComponent,
  aliveLifeDescriptor,
  aliveLifeVersion,
} from "../../../../core/domain/components/alive";
import { COMPONENT } from "../../../../core/domain/components/names";
import { DeathCause } from "../../../../core/domain/deaths";
import type { World } from "../../../../core/domain/world";
import type { DamageResolutionResult } from "../../../../core/domain/systems/damage_resolution_system";
import type { DreamNightFrame } from "../dreamer/night_frame";

type PendingStatus = "pending" | "committing" | "committed" | "aborted";
interface OriginalLife {
  readonly life: AliveComponent;
  readonly version: number;
}
function copyDamage(damage: DamageResolutionResult): DamageResolutionResult {
  return {
    deaths: [...damage.deaths],
    deathSources: Object.fromEntries(
      damage.deaths.map((id) => [id, [...(damage.deathSources[id] ?? [])]]),
    ),
  };
}
function factoryLife(life: AliveComponent): boolean {
  const original = aliveLifeDescriptor(life);
  if (!original) return false;
  const current = Object.getOwnPropertyDescriptor(life, "alive");
  return (
    !!original &&
    !!current &&
    current.get === original.get &&
    current.set === original.set &&
    current.enumerable === original.enumerable &&
    current.configurable === original.configurable
  );
}

/** One delayed mist-board night, owned solely by its PhaseManager. No phase or death is committed here. */
export class MistPendingNight {
  private currentStatus: PendingStatus = "pending";
  private readonly lives = new Map<number, OriginalLife>();
  private readonly directDamage: DamageResolutionResult;
  private finalDamage: DamageResolutionResult | undefined;
  private preparing = false;
  private finishing = false;
  private validating = false;

  constructor(
    private readonly world: World,
    readonly day: number,
    readonly wolfTarget: number | null,
    directDamage: DamageResolutionResult,
    private readonly dreams: DreamNightFrame,
  ) {
    if (!Number.isSafeInteger(day) || day < 1 || day >= Number.MAX_SAFE_INTEGER)
      throw new Error("mist_pending_night_invalid");
    // Future linked targets are not necessarily in the direct death list.
    for (const id of world.entityIds()) {
      const life = world.getComponent(id, COMPONENT.Alive);
      if (!life) continue;
      if (!factoryLife(life)) throw new Error("mist_pending_life_invalid");
      const version = life && aliveLifeVersion(life);
      if (!life || version === undefined) throw new Error("mist_pending_life_invalid");
      if (life.alive) this.lives.set(id, Object.freeze({ life, version }));
    }
    if (
      (wolfTarget !== null && !this.lives.has(wolfTarget)) ||
      new Set(directDamage.deaths).size !== directDamage.deaths.length ||
      Object.keys(directDamage.deathSources).some(
        (key) => !directDamage.deaths.includes(Number(key)),
      ) ||
      directDamage.deaths.some(
        (id) =>
          !this.lives.has(id) ||
          !directDamage.deathSources[id]?.length ||
          directDamage.deathSources[id]!.some(
            (source) => !Object.values(DeathCause).includes(source),
          ),
      )
    )
      throw new Error("mist_pending_damage_invalid");
    this.directDamage = copyDamage(directDamage);
  }

  get status(): PendingStatus {
    return this.currentStatus;
  }

  private livingOriginal(id: number): boolean {
    const scope = this.lives.get(id);
    return (
      !!scope &&
      this.world.getComponent(id, COMPONENT.Alive) === scope.life &&
      factoryLife(scope.life) &&
      scope.life.alive &&
      aliveLifeVersion(scope.life) === scope.version
    );
  }

  /** The original knife remains knowable even when it was protected or publicly died by blast. */
  snakeTargets(actorId: number): number[] {
    return this.wolfTarget !== null &&
      this.livingOriginal(this.wolfTarget) &&
      (this.wolfTarget !== actorId || this.day === 1)
      ? [this.wolfTarget]
      : [];
  }

  /** Claim synchronously before any badge, snake or other await, including the blast path. */
  claim(isCurrent: () => boolean): void {
    if (this.currentStatus !== "pending") throw new Error("mist_pending_night_reentry");
    this.currentStatus = "committing";
    this.requireCurrent(isCurrent);
  }

  private requireCurrent(isCurrent: () => boolean): void {
    let current: boolean;
    this.validating = true;
    try {
      current = isCurrent();
    } catch (error) {
      this.abort();
      throw error;
    } finally {
      this.validating = false;
    }
    if (!current || this.currentStatus !== "committing") {
      this.abort();
      throw new Error("mist_pending_night_stale");
    }
  }

  /** Uses only already resolved direct sources; status marks are never consumed a second time. */
  prepareFinalDamage(
    healedTarget: number | null,
    isCurrent: () => boolean,
  ): DamageResolutionResult {
    if (this.currentStatus !== "committing" || this.preparing || this.validating)
      throw new Error("mist_pending_night_reentry");
    this.preparing = true;
    this.requireCurrent(isCurrent);
    if (
      healedTarget !== null &&
      (healedTarget !== this.wolfTarget || !this.livingOriginal(healedTarget))
    ) {
      this.abort();
      throw new Error("mist_pending_heal_invalid");
    }
    const damage = copyDamage(this.directDamage);
    for (const id of damage.deaths) {
      if (!this.livingOriginal(id)) delete damage.deathSources[id];
      else if (id === healedTarget)
        damage.deathSources[id] = damage.deathSources[id]!.filter(
          (source) => source !== DeathCause.WolfKill,
        );
    }
    damage.deaths = damage.deaths.filter((id) => !!damage.deathSources[id]?.length);
    for (const id of Object.keys(damage.deathSources).map(Number))
      if (!damage.deaths.includes(id)) delete damage.deathSources[id];
    // linkedDeaths writes causal reasons; do this once, after the snake has been decided.
    // DreamNightFrame also reads actors/targets outside the direct death list.
    for (const [id, scope] of this.lives) {
      if (this.world.getComponent(id, COMPONENT.Alive) === scope.life && !factoryLife(scope.life)) {
        this.abort();
        throw new Error("mist_pending_life_invalid");
      }
    }
    try {
      this.dreams.expandInitialDamage(this.world, damage);
    } catch (error) {
      this.abort();
      throw error;
    }
    if (this.currentStatus !== "committing") throw new Error("mist_pending_night_stale");
    this.finalDamage = copyDamage(damage);
    return copyDamage(damage);
  }

  /** Called only after DeathResolution has actually committed the prepared original lives. */
  finish(isCurrent: () => boolean): void {
    if (
      this.currentStatus !== "committing" ||
      !this.finalDamage ||
      this.finishing ||
      this.validating
    )
      throw new Error("mist_pending_night_reentry");
    this.finishing = true;
    this.requireCurrent(isCurrent);
    if (
      this.finalDamage.deaths.some((id) => {
        const scope = this.lives.get(id);
        return (
          !scope ||
          this.world.getComponent(id, COMPONENT.Alive) !== scope.life ||
          !factoryLife(scope.life) ||
          scope.life.alive ||
          aliveLifeVersion(scope.life) !== scope.version + 1
        );
      })
    ) {
      this.abort();
      throw new Error("mist_pending_night_unsettled");
    }
    this.currentStatus = "committed";
  }

  abort(): void {
    if (this.currentStatus === "pending" || this.currentStatus === "committing")
      this.currentStatus = "aborted";
  }
}
