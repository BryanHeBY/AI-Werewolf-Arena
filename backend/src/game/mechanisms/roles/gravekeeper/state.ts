/**
 * Owns Gravekeeper state data and access to its existing private-state slot.
 * Inputs are the role component and native state; outputs retain the exact stored object, including assignment-before-return behavior.
 * Existing mutation commands, lifecycle validation, player projection and checkpoint
 * encoding keep their current responsibilities. This leaf creates no mirror state,
 * consumes no resource and does not decide whether a request is authorized.
 */
import type { RoleComponent } from "../../../../core/domain/components/role";
import type { ExileFeedback } from "@ai-werewolf-arena/game-contract";

export interface GravekeeperReport extends ExileFeedback {
  receivedDay: number;
}

export interface GravekeeperState {
  history: GravekeeperReport[];
}

export function setGravekeeperState(
  roleComp: RoleComponent,
  state: GravekeeperState,
): GravekeeperState {
  roleComp.privateState["gravekeeper"] = state as unknown;
  return state;
}

export function getGravekeeperState(roleComp: RoleComponent): GravekeeperState | undefined {
  return roleComp.privateState["gravekeeper"] as GravekeeperState | undefined;
}
