/**
 * Exposes Scholar/Mentor's eligibility query and concrete cleanup-transfer ports.
 * Query inputs are actor ID, night day and guard/check kind; output retains the
 * original settled modifier predicate, readable-board/roster assertions and
 * errors. Binding captures no state
 * snapshot and grants no World access, poison/knife commit or resource writer.
 * Lifecycle inputs are original World/day reads; its unit only transfers cleanup
 * at the original late point. Manager close and repeated abort keep their timing,
 * while frame authority owns grant completion, aborted fate and roster failures.
 */
import type { EntityId } from "../../../../core/domain/model";
import type { World } from "../../../../core/domain/world";
import { scholarMentorBlocks } from "./night_frame";
export { ScholarMentorNightUnit, scholarMentorNightTerminal } from "./night-lifecycle";
export type { ScholarMentorNightRuntime } from "./night-lifecycle";
export { isScholarMentorBoard, assertScholarMentorRosterCurrent } from "./night_frame";

export interface ScholarMentorNightEligibility {
  blocks(actorId: EntityId, day: number, kind: "guard" | "check"): boolean;
}

export function bindScholarMentorNightEligibility(world: World): ScholarMentorNightEligibility {
  return Object.freeze({
    blocks: (actorId: EntityId, day: number, kind: "guard" | "check") =>
      scholarMentorBlocks(world, day, actorId, kind),
  });
}
