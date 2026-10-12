/**
 * Owns ordinary wolf knife target composition through four feature public queries.
 * Inputs are current target IDs, circle/role allowances and alive membership;
 * output is the original allowed-target boolean. Mist precedes Noble, alive,
 * Evil Knight and Nightmare checks with the same short-circuit failure order.
 * Binding reads no World state; query consumers receive no Role, life, stock,
 * random source, writable World or effect-commit capability.
 */
import type { EntityId } from "../../../../core/domain/identity";
import type { World } from "../../../../core/domain/world";
import { bindMistKnifeTargetQuery, type MistKnifeTargetQuery } from "../mist_raven/ports";
import { bindNobleKnifeTargetQuery, type NobleKnifeTargetQuery } from "../noble_secret_body/ports";
import {
  bindEvilKnightKnifeTargetQuery,
  type EvilKnightKnifeTargetQuery,
} from "../evil_knight/ports";
import {
  bindNightmareKnifeTargetQuery,
  type NightmareKnifeTargetQuery,
} from "../nightmare_shadow/ports";

export interface WolfKnifeRosterQuery {
  aliveIds(): readonly EntityId[];
}
export interface WolfKnifeTargetQuery {
  allows(targetId: EntityId): boolean;
}

/** Concrete declaration order, not an extensible rule graph or role callback registry. */
export function createWolfKnifeTargetQuery(
  roster: WolfKnifeRosterQuery,
  mist: MistKnifeTargetQuery,
  noble: NobleKnifeTargetQuery,
  evilKnight: EvilKnightKnifeTargetQuery,
  nightmare: NightmareKnifeTargetQuery,
): WolfKnifeTargetQuery {
  return Object.freeze({
    allows(targetId: EntityId) {
      const circle = mist.targets();
      return (
        (circle === null || circle.includes(targetId)) &&
        noble.allows(targetId) &&
        roster.aliveIds().includes(targetId) &&
        evilKnight.allows(targetId) &&
        nightmare.allows(targetId)
      );
    },
  });
}

/** Capture the argument reference only; defer all queries until allows is called. */
export function bindWolfKnifeTargetQuery(world: World): WolfKnifeTargetQuery {
  return createWolfKnifeTargetQuery(
    { aliveIds: () => world.getAliveEntityIds() },
    bindMistKnifeTargetQuery(world),
    bindNobleKnifeTargetQuery(world),
    bindEvilKnightKnifeTargetQuery(world),
    bindNightmareKnifeTargetQuery(world),
  );
}
