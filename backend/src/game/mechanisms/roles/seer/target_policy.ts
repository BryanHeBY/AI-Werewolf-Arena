/**
 * Checks the Seer target policy from the original lifetime inspection history.
 * Inputs are the optional feature state and actor/target IDs; output is the
 * existing allowed-target predicate. This function never writes history,
 * resets a cycle, changes ability eligibility or installs configuration defaults.
 */
import type { SeerState } from "./state-contracts";
/** Versioned AWA policy; fresh means lifetime history, with no implicit cycle reset. */
export function seerTargetAllowed(
  state: SeerState | undefined,
  actorId: number,
  targetId: number,
): boolean {
  return (
    state?.targetPolicy !== "awa_fresh_others_v1" ||
    (targetId !== actorId && !state.history.some((row) => row.targetId === targetId))
  );
}
