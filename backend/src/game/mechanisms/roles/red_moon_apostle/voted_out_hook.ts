import type { VotedOutHook } from "../../hooks/hook_registry";
import { demonRedMoonDay, commitDemonRedMoonTransition } from "../demon_hunter/authority";
/** Only the original last wolf survives this exile; all other removal causes are unchanged. */
export const redMoonVotedOutHook: VotedOutHook = (world, actorId, events) => {
  const day = demonRedMoonDay(world, actorId);
  if (day === null || !commitDemonRedMoonTransition(world, actorId, "exile", day)) return null;
  events.push({
    timestamp: Date.now(),
    type: "red_moon_exile_delayed",
    payload: { actorId, day, night: day + 1 },
  });
  return { prevented: true, removed: [], reason: "red_moon_exile_delayed" };
};
