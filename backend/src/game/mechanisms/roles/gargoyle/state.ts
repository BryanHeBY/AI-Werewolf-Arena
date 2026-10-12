/**
 * Owns Gargoyle state data and access to its existing private-state slot.
 * Inputs are the role component and native state; outputs retain the exact stored object, including assignment-before-return behavior.
 * Existing mutation commands, lifecycle validation, player projection and checkpoint
 * encoding keep their current responsibilities. This leaf creates no mirror state,
 * consumes no resource and does not decide whether a request is authorized.
 */
import type { RoleComponent } from "../../../../core/domain/components/role";

export interface GargoyleState {
  hasInheritedKnife: boolean;
}

export function setGargoyleState(role: RoleComponent, state: GargoyleState): GargoyleState {
  role.privateState["gargoyle"] = state as unknown;
  return state;
}

export function getGargoyleState(role: RoleComponent): GargoyleState | undefined {
  return role.privateState["gargoyle"] as GargoyleState | undefined;
}
