import { Camp, Phase } from "../../src/core/domain/identity";
import type { GameResult } from "../../src/core/domain/results";

/** Narrow untyped recorded/provider data without coercing malformed fixture values. */
export function fixtureNumber(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("fixture_number_invalid");
  return value;
}

export function fixtureObject(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("fixture_object_invalid");
  return value as Record<string, unknown>;
}


export function fixtureResult(winner: Camp | null, reason: string): GameResult {
  return {
    winner, reason,
    outcome: winner === null ? { kind: "no_winner" } : {
      kind: "victory", primary: { kind: "faction", faction: winner, winningPlayerIds: [1] }, additional: [], winningPlayerIds: [1],
    },
    decidedAt: { day: 1, phase: winner === null ? Phase.Night : Phase.Voting, checkpoint: winner === null ? "max_days_reached" : "exile_settled" },
  };
}
