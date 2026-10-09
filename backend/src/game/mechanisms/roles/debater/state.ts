import type { RoleComponent } from "../../../../core/domain/components/role";
import type { DebaterPolicy } from "../../../../core/domain/board";
import { playerDataField } from "../player_state";
export interface DebaterState {
  policy: DebaterPolicy;
  remaining: 0 | 1;
  choice: { day: number; targetId: number } | null;
}
export function getDebaterState(role: RoleComponent | undefined): DebaterState | undefined {
  return playerDataField(playerDataField(role, "privateState"), "debater") as
    DebaterState | undefined;
}
export function projectDebaterState(state: DebaterState, committed = false) {
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
