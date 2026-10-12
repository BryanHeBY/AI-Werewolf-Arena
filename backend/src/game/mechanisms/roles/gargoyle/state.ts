/**
 * Owns Gargoyle state data and access to its existing private-state slot.
 * Inputs are the role component and native state; outputs retain the exact stored object, including assignment-before-return behavior.
 * The inheritance coordinator owns the original qualification and publication order;
 * this owner commits only the selected inheritance flag, without a second state read.
 * The stored reference and checkpoint shape stay unchanged. It does not grant
 * current knife permission, change camp or refund a fact after publication fails.
 */
import type { RoleComponent } from "../../../../core/domain/components/role";

export interface GargoyleState {
  readonly hasInheritedKnife: boolean;
}

export function setGargoyleState(role: RoleComponent, state: GargoyleState): GargoyleState {
  role.privateState["gargoyle"] = state as unknown;
  return state;
}

export function getGargoyleState(role: RoleComponent): GargoyleState | undefined {
  return role.privateState["gargoyle"] as GargoyleState | undefined;
}

/** Caller retains original last-wolf and already-inherited checks. */
export function recordGargoyleKnifeInheritance(state: GargoyleState): void {
  (state as { hasInheritedKnife: boolean }).hasInheritedKnife = true;
}
