/**
 * 单元测试以原旧配置覆盖中的缺省、显式单条及空胜利数组为输入，核对旧空数组仍落实原有效胜利条件。精确 WinCondition 值及警告有无为预期；无需公开文件、World 或对局执行。
 */
import { WinCondition } from "../../../src/domain/identity";
import { expect, test } from "bun:test";
import { convertLegacyBoard } from "../../../src/app/config/migrate-board";

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
