/**
 * Owns Dreamer state data and access to its existing ability instance slot.
 * Inputs are the role component and native state; outputs retain the ability owner's installation copy and selected stored reference.
 * Existing mutation commands, lifecycle validation, player projection and checkpoint
 * encoding keep their current responsibilities. This leaf creates no mirror state,
 * consumes no resource and does not decide whether a request is authorized.
 */
import type { RoleComponent } from "../../../../core/domain/components/role";
import type { EntityId } from "@ai-werewolf-arena/game-contract";
import { findNightAbility, installNativeAbility } from "../abilities";

export interface DreamerState {
  protectionPolicy?: import("../../../../core/domain/board").DreamProtectionPolicy;
  lastTarget: EntityId | null;
  lastDay: number | null;
  history: Array<{ day: number; targetId: EntityId }>;
}

export function setDreamerState(roleComp: RoleComponent, state: DreamerState): DreamerState {
  return installNativeAbility(roleComp, "dream", state);
}

export function getDreamerState(
  roleComp: RoleComponent,
  abilityId?: string,
): DreamerState | undefined {
  return findNightAbility(roleComp, "dream", abilityId)?.state;
}
