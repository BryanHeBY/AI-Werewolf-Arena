/**
 * Exposes Guard native-state reads and ordinary target-write commands, and owns its repeat query.
 * Inputs are existing roles or captured recipient instances at validated commit;
 * outputs expose the same read-only slot and original state-before-target read order.
 * Caller permissions, stock/use accounting and terminal failures stay outside
 * these commands; no leased protection or checkpoint is created here.
 */
export { getGuardState, recordGuardTarget, recordRecipientGuardTarget } from "./state";
export type { GuardState, GuardReadState } from "./state";

import type { NightAbilityReadView } from "../abilities";

export function guardTargetRepeated(
  ability: NightAbilityReadView<"guard">,
  day: number,
  targetId: number,
): boolean {
  return (
    ability.state.lastTarget === targetId &&
    (ability.state.repeatPolicy !== "netease_consecutive_nights_v1" ||
      ability.lastUsedDay === day - 1)
  );
}
