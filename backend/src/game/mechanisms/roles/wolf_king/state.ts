/**
 * Owns WolfKing state data and access to its existing private-state slot.
 * Inputs are the role component and native state; outputs retain the exact stored object, including assignment-before-return behavior.
 * Existing mutation commands, lifecycle validation, player projection and checkpoint
 * encoding keep their current responsibilities. This leaf creates no mirror state,
 * consumes no resource and does not decide whether a request is authorized.
 */
import type { RoleComponent } from "../../../../core/domain/components/role";

export interface WolfKingState {
  deathActionPolicy?: import("../../../../core/domain/board").DeathActionPolicy;
  canShoot: boolean;
}

export function setWolfKingState(roleComp: RoleComponent, state: WolfKingState): WolfKingState {
  (roleComp.privateState as { wolf_king: WolfKingState })["wolf_king"] = state;
  return state;
}

export function getWolfKingState(roleComp: RoleComponent): WolfKingState | undefined {
  return roleComp.privateState["wolf_king"] as WolfKingState | undefined;
}
