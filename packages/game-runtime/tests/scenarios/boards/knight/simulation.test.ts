/**
 * 观察驱动的整局场景验证骑士决斗分支实际执行。
 * 输入为现有板子、受限玩家观察及固定种子录制。
 * 字面预期为决斗分支出现、自然完成及无拒绝／回退；原 checkpoint 的精确重放另作录制一致性对照。
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
for (const id of ["six_player_knight", "twelve_player_knight"] as const)
  test(`${id}: restricted-observation seeds really duel targets and every outcome strictly replays`, async () => {
    const board = await loadBoardDefinition(
      path.resolve(import.meta.dir, "../../../../../../configs.example"),
      id,
    );
    const report = await simulateGames(board, {
      seeds: Array.from({ length: 20 }, (_, index) => `knight-random:${index}`),
      styles: ["active"],
      recordRoot: await createTestTempDirectory("awa-knight-random-"),
      maxDays: 12,
    });
    expect(report.games).toHaveLength(20);
    expect(report.rejects).toBe(0);
    expect(report.fallbacks).toBe(0);
    expect(report.naturallyFinished).toBe(20);
    expect(report.branches.knight_duel).toBeGreaterThan(0);
    const root = await createTestTempDirectory("awa-knight-random-replays-");
    for (const game of report.games) {
      const record = await readReproduction(path.join(game.recordDir, "reproduction.json"));
      expect((await replayReproduction(record, root)).snapshot.result).toEqual(game.result);
    }
  }, 30000);
