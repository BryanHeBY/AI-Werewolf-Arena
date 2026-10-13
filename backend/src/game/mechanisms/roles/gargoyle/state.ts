/**
 * Owns Gargoyle state data and access to its existing private-state slot.
 * Inputs are the role component and native state; outputs retain the exact stored object, including assignment-before-return behavior.
 * The inheritance coordinator owns the original qualification and publication order;
 * this owner commits only the selected inheritance flag, without a second state read.
 * The stored reference and checkpoint shape stay unchanged. It does not grant
 * current knife permission, change camp or refund a fact after publication fails.
 * Pure payload/read data structures belong to the neutral role-state data owner;
 * this leaf retains original live references and concrete installation/commit operations.
 */
import type { GargoyleState, GargoyleReadState } from "@ai-werewolf-arena/game-contract";

import type { RoleComponent } from "../../../../core/domain/components/role";

export function setGargoyleState(role: RoleComponent, state: GargoyleState): GargoyleReadState {
  (role.privateState as { gargoyle: GargoyleState })["gargoyle"] = state;
  return state;
}

export function getGargoyleState(role: RoleComponent): GargoyleReadState | undefined {
  return (role.privateState as { readonly gargoyle?: unknown })["gargoyle"] as
    GargoyleReadState | undefined;
}

/** Caller retains original last-wolf and already-inherited checks. */
export function recordGargoyleKnifeInheritance(state: GargoyleReadState): void {
  (state as { hasInheritedKnife: boolean }).hasInheritedKnife = true;
}
