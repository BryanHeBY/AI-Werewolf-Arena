/**
 * Owns Gravekeeper's existing private-state slot and received exile history writes.
 * Inputs are the original role or captured state, accepted exile fact and received day;
 * outputs retain the stored reference and original detached report result.
 * State data keeps received-day reports with their committed exile day, target and label.
 * The feedback stage owns eligibility, duplicate checks and event publication;
 * history insertion retains its original getter/spread/throw prefix with no rollback.
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
  (roleComp.privateState as { gravekeeper: GravekeeperState })["gravekeeper"] = state;
  return state;
}

export function getGravekeeperState(roleComp: RoleComponent): GravekeeperState | undefined {
  return roleComp.privateState["gravekeeper"] as GravekeeperState | undefined;
}

/** The caller retains every preflight and subsequent use/effect/publication operation. */
export function recordExileFeedback(
  state: GravekeeperState,
  fact: ExileFeedback,
  receivedDay: number,
): void {
  state.history.push({ ...fact, receivedDay, result: { ...fact.result } });
}
