/**
 * Defines runtime night-effect claim data and original-life identity checks. Inputs are World
 * component references and sourced effect claims; outputs are captured life/version scopes and
 * the mechanical damage fold. These handles never become serialized player knowledge, and this
 * helper does not mark a player dead.
 */
import type { DeathCause } from "./deaths";
import { COMPONENT } from "./components/names";
import { aliveLifeVersion, type AliveComponent } from "./components/alive";
import type { World } from "./world";
import type { EntityId } from "./identity";
import type { StatusMarksComponent } from "./components/status_marks";

/** Queries original life and mark identity without exposing component commands. */
export interface NightEffectQuery {
  getComponent(id: EntityId, name: typeof COMPONENT.Alive): Readonly<AliveComponent> | undefined;
  getComponent(id: EntityId, name: typeof COMPONENT.StatusMarks): object | undefined;
}

/** Runtime-only ownership. Component references never enter events or recordings. */
export interface NightLifeScope {
  readonly id: EntityId;
  readonly life: AliveComponent;
  readonly version: number;
}
export interface NightPoisonClaim {
  readonly source: NightLifeScope;
  readonly target: NightLifeScope;
  readonly isCurrent?: () => boolean;
}
export interface NightFoxInspectionClaim {
  readonly target: NightLifeScope;
  /** Target binding survives the phase change before first-day sheriff settlement. */
  readonly isTargetCurrent: () => boolean;
  readonly isCurrent: () => boolean;
}
export interface NightGuardClaim {
  readonly isCurrent?: () => boolean;
  readonly contribution?: object;
  readonly target: NightLifeScope;
  readonly marks: StatusMarksComponent;
}
export interface NightMerchantBacklash {
  readonly target: NightLifeScope;
  readonly isCurrent: () => boolean;
}
export interface NightBlackMarketBacklash {
  readonly target: NightLifeScope;
  readonly isCurrent: () => boolean;
}
/** Swallowing backlash is a separate attack, never a merchant effect or dream death. */
export interface NightRadiantBacklash {
  readonly target: NightLifeScope;
  readonly isCurrent: () => boolean;
}
export function captureNightLife(world: World, id: EntityId): NightLifeScope | null {
  const life = world.getComponent(id, COMPONENT.Alive),
    version = life && aliveLifeVersion(life);
  return life?.alive && version !== undefined ? { id, life, version } : null;
}
export function sameNightLife(world: NightEffectQuery, scope: NightLifeScope): boolean {
  return (
    world.getComponent(scope.id, COMPONENT.Alive) === scope.life &&
    aliveLifeVersion(scope.life) === scope.version
  );
}
export function livingNightLife(world: NightEffectQuery, scope: NightLifeScope): boolean {
  return sameNightLife(world, scope) && scope.life.alive;
}

/** A submitted mechanical effect binds original bodies; inventories remain in their owner. */
export interface NightMechanicalEffect {
  readonly actorId: EntityId;
  readonly target: NightLifeScope;
  /** Recheck the submitting owner's role, state, life and phase without changing it. */
  readonly isCurrent: () => boolean;
}
export interface NightMechanicalEffects {
  readonly shields: readonly NightMechanicalEffect[];
  readonly attacks: readonly NightMechanicalEffect[];
  readonly failures: readonly NightMechanicalEffect[];
}
/** Awakened guard absorbs toxins; its extra knife follows ordinary protection. */
export interface NightAwakenedEffect {
  readonly actorId: EntityId;
  readonly target: NightLifeScope;
  /** Paid effects recheck their original owner, rather than the closed action window. */
  readonly isCurrent: () => boolean;
}
export interface NightAwakenedEffects {
  readonly shields: readonly NightAwakenedEffect[];
  readonly attacks: readonly NightAwakenedEffect[];
}
/** God-only causal facts. Player projections must not expose the poison's source. */
export interface NightPoisonReflection {
  readonly actorId: EntityId;
  readonly protectedTargetId: EntityId;
  readonly casterId: EntityId;
}
export interface MechanicalDamagePlan {
  readonly shields: ReadonlySet<EntityId>;
  readonly directPoisonTargets: ReadonlySet<EntityId>;
  readonly reflectedPoisonTargets: ReadonlySet<EntityId>;
  readonly attacks: ReadonlySet<EntityId>;
  readonly failures: ReadonlySet<EntityId>;
  readonly reflections: readonly NightPoisonReflection[];
}
/** Fold each original toxin once; reflected toxins are never fed back through shields. */
export function planMechanicalDamage(
  world: NightEffectQuery,
  effects: NightMechanicalEffects | undefined,
  poisons: readonly NightPoisonClaim[] = [],
  absorbedPoisonTargets: ReadonlySet<EntityId> = new Set(),
): MechanicalDamagePlan {
  const shields = new Map<EntityId, NightMechanicalEffect>();
  for (const shield of effects?.shields ?? []) {
    if (shield.isCurrent() && livingNightLife(world, shield.target)) {
      shields.set(shield.target.id, shield);
    }
  }
  const directPoisonTargets = new Set<EntityId>();
  const reflectedPoisonTargets = new Set<EntityId>();
  const reflections: NightPoisonReflection[] = [];
  for (const poison of poisons) {
    if (
      poison.isCurrent?.() === false ||
      !livingNightLife(world, poison.target) ||
      absorbedPoisonTargets.has(poison.target.id)
    )
      continue;
    const shield = shields.get(poison.target.id);
    if (!shield) {
      directPoisonTargets.add(poison.target.id);
      continue;
    }
    if (livingNightLife(world, poison.source)) {
      reflectedPoisonTargets.add(poison.source.id);
      reflections.push({
        actorId: shield.actorId,
        protectedTargetId: poison.target.id,
        casterId: poison.source.id,
      });
    }
  }
  const attacks = new Set<EntityId>();
  const failures = new Set<EntityId>();
  for (const attack of effects?.attacks ?? []) {
    if (attack.isCurrent() && livingNightLife(world, attack.target)) attacks.add(attack.target.id);
  }
  for (const failure of effects?.failures ?? []) {
    if (failure.isCurrent() && livingNightLife(world, failure.target))
      failures.add(failure.target.id);
  }
  return {
    shields: new Set(shields.keys()),
    directPoisonTargets,
    reflectedPoisonTargets,
    attacks,
    failures,
    reflections,
  };
}

/** Original owner and target bindings for the finite pure-white inspection rules. */
export interface NightInspectionAttack {
  readonly actorId: EntityId;
  readonly target: NightLifeScope;
  readonly cause: DeathCause.PureWhiteInspection | DeathCause.WolfWitchInspection;
  readonly isCurrent: () => boolean;
}

/** Finite evil-knight retaliation, paid at accepted native action and settled at night end. */
export interface NightRetaliationAttack {
  readonly actorId: EntityId;
  readonly target: NightLifeScope;
  readonly isCurrent: () => boolean;
}

/** Original life and role authority for persistent passive night immunity. */
export interface NightImmunityClaim {
  readonly target: NightLifeScope;
  readonly isCurrent: () => boolean;
}
