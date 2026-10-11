import { Role } from "../../../../core/domain/identity";
import { types } from "node:util";
import type { RoleComponent } from "../../../../core/domain/components/role";
import { playerDataField } from "../player_state";
import { MIST_RAVEN_POLICY, readAlchemistState, readRavenState } from "./state";

/** Independent owner DTOs never contain the night frame, original bodies, sources or authorization. */
export interface PlayerAlchemistState {
  policy: typeof MIST_RAVEN_POLICY;
  mistRemaining: number;
  healRemaining: number;
  mistHistory: Array<{ day: number; targetIds: number[] | null }>;
  healHistory: Array<{ day: number; targetId: number | null }>;
}
export interface PlayerRavenState {
  policy: typeof MIST_RAVEN_POLICY;
  awakened: boolean;
  extraRemaining: number;
  knownTeammateIds: number[];
  extraHistory: Array<{ day: number; targetId: number | null }>;
}
export function projectAlchemist(
  role: RoleComponent | undefined,
): PlayerAlchemistState | undefined {
  if (types.isProxy(role) || playerDataField(role, "role") !== Role.Alchemist) return;
  const container = playerDataField(role, "privateState");
  if (types.isProxy(container)) return;
  const state = readAlchemistState(playerDataField(container, "alchemist"));
  if (!state) return;
  return {
    policy: MIST_RAVEN_POLICY,
    mistRemaining: state.mistRemaining,
    healRemaining: state.healRemaining,
    mistHistory: state.mistHistory.map((row) => ({
      day: row.day,
      targetIds: row.targetIds === null ? null : [...row.targetIds],
    })),
    healHistory: state.healHistory.map((row) => ({ day: row.day, targetId: row.targetId })),
  };
}
export function projectRaven(role: RoleComponent | undefined): PlayerRavenState | undefined {
  if (types.isProxy(role) || playerDataField(role, "role") !== Role.RavenClawWolf) return;
  const container = playerDataField(role, "privateState");
  if (types.isProxy(container)) return;
  const state = readRavenState(playerDataField(container, "ravenClaw"));
  if (!state) return;
  return {
    policy: MIST_RAVEN_POLICY,
    awakened: state.awakenedDay !== null,
    extraRemaining: state.extraRemaining,
    knownTeammateIds: [...state.knownTeammateIds],
    extraHistory: state.extraHistory.map((row) => ({ day: row.day, targetId: row.targetId })),
  };
}
