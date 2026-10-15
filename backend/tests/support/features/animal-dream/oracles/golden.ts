/**
 * Owns original test oracle animal-dream handwritten expected data and bounded contract assertions. Inputs are supplied
 * plans or observed tuples; outputs preserve literal stock, identity, marker and error expectations. No
 * expected game result is regenerated from production settlement; this owner performs no game, model or
 * transport execution.
 */
import type { AnimalPlan } from "../contracts";
import { Camp } from "../../../../../src/domain";

export function animalGolden(name: AnimalPlan, skip = false, first = false) {
  const g = {
    fox_beauty: {
      winner: Camp.Good,
      alive: [5, 9, 10, 11, 12],
      night: [[], [], [6], [8]],
      days: 4,
    },
    cat_badge: { winner: Camp.Good, alive: [5, 10, 11, 12], night: [[], [6], [7], [8]], days: 4 },
    puffer_knife: {
      winner: Camp.Good,
      alive: [5, 6, 7, 11],
      night: [[12], [10], [], [8]],
      days: 4,
    },
    pk: first
      ? { winner: Camp.Good, alive: [7, 8, 9, 10, 11, 12], night: [[], [5], [6]], days: 3 }
      : { winner: Camp.Good, alive: [7, 8, 11, 12], night: [[], [5], [6], [], [10]], days: 5 },
    last_chain: { winner: Camp.Wolf, alive: [5, 6, 7, 8], night: [[], [10], [11], []], days: 4 },
    full_retaliation: { winner: Camp.Wolf, alive: [9], night: [[]], days: 1 },
  };
  return g[name];
}
