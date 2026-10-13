/**
 * Owns HiddenWolf state data and access to its existing private-state slot.
 * Inputs are the role component and native state; outputs retain the exact stored object, including assignment-before-return behavior.
 * The inheritance coordinator owns the original qualification and publication order;
 * this owner commits only the selected inheritance flag, without a second state read.
 * The stored reference and checkpoint shape stay unchanged. It does not grant
 * current knife permission, change camp or refund a fact after publication fails.
 */
import type { RoleComponent } from "../../../../core/domain/components/role";
import type { HiddenWolfCampInspectionPolicy } from "../../../../core/domain/board";

export interface HiddenWolfState {
  readonly hasInheritedKnife: boolean;
  campInspection?: HiddenWolfCampInspectionPolicy;
}

export function setHiddenWolfState(role: RoleComponent, state: HiddenWolfState): HiddenWolfState {
  (role.privateState as { hidden_wolf: HiddenWolfState })["hidden_wolf"] = state;
  return state;
}

export function getHiddenWolfState(role: RoleComponent): HiddenWolfState | undefined {
  return role.privateState["hidden_wolf"] as HiddenWolfState | undefined;
}

/** Caller retains original last-wolf and already-inherited checks. */
export function recordHiddenWolfKnifeInheritance(state: HiddenWolfState): void {
  (state as { hasInheritedKnife: boolean }).hasInheritedKnife = true;
}
