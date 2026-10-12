/**
 * Owns Seer's public lifetime-freshness predicate for hints, preflight and stage rechecks.
 * Inputs are read-only Seer data and actor/target IDs; output preserves the original
 * lifetime-history/self-target allowance. No cycle reset, resource write, current
 * permission capture or default installation occurs at this query boundary.
 * Before each existing hint/preflight/recheck, original field failures propagate;
 * failed or terminal windows remain their separate permission owners.
 * The public state accessor exposes only the same deeply readonly live slot;
 * installation and inspection writes remain in the feature state owner.
 */
import type { SeerReadState } from "./state-contracts";
export { getSeerState } from "./state";
export type { SeerReadState } from "./state-contracts";

export function seerTargetAllowed(
  state: SeerReadState | undefined,
  actorId: number,
  targetId: number,
): boolean {
  return (
    state?.targetPolicy !== "awa_fresh_others_v1" ||
    (targetId !== actorId && !state.history.some((row) => row.targetId === targetId))
  );
}
