/**
 * 观察驱动的整局场景验证守墓人真实的被动放逐反馈。
 * 输入为声明的板子、有限玩家观察及固定种子录制对局。
 * 字面预期为反馈分支出现、自然完成及无拒绝／回退；完整对局重放结果另与原录制作一致性对照。
 * 测试不调用付费模型，也不重写预期 fixture／Tape 字节。
 */
import { expect, test } from "bun:test";
import { loadBoardDefinition } from "../../../../src/app/config/load-board-definition";
import { simulateGames } from "../../../../src/app/simulation/simulate-games";
import {
  readReproduction,
  replayReproduction,
} from "../../../../src/app/simulation/replay-reproduction";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";
import path from "node:path";
for (const id of ["six_player_gravekeeper", "twelve_player_gravekeeper"] as const)
  test(`${id}: restricted-observation seeds receive real passive feedback and each complete game strictly replays`, async () => {
    const board = await loadBoardDefinition(
      path.resolve(import.meta.dir, "../../../../../configs.example"),
      id,
    );
    const report = await simulateGames(board, {
      seeds: Array.from({ length: 20 }, (_, index) => `grave-random:${index}`),
      styles: ["active"],
      recordRoot: await createTestTempDirectory("awa-grave-random-"),
      maxDays: 12,
    });
    expect(report.games).toHaveLength(20);
    expect(report.rejects).toBe(0);
    expect(report.fallbacks).toBe(0);
    expect(report.naturallyFinished).toBe(20);
    expect(report.branches.gravekeeper_reported).toBeGreaterThan(0);
    const root = await createTestTempDirectory("awa-grave-random-replay-");
    for (const game of report.games) {
      const record = await readReproduction(path.join(game.recordDir, "reproduction.json"));
      expect((await replayReproduction(record, root)).snapshot.result).toEqual(game.result);
    }
  }, 30000);
