import type { NightAbility } from "../abilities";

/** The legacy policy counts the last accepted action; the named NetEase policy counts actual adjacent nights. */
export function guardTargetRepeated(ability: NightAbility<"guard">, day: number, targetId: number): boolean {
  return ability.state.lastTarget === targetId &&
    (ability.state.repeatPolicy !== "netease_consecutive_nights_v1" || ability.lastUsedDay === day - 1);
}
