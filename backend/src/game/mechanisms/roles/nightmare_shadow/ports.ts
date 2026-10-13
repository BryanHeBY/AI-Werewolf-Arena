/**
 * Exposes Nightmare's bound fear eligibility and ordinary knife target queries.
 * Inputs are an actor/day or candidate target ID; outputs retain the original
 * fear predicate and wolf-action policy allowance. Binding only captures the original World reference;
 * consumers receive no World, state writer, night opener or effect-commit method.
 * When queried, original revoked-roster and target-life failures propagate.
 * The board predicate is the original readonly binding, preserving feature-specific rejection and repeated caller argument reads.
 */
import type { EntityId } from "../../../../core/domain/model";
import { Role } from "../../../../core/domain/identity";
import { COMPONENT } from "../../../../core/domain/components/names";
import type { World } from "../../../../core/domain/world";
import { nightmareFearBlocks } from "./night_frame";
export { isNightmareBoard, nightmareKnifeBlocked } from "./night_frame";
import { getNightmareShadowState } from "./state";

export interface NightmareNightEligibility {
  blocks(actorId: EntityId, day: number): boolean;
}

export function bindNightmareNightEligibility(world: World): NightmareNightEligibility {
  return Object.freeze({
    blocks: (actorId: EntityId, day: number) => nightmareFearBlocks(world, actorId, day),
  });
}

export interface NightmareKnifeTargetQuery {
  allows(targetId: EntityId): boolean;
}

export function bindNightmareKnifeTargetQuery(world: World): NightmareKnifeTargetQuery {
  return Object.freeze({
    allows: (targetId: EntityId) =>
      world.getComponent(targetId, COMPONENT.Role)?.role !== Role.NightmareShadow ||
      getNightmareShadowState(world.getComponent(targetId, COMPONENT.Role))?.wolfActionPolicy ===
        "standard",
  });
}
