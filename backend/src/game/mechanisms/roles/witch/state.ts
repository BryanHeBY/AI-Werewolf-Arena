/**
 * Owns Witch state data structure and access to its existing ability instance slot.
 * Inputs are the role component and native state; outputs retain the ability owner's installation copy and selected read-only stored reference.
 * This feature owns ordinary reset, terminal-pass and bottle payload writes.
 * Callers retain lease, marks, claims, use counts and publication order; independent
 * verifier ledgers and Demon sealed stock remain their separate owners. No state
 * mirror, extra eligibility check, refund or checkpoint shape change is introduced.
 */
import type { RoleComponent } from "../../../../core/domain/components/role";
import { WitchSelfHealRule } from "@ai-werewolf-arena/game-contract";
import { findNightAbility, installNativeAbility } from "../abilities";

export interface WitchState {
  knifeVisibility?: import("../../../../core/domain/board").WitchKnifeVisibilityPolicy;
  potionPolicy?: import("../../../../core/domain/board").WitchPotionPolicy;
  /** Terminal pass or completed second turn, never exposed through the player DTO. */
  potionTurnClosedDay?: number;
  heal: number;
  poison: number;
  selfHealRule: WitchSelfHealRule;
  canSelfHeal: boolean;
  healUsedThisNight: boolean;
  poisonUsedThisNight: boolean;
}

/** All current payload fields are scalar; the stored reference stays live. */
export type WitchReadState = Readonly<WitchState>;

export function setWitchState(roleComp: RoleComponent, state: WitchState): WitchReadState {
  return installNativeAbility(roleComp, "potion", state);
}

export function getWitchState(
  roleComp: RoleComponent,
  abilityId?: string,
): WitchReadState | undefined {
  return findNightAbility(roleComp, "potion", abilityId)?.state;
}

/** Current-day callback is evaluated only after both reset writes and the original rule tests. */
export function resetWitchNightState(state: WitchReadState, currentDay: () => number): void {
  (state as WitchState).healUsedThisNight = false;
  (state as WitchState).poisonUsedThisNight = false;
  (state as WitchState).canSelfHeal =
    state.selfHealRule === WitchSelfHealRule.Always ||
    (state.selfHealRule === WitchSelfHealRule.FirstNightOnly && currentDay() === 1);
}

/** Preserve the original LHS state capture and repeated RHS state reads. */
export function refreshWitchSelfHeal(
  ability: import("../abilities").NightAbilityReadView<"potion">,
  day: number,
): void {
  const state = ability.state;
  (state as WitchState).canSelfHeal =
    ability.state.selfHealRule === WitchSelfHealRule.Always ||
    (ability.state.selfHealRule === WitchSelfHealRule.FirstNightOnly && day === 1);
}

/** Original owner-current/source checks run in the caller before this write. */
export function closeWitchPotionTurn(
  ability: import("../abilities").NightAbilityReadView<"potion">,
  day: number,
): void {
  (ability.state as WitchState).potionTurnClosedDay = day;
}

export function consumeWitchHeal(state: WitchReadState): void {
  (state as WitchState).heal -= 1;
  (state as WitchState).healUsedThisNight = true;
}

export function consumeWitchPoison(state: WitchReadState): void {
  (state as WitchState).poison -= 1;
  (state as WitchState).poisonUsedThisNight = true;
}

/** Keep recipient postfix decrement and its second state read distinct from native payment. */
export function consumeRecipientPoison(
  ability: import("../abilities").NightAbilityReadView<"potion">,
): void {
  (ability.state as WitchState).poison--;
  (ability.state as WitchState).poisonUsedThisNight = true;
}
