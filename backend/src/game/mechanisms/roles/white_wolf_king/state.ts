/**
 * Owns WhiteWolfKing state data and access to its existing private-state slot.
 * Inputs are the role component and native state; outputs retain the exact stored object, including assignment-before-return behavior.
 * Only the selected blast commit calls the concrete detonation-consumption command.
 * Readers keep a readonly view of that same object. Lifecycle validation, player
 * projection and checkpoint encoding retain their existing responsibilities;
 * consumption neither rechecks a lease nor refunds stock after publication fails.
 * Pure payload/read data structures belong to the neutral role-state data owner;
 * this leaf retains original live references and concrete installation/commit operations.
 */
import type { WhiteWolfKingState, WhiteWolfKingReadState } from "@ai-werewolf-arena/game-contract";

import type { RoleComponent } from "../../../../core/domain/components/role";

export function setWhiteWolfKingState(
  roleComp: RoleComponent,
  state: WhiteWolfKingState,
): WhiteWolfKingReadState {
  (roleComp.privateState as { white_wolf_king: WhiteWolfKingState })["white_wolf_king"] = state;
  return state;
}

export function getWhiteWolfKingState(roleComp: RoleComponent): WhiteWolfKingReadState | undefined {
  return roleComp.privateState["white_wolf_king"] as WhiteWolfKingReadState | undefined;
}

/** Caller retains original blast validation, death proposals and publication order. */
export function consumeWhiteWolfDetonation(state: WhiteWolfKingReadState): void {
  (state as { canDetonate: boolean }).canDetonate = false;
}
