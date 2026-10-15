/**
 * 观察驱动的整局场景验证狼王原死亡枪确实被执行。
 * 输入为受限观察下的固定种子及原运行时记录。
 * 字面预期为十二局自然完成、无拒绝／回退及枪击分支出现；精确严格复现另对照原录制结果，不另称独立终局表。
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

for (const id of ["six_player_wolf_king", "twelve_player_wolf_king"] as const)
  test(`${id}: restricted-observation random games actually execute the new shot and strictly reproduce every result`, async () => {
    const board = await loadBoardDefinition(
      path.resolve(import.meta.dir, "../../../../../configs.example"),
      id,
    );
    const report = await simulateGames(board, {
      seeds: Array.from({ length: 12 }, (_, index) => `wolf-king-random:${index}`),
      recordRoot: await createTestTempDirectory("awa-wolf-king-random-"),
      maxDays: 12,
    });
    expect(report.games).toHaveLength(12);
    expect(report.rejects).toBe(0);
    expect(report.fallbacks).toBe(0);
    expect(report.naturallyFinished).toBe(12);
    expect(report.branches.wolf_king_shot).toBeGreaterThan(0);
    const root = await createTestTempDirectory("awa-wolf-king-random-replays-");
    for (const game of report.games) {
      const record = await readReproduction(path.join(game.recordDir, "reproduction.json"));
      expect((await replayReproduction(record, root)).snapshot.result).toEqual(game.result);
    }
  }, 30000);
