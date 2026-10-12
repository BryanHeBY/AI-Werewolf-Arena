/**
 * Exposes Scholar/Mentor's bound native Guard and Seer eligibility query.
 * Inputs are an actor ID, actual night day and guard/check kind; output retains
 * the original settled modifier predicate and errors. Binding captures no state
 * snapshot and grants no World access, poison/knife commit or resource writer.
 * When queried, original unsettled-night and roster failures propagate.
 */
import type { EntityId } from "../../../../core/domain/model";
import type { World } from "../../../../core/domain/world";
import { scholarMentorBlocks } from "./night_frame";

export interface ScholarMentorNightEligibility {
  blocks(actorId: EntityId, day: number, kind: "guard" | "check"): boolean;
}

export function bindScholarMentorNightEligibility(world: World): ScholarMentorNightEligibility {
  return Object.freeze({
    blocks: (actorId: EntityId, day: number, kind: "guard" | "check") =>
      scholarMentorBlocks(world, day, actorId, kind),
  });
}
