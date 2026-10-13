/**
 * Owns Bear state data and access to its existing private-state slot.
 * Inputs are the role component and native state; outputs retain the exact stored object, including assignment-before-return behavior.
 * Existing mutation commands, lifecycle validation, player projection and checkpoint
 * encoding keep their current responsibilities. This leaf creates no mirror state,
 * consumes no resource and does not decide whether a request is authorized.
 * Pure payload/read data structures belong to the neutral role-state data owner;
 * this leaf retains original live references and concrete installation/commit operations.
 */
import type { BearState, BearReadState } from "@ai-werewolf-arena/game-contract";

import type { RoleComponent } from "../../../../core/domain/components/role";

export function setBearState(role: RoleComponent, state: BearState): BearReadState {
  (role.privateState as { bear: BearState })["bear"] = state;
  return state;
}

export function getBearState(role: RoleComponent): BearReadState | undefined {
  return role.privateState["bear"] as BearReadState | undefined;
}

/** Normal publication keeps original history/push lookup; dawn retains its guarded writer. */
export function recordBearRoar(state: BearReadState, report: BearState["history"][number]): void {
  (state.history as BearState["history"]).push(report);
}
