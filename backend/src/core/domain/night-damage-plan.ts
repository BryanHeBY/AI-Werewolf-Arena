/**
 * Folds original night claims into the damage resolver's readonly contribution plan.
 * Inputs retain original-life handles and paid owners' currentness callbacks; output
 * sets and cause order belong to this one resolution only. The fold queries Alive
 * and mark identity through a narrow port, without changing stock, marks or lives.
 * Original getter, callback, toxin-absorption and single-reflection order is kept.
 * Deferred per-player protection queries and mark clearing remain in the resolver;
 * these runtime handles and sets are never serialized or player-visible facts.
 */
import { COMPONENT } from "./components/names";
import { DeathCause } from "./deaths";
import type { EntityId } from "./identity";
import {
  planMechanicalDamage,
  type NightEffectQuery,
  type MechanicalDamagePlan,
  livingNightLife,
  type NightPoisonClaim,
  type NightInspectionAttack,
  type NightRetaliationAttack,
  type NightImmunityClaim,
  type NightFoxInspectionClaim,
  type NightGuardClaim,
  type NightMechanicalEffects,
  type NightMerchantBacklash,
  type NightBlackMarketBacklash,
  type NightRadiantBacklash,
  type NightAwakenedEffects,
} from "./night_effects";

export interface NightDamageEffects {
  radiantShelters?: readonly NightImmunityClaim[];
  radiantBacklashes?: readonly NightRadiantBacklash[];
  modifierDeaths?: readonly import("./night_effects").NightLifeScope[];
  nightImmunities?: readonly NightImmunityClaim[];
  retaliationAttacks?: readonly NightRetaliationAttack[];
  inspectionAttacks?: readonly NightInspectionAttack[];
  protectedTargets?: readonly EntityId[];
  wolfImmuneTargets?: readonly EntityId[];
  foxInspections?: readonly NightFoxInspectionClaim[];
  /** Sourced night immunity; extension interactions are an explicit AWA completion. */
  immuneNightTargets?: readonly EntityId[];
  consecutiveDeaths?: readonly EntityId[];
  poisonClaims?: readonly NightPoisonClaim[];
  guardClaims?: readonly NightGuardClaim[];
  merchantBacklashes?: readonly NightMerchantBacklash[];
  blackMarketBacklashes?: readonly NightBlackMarketBacklash[];
  mechanicalEffects?: NightMechanicalEffects;
  awakenedEffects?: NightAwakenedEffects;
}

/** Runtime-only fold; current entity marks are still consumed by the resolver. */
export interface NightDamagePlan {
  readonly awakenedShields: ReadonlySet<EntityId>;
  readonly awakenedAttacks: ReadonlySet<EntityId>;
  readonly mechanical: MechanicalDamagePlan;
  readonly claimedPoisonTargets: ReadonlySet<EntityId>;
  readonly claimedGuardTargets: ReadonlySet<EntityId>;
  readonly guarded: ReadonlySet<EntityId>;
  readonly blackBacklashes: ReadonlySet<EntityId>;
  readonly radiantBacklashes: ReadonlySet<EntityId>;
  readonly backlashTargets: ReadonlySet<EntityId>;
  readonly foxInspections: ReadonlySet<EntityId>;
  readonly inspectionSources: ReadonlyMap<EntityId, ReadonlySet<DeathCause>>;
  readonly passiveImmuneTargets: ReadonlySet<EntityId>;
}

/** Evaluated once at the original resolve point, with the same World receiver. */
export function planNightDamage(
  world: NightEffectQuery,
  effects: NightDamageEffects,
): NightDamagePlan {
  const awakenedShields = new Set(
    effects.awakenedEffects?.shields
      .filter((effect) => effect.isCurrent() && livingNightLife(world, effect.target))
      .map((effect) => effect.target.id),
  );
  const awakenedAttacks = new Set(
    effects.awakenedEffects?.attacks
      .filter((effect) => effect.isCurrent() && livingNightLife(world, effect.target))
      .map((effect) => effect.target.id),
  );
  // Absorbed original toxins never enter mechanical reflection; returning toxins are checked below.
  const mechanical = planMechanicalDamage(
    world,
    effects.mechanicalEffects,
    effects.poisonClaims,
    awakenedShields,
  );
  const claimedPoisonTargets = new Set(effects.poisonClaims?.map((claim) => claim.target.id));
  const claimedGuardTargets = new Set(effects.guardClaims?.map((claim) => claim.target.id));
  const guarded = new Set(
    effects.guardClaims
      ?.filter(
        (claim) =>
          livingNightLife(world, claim.target) &&
          world.getComponent(claim.target.id, COMPONENT.StatusMarks) === claim.marks,
      )
      .map((claim) => claim.target.id),
  );
  const blackBacklashes = new Set(
    effects.blackMarketBacklashes
      ?.filter((effect) => effect.isCurrent() && livingNightLife(world, effect.target))
      .map((effect) => effect.target.id),
  );
  const radiantBacklashes = new Set(
    effects.radiantBacklashes
      ?.filter((effect) => effect.isCurrent() && livingNightLife(world, effect.target))
      .map((effect) => effect.target.id),
  );
  const backlashTargets = new Set(
    effects.merchantBacklashes
      ?.filter((effect) => effect.isCurrent() && livingNightLife(world, effect.target))
      .map((effect) => effect.target.id),
  );

  const foxInspections = new Set(
    effects.foxInspections
      ?.filter((claim) => claim.isCurrent() && livingNightLife(world, claim.target))
      .map((claim) => claim.target.id),
  );
  const inspectionSources = new Map<EntityId, Set<DeathCause>>();
  for (const attack of [
    ...(effects.inspectionAttacks ?? []),
    ...(effects.retaliationAttacks ?? []).map((effect) => ({
      ...effect,
      cause: DeathCause.EvilKnightReflection,
    })),
  ]) {
    if (!attack.isCurrent() || !livingNightLife(world, attack.target)) continue;
    const sources = inspectionSources.get(attack.target.id) ?? new Set<DeathCause>();
    sources.add(attack.cause);
    inspectionSources.set(attack.target.id, sources);
  }

  const passiveImmuneTargets = new Set(
    [...(effects.nightImmunities ?? []), ...(effects.radiantShelters ?? [])]
      .filter((claim) => claim.isCurrent() && livingNightLife(world, claim.target))
      .map((claim) => claim.target.id),
  );
  return {
    awakenedShields,
    awakenedAttacks,
    mechanical,
    claimedPoisonTargets,
    claimedGuardTargets,
    guarded,
    blackBacklashes,
    radiantBacklashes,
    backlashTargets,
    foxInspections,
    inspectionSources,
    passiveImmuneTargets,
  };
}
