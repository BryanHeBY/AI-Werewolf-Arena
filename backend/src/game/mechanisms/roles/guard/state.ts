/**
 * Owns Guard state data and access to its existing ability instance slot.
 * Inputs are the role component and native state; outputs retain the ability owner's installation copy and selected stored reference.
 * Existing mutation commands, lifecycle validation, player projection and checkpoint
 * encoding keep their current responsibilities. This leaf creates no mirror state,
 * consumes no resource and does not decide whether a request is authorized.
 */
import type { RoleComponent } from "../../../../core/domain/components/role";
import type { EntityId } from "@ai-werewolf-arena/game-contract";
import type { GuardRepeatPolicy } from "@ai-werewolf-arena/game-contract";
import { findNightAbility, installNativeAbility } from "../abilities";

export interface GuardState {
  lastTarget: EntityId | null;
  repeatPolicy?: GuardRepeatPolicy;
}

export function setGuardState(roleComp: RoleComponent, state: GuardState): GuardState {
  return installNativeAbility(roleComp, "guard", state);
}

export function getGuardState(roleComp: RoleComponent, abilityId?: string): GuardState | undefined {
  return findNightAbility(roleComp, "guard", abilityId)?.state;
}
