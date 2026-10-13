/**
 * Builds original shared test test input plans, fixed boards and explicit player/marker data. Inputs are
 * supplied variant/locale/seed choices; outputs retain the same arrays, stock parameters and configured
 * identities. Existing dealing may construct input identities, while handwritten expected outcomes remain
 * supplied data. It runs no game or model and changes no oracle algorithm.
 */
import { Camp } from "../../../../src/core/domain/identity";
import { Phase } from "../../../../src/core/domain/identity";
import type { GameResult } from "../../../../src/core/domain/results";

export function fixtureResult(winner: Camp | null, reason: string): GameResult {
  return {
    winner,
    reason,
    outcome:
      winner === null
        ? { kind: "no_winner" }
        : {
            kind: "victory",
            primary: { kind: "faction", faction: winner, winningPlayerIds: [1] },
            additional: [],
            winningPlayerIds: [1],
          },
    decidedAt: {
      day: 1,
      phase: winner === null ? Phase.Night : Phase.Voting,
      checkpoint: winner === null ? "max_days_reached" : "exile_settled",
    },
  };
}
