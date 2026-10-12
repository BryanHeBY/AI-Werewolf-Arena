/**
 * Owns Witch state data and access to its existing ability instance slot.
 * Inputs are the role component and native state; outputs retain the ability owner's installation copy and selected stored reference.
 * Existing mutation commands, lifecycle validation, player projection and checkpoint
 * encoding keep their current responsibilities. This leaf creates no mirror state,
 * consumes no resource and does not decide whether a request is authorized.
 */
import type { RoleComponent } from "../../../../core/domain/components/role";
import type { WitchSelfHealRule } from "@ai-werewolf-arena/game-contract";
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

export function setWitchState(roleComp: RoleComponent, state: WitchState): WitchState {
  return installNativeAbility(roleComp, "potion", state);
}

export function getWitchState(roleComp: RoleComponent, abilityId?: string): WitchState | undefined {
  return findNightAbility(roleComp, "potion", abilityId)?.state;
}
