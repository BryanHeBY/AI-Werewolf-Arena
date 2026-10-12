/**
 * Unit test verifies legacy empty win arrays materialize the original effective victory conditions.
 * Input: Original literal legacy overrides with absent, explicit single and empty array conditions.
 * Output and oracle: Exact WinCondition values and warning presence remain unchanged; no public file, World or game execution is needed.
 */
import { WinCondition } from "../../../src/core/domain/identity";
import { expect, test } from "bun:test";
import { convertLegacyBoard } from "../../../src/runtime/config/migrate_board";

test("legacy empty win arrays materialize the conditions the engine actually used", () => {
  const fallback = convertLegacyBoard({ winConditions: [] }, "twelve_player_standard");
  expect(fallback.definition.rules.winConditions).toEqual([WinCondition.SlaughterCity]);
  const single = convertLegacyBoard(
    { winConditions: [], winCondition: "wolf_reach_half" },
    "twelve_player_standard",
  );
  expect(single.definition.rules.winConditions).toEqual([WinCondition.WolfReachHalf]);
  expect(single.warnings).not.toContain(
    "legacy_single_win_condition_shadowed_by_effective_win_conditions",
  );
  const shadowed = convertLegacyBoard(
    { winCondition: "wolf_reach_half" },
    "twelve_player_standard",
  );
  expect(shadowed.warnings).toContain(
    "legacy_single_win_condition_shadowed_by_effective_win_conditions",
  );
});
