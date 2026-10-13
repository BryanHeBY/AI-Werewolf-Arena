/**
 * Owns Gravekeeper's existing private-state slot and received exile history writes.
 * Inputs are the original role or captured state, accepted exile fact and received day;
 * outputs retain the stored reference and original detached report result.
 * State data keeps received-day reports with their committed exile day, target and label.
 * The feedback stage owns eligibility, duplicate checks and event publication;
 * history insertion retains its original getter/spread/throw prefix with no rollback.
 * Pure payload/read data structures belong to the neutral role-state data owner;
 * this leaf retains original live references and concrete installation/commit operations.
 */
import type {
  GravekeeperReport,
  GravekeeperState,
  GravekeeperReadReport,
  GravekeeperReadState,
} from "@ai-werewolf-arena/game-contract";

import type { RoleComponent } from "../../../../core/domain/components/role";
import type { ExileFeedback } from "@ai-werewolf-arena/game-contract";

export function setGravekeeperState(
  roleComp: RoleComponent,
  state: GravekeeperState,
): GravekeeperReadState {
  (roleComp.privateState as { gravekeeper: GravekeeperState })["gravekeeper"] = state;
  return state;
}

export function getGravekeeperState(roleComp: RoleComponent): GravekeeperReadState | undefined {
  return roleComp.privateState["gravekeeper"] as GravekeeperReadState | undefined;
}

/** The caller retains every preflight and subsequent use/effect/publication operation. */
export function recordExileFeedback(
  state: GravekeeperReadState,
  fact: ExileFeedback,
  receivedDay: number,
): void {
  (state.history as GravekeeperReport[]).push({ ...fact, receivedDay, result: { ...fact.result } });
}
