/**
 * 观察驱动的整局场景验证寻香配对选择、查验及关联触发覆盖。
 * 输入为每种语言下二十个固定有限观察种子及声明的板子规则。
 * 字面预期为自然完成、无拒绝／回退及三个机制事件分支出现；保存的末 checkpoint 用于精确重放一致性对照，不生成独立最终成员表。
 * 测试不调用付费模型，也不重写预期 fixture／Tape 字节。
 */
import { expect, test } from "bun:test";
import path from "node:path";
import {
  parseBoardDefinition,
  boardDefinitionFromConfig,
} from "../../../../src/app/config/board-definition";
import { fragrantPairSeerTwelveConfig } from "../../../../src/rulesets/presets/fragrant-pair-seer-twelve";
import { simulateGames } from "../../../../src/app/simulation/simulate-games";
import {
  readReproduction,
  replayReproduction,
} from "../../../../src/app/simulation/replay-reproduction";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";
for (const locale of ["zh-CN", "en"] as const)
  test(`Fragrant limited observations 20 fixed seeds ${locale}`, async () => {
    const board = parseBoardDefinition(
        boardDefinitionFromConfig("awa_fragrant_pair_seer_12_v1", fragrantPairSeerTwelveConfig),
      ),
      root = await createTestTempDirectory("awa-fragrant-observed-"),
      report = await simulateGames(board, {
        locale,
        seeds: Array.from({ length: 20 }, (_, i) => `fragrant-observed:${i}`),
        styles: ["active", "conservative", "competitive", "random"],
        recordRoot: root,
        maxDays: 30,
      });
    expect(report.naturallyFinished).toBe(20);
    expect(report.rejects).toBe(0);
    expect(report.fallbacks).toBe(0);
    expect(report.branches.fragrant_pair_chosen).toBeGreaterThan(0);
    expect(report.branches.fragrant_pair_inspected).toBeGreaterThan(0);
    expect(report.branches.fragrant_link_triggered).toBeGreaterThan(0);
    for (const game of report.games) {
      const record = await readReproduction(path.join(game.recordDir, "reproduction.json"));
      expect((await replayReproduction(record, root + "/tape")).snapshot).toEqual(
        record.checkpoints.at(-1)!.snapshot,
      );
    }
  }, 180000);
