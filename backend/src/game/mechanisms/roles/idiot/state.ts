/**
 * Owns Idiot state data and access to its existing private-state slot.
 * Inputs are the role component and native state; outputs retain the exact stored object, including assignment-before-return behavior.
 * Existing mutation commands, lifecycle validation, player projection and checkpoint
 * encoding keep their current responsibilities. This leaf creates no mirror state,
 * consumes no resource and does not decide whether a request is authorized.
 */
import type { RoleComponent } from "../../../../core/domain/components/role";

export interface IdiotState {
  revealed: boolean;
}

export function setIdiotState(roleComp: RoleComponent, state: IdiotState): IdiotState {
  (roleComp.privateState as { idiot: IdiotState })["idiot"] = state;
  return state;
}

export function getIdiotState(roleComp: RoleComponent): IdiotState | undefined {
  return roleComp.privateState["idiot"] as IdiotState | undefined;
}
