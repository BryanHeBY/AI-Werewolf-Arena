import type { SeerState } from "../private_state";
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
