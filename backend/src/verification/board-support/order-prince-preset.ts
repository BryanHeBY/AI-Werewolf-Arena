/**
 * Responsibility: own the frozen archive support check for order-prince boards.
 * Input: inert normalized board data from a replay archive; output: the finite
 * supported-board verdict preserved from Git 80ce15f. Local verification owns
 * this algorithm independently; it never calls production ruleset predicates,
 * accepts raw configuration on schema alone, authorizes actions or writes state.
 * Public contract supplies only inert copying, facts and stable policy IDs;
 * Node ingress must reject hostile objects before this reader reflects data.
 */
import { copyEventData } from "@ai-werewolf-arena/game-contract";
import { isTricksterPreset } from "./trickster-preset";
import { isTimeConsortPreset } from "./time-consort-preset";
const policy = "awa_order_prince_first_ballot_v1";
const deck: Readonly<Record<string, number>> = {
  wolf: 4,
  villager: 4,
  seer: 1,
  witch: 1,
  hunter: 1,
  order_prince: 1,
};
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
/** Frozen native roster and PK contract; ordinary sheriff/hook options remain configurable. */
export function isOrderPrincePreset(input: unknown): boolean {
  if (isTricksterPreset(input) || isTimeConsortPreset(input)) return true;
  try {
    const c = copyEventData(input);
    if (
      !object(c) ||
      c.boardSize !== 12 ||
      !Array.isArray(c.roleSetups) ||
      c.roleSetups.length !== 6
    )
      return false;
    const rows = c.roleSetups;
    if (
      rows.some(
        (row) =>
          !object(row) ||
          typeof row.role !== "string" ||
          !Object.hasOwn(deck, row.role) ||
          deck[row.role] !== row.count,
      ) ||
      new Set(rows.map((row) => (row as Record<string, unknown>).role)).size !== 6
    )
      return false;
    const wins = c.winConditions ?? (c.winCondition ? [c.winCondition] : []);
    if (
      !Array.isArray(wins) ||
      wins.length !== 1 ||
      wins[0] !== "slaughter_side" ||
      (c.winCondition !== undefined && c.winCondition !== "slaughter_side")
    )
      return false;
    if (!object(c.voting) || c.voting.exilePolicy !== "awa_one_pk_v1") return false;
    return (
      c.orderPrince === undefined ||
      (object(c.orderPrince) &&
        Object.keys(c.orderPrince).length === 1 &&
        c.orderPrince.policy === policy)
    );
  } catch {
    return false;
  }
}
