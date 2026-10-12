/**
 * Owns pure native Witch combination, knife visibility and second-turn predicates.
 * Inputs are read-only potion-instance state and night day; outputs are the
 * original policy booleans in their existing field order. These queries never
 * consume stock, close a turn, write source metadata or grant a commit capability.
 */
import { Role } from "../../../../core/domain/model";
import type { NightAbilityReadView } from "../abilities";
/** Only a native resource may use this product policy; copied/gifted bottles keep their own contract. */
export function nativePotionsCanCombine(ability: NightAbilityReadView<"potion">): boolean {
  return (
    ability.source.kind === "native" &&
    ability.state.potionPolicy === "awa_both_native_experimental_v1"
  );
}
export function witchKnifeVisible(ability: NightAbilityReadView<"potion">): boolean {
  const policy =
    ability.source.kind === "native" && ability.source.role === Role.Witch
      ? ability.state.knifeVisibility
      : undefined;
  if (policy === "awa_always_v1") return true;
  return (
    ability.state.heal > 0 &&
    !ability.state.healUsedThisNight &&
    (nativePotionsCanCombine(ability) || !ability.state.poisonUsedThisNight)
  );
}
export function nativePotionSecondTurn(
  ability: NightAbilityReadView<"potion">,
  day: number,
): boolean {
  return (
    nativePotionsCanCombine(ability) &&
    ability.state.potionTurnClosedDay !== day &&
    ((ability.state.healUsedThisNight &&
      !ability.state.poisonUsedThisNight &&
      ability.state.poison > 0) ||
      (ability.state.poisonUsedThisNight &&
        !ability.state.healUsedThisNight &&
        ability.state.heal > 0))
  );
}
