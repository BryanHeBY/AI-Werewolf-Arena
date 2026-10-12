/**
 * Owns Evil Knight's public read-only ordinary knife target contribution.
 * Input is a target ID bound to the original World; output is the existing
 * live-role allowance, including outside an installed Evil Knight board.
 * When queried, original lookup failures propagate. Binding never reads a
 * component or exposes World, life, reflection writes or a commit method.
 */
import { Role, type EntityId } from "../../../../core/domain/identity";
import { COMPONENT } from "../../../../core/domain/components/names";
import type { World } from "../../../../core/domain/world";

export interface EvilKnightKnifeTargetQuery {
  allows(targetId: EntityId): boolean;
}

export function bindEvilKnightKnifeTargetQuery(world: World): EvilKnightKnifeTargetQuery {
  return Object.freeze({
    allows: (targetId: EntityId) =>
      world.getComponent(targetId, COMPONENT.Role)?.role !== Role.EvilKnight,
  });
}
