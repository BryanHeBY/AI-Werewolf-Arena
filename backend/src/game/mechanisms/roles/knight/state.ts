/**
 * Owns Knight state data and access to its existing private-state slot.
 * Inputs are the role component and native state; outputs retain the exact stored object, including assignment-before-return behavior.
 * The feature commit owns the single duel-consumption command; callers see a readonly
 * view of that same object. Lifecycle validation, player projection and checkpoint
 * encoding retain their current responsibilities. There is no mirror state or lease
 * check here, and failed later event publication does not refund this resource.
 * Pure payload/read data structures belong to the neutral role-state data owner;
 * this leaf retains original live references and concrete installation/commit operations.
 */
import type { KnightState, KnightReadState } from "@ai-werewolf-arena/game-contract";

import type { RoleComponent } from "../../../../core/domain/components/role";

export function setKnightState(roleComp: RoleComponent, state: KnightState): KnightReadState {
  (roleComp.privateState as { knight: KnightState })["knight"] = state;
  return state;
}

export function getKnightState(roleComp: RoleComponent): KnightReadState | undefined {
  return roleComp.privateState["knight"] as KnightReadState | undefined;
}

/** The caller has completed the original duel preflight; no second state read or check. */
export function consumeKnightDuel(state: KnightReadState): void {
  (state as { canDuel: boolean }).canDuel = false;
}
