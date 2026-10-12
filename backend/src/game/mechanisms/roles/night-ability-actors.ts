/**
 * Owns eager night-actor enumeration through restricted roster and eligibility ports.
 * Inputs are live stored ability references, alive IDs, kind and day; outputs keep
 * those same references for the existing captured commit owner, not archive DTOs.
 * Fear filters the complete roster before modifier eligibility, then ability status
 * is read in the original order. Binding never reads World, actor state or clocks;
 * query implementations never write resources, commit effects or choose random targets.
 */
import type { EntityId } from "../../../core/domain/model";
import { COMPONENT } from "../../../core/domain/components/names";
import type { World } from "../../../core/domain/world";
import {
  abilityStatus,
  allNightAbilities,
  type NightAbility,
  type NightAbilityReadView,
  type NightAbilityKind,
} from "./abilities";
import {
  bindNightmareNightEligibility,
  type NightmareNightEligibility,
} from "./nightmare_shadow/ports";
import {
  bindScholarMentorNightEligibility,
  type ScholarMentorNightEligibility,
} from "./scholar_mentor/ports";

/** Only original alive membership and sorted stored instances are visible here. */
export interface NightAbilityRosterPort {
  aliveIds(): EntityId[];
  abilitiesFor(actorId: EntityId): readonly NightAbilityReadView[];
}

/** Bound feature queries have no World, clock, writer or receipt-commit argument. */
export interface NightActorEligibilityQuery {
  filterAliveActors(ids: readonly EntityId[], kind: NightAbilityKind, day: number): EntityId[];
}

export interface NightAbilityActorQuery {
  actors<K extends NightAbilityKind>(
    kind: K,
    day: number,
  ): Array<{ actorId: EntityId; ability: NightAbility<K> }>;
}

/** Finite explicit fear-then-modifier assembly preserves both complete filter passes. */
export function createNightActorEligibilityQuery(
  nightmare: NightmareNightEligibility,
  scholarMentor: ScholarMentorNightEligibility,
): NightActorEligibilityQuery {
  return Object.freeze({
    filterAliveActors(ids: readonly EntityId[], kind: NightAbilityKind, day: number) {
      return ids
        .filter((actorId) => !nightmare.blocks(actorId, day))
        .filter(
          (actorId) =>
            (kind !== "guard" && kind !== "seer_check") ||
            !scholarMentor.blocks(actorId, day, kind === "guard" ? "guard" : "check"),
        );
    },
  });
}

/** Materialize at the old call site; do not freeze or copy the selected instance. */
export function createNightAbilityActorQuery(
  roster: NightAbilityRosterPort,
  eligibility: NightActorEligibilityQuery,
): NightAbilityActorQuery {
  return Object.freeze({
    actors<K extends NightAbilityKind>(kind: K, day: number) {
      return eligibility.filterAliveActors(roster.aliveIds(), kind, day).flatMap((actorId) =>
        roster
          .abilitiesFor(actorId)
          .filter(
            (ability): ability is NightAbilityReadView<K> =>
              ability.kind === kind && abilityStatus(ability, day) === "active",
          )
          // This owner restores the original stored reference for captured commit;
          // the input read port never exposes state or metadata mutation rights.
          .map(
            (ability) => ({ actorId, ability }) as { actorId: EntityId; ability: NightAbility<K> },
          ),
      );
    },
  });
}

/** Assembly captures one original World reference without querying it during binding. */
export function bindNightAbilityActorQuery(world: World): NightAbilityActorQuery {
  return createNightAbilityActorQuery(
    {
      aliveIds: () => world.getAliveEntityIds(),
      abilitiesFor: (actorId) => allNightAbilities(world.getComponent(actorId, COMPONENT.Role)),
    },
    createNightActorEligibilityQuery(
      bindNightmareNightEligibility(world),
      bindScholarMentorNightEligibility(world),
    ),
  );
}
