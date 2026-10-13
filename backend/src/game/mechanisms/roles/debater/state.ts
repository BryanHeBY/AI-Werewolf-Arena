/**
 * Owns Debater live slot reads and inert player-state projection. Inputs are original
 * role/choice fields and committed status; outputs preserve descriptor reads and the
 * existing detached choice data. This boundary never executes a debate or settles a death.
 */
import type { DebaterReadState } from "@ai-werewolf-arena/game-contract";
import type { RoleComponent } from "../../../../core/domain/components/role";

import { playerDataField } from "../player_state";
export function getDebaterState(role: RoleComponent | undefined): DebaterReadState | undefined {
  return playerDataField(playerDataField(role, "privateState"), "debater") as
    DebaterReadState | undefined;
}
export function projectDebaterState(state: DebaterReadState, committed = false) {
  const choice = playerDataField(state, "choice"),
    day = playerDataField(choice, "day"),
    targetId = playerDataField(choice, "targetId");
  return {
    policy: "awa_melbourne_2026_speech_gap_v1" as const,
    remaining:
      !committed && playerDataField(state, "remaining") === 1 ? (1 as const) : (0 as const),
    choice:
      typeof day === "number" &&
      Number.isSafeInteger(day) &&
      day > 0 &&
      typeof targetId === "number" &&
      Number.isSafeInteger(targetId) &&
      targetId > 0
        ? { day, targetId }
        : null,
  };
}
