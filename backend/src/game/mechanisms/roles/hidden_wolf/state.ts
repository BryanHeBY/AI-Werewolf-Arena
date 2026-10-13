/**
 * Owns HiddenWolf state data and access to its existing private-state slot.
 * Inputs are the role component and native state; outputs retain the exact stored object, including assignment-before-return behavior.
 * The inheritance coordinator owns the original qualification and publication order;
 * this owner commits only the selected inheritance flag, without a second state read.
 * The stored reference and checkpoint shape stay unchanged. It does not grant
 * current knife permission, change camp or refund a fact after publication fails.
 * Pure payload/read data structures belong to the neutral role-state data owner;
 * this leaf retains original live references and concrete installation/commit operations.
 */
import type { HiddenWolfState, HiddenWolfReadState } from "@ai-werewolf-arena/game-contract";

import type { RoleComponent } from "../../../../core/domain/components/role";
import type { HiddenWolfCampInspectionPolicy } from "../../../../core/domain/board";

export function setHiddenWolfState(
  role: RoleComponent,
  state: HiddenWolfState,
): HiddenWolfReadState {
  (role.privateState as { hidden_wolf: HiddenWolfState })["hidden_wolf"] = state;
  return state;
}

export function getHiddenWolfState(role: RoleComponent): HiddenWolfReadState | undefined {
  return role.privateState["hidden_wolf"] as HiddenWolfReadState | undefined;
}

/** Caller retains original last-wolf and already-inherited checks. */
export function recordHiddenWolfKnifeInheritance(state: HiddenWolfReadState): void {
  (state as { hasInheritedKnife: boolean }).hasInheritedKnife = true;
}
