/**
 * Exposes Nightmare's bound active-night eligibility query at its feature boundary.
 * Inputs are an actor ID and actual night day; output retains the original fear
 * predicate and roster/life rejection. Binding only captures the original World reference;
 * consumers receive no World, state writer, night opener or effect-commit method.
 * When queried, original revoked-roster and target-life failures propagate.
 */
import type { EntityId } from "../../../../core/domain/model";
import type { World } from "../../../../core/domain/world";
import { nightmareFearBlocks } from "./night_frame";

export interface NightmareNightEligibility {
  blocks(actorId: EntityId, day: number): boolean;
}

export function bindNightmareNightEligibility(world: World): NightmareNightEligibility {
  return Object.freeze({
    blocks: (actorId: EntityId, day: number) => nightmareFearBlocks(world, actorId, day),
  });
}
