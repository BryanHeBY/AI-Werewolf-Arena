/**
 * 观察驱动的整局场景验证白狼王实际自爆分支及完整对局重放。
 * 输入为现有板子、受限玩家输入及固定种子录制。
 * 字面预期为十六局自然完成、无拒绝／回退及自爆分支出现；逐局严格重放对照原结果，不另称独立逐目标死亡预期。
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
for (const id of ["six_player_white_wolf_king", "twelve_player_white_wolf_king"] as const)
  test(`${id}: restricted-observation seeds really take targets and every outcome strictly replays`, async () => {
    const board = await loadBoardDefinition(
      path.resolve(import.meta.dir, "../../../../../../configs.example"),
      id,
    );
    const report = await simulateGames(board, {
      seeds: Array.from({ length: 16 }, (_, index) => `white-wolf-random:${index}`),
      styles: ["active"],
      recordRoot: await createTestTempDirectory("awa-white-random-"),
      maxDays: 12,
    });
    expect(report.games).toHaveLength(16);
    expect(report.rejects).toBe(0);
    expect(report.fallbacks).toBe(0);
    expect(report.naturallyFinished).toBe(16);
    expect(report.branches.white_wolf_king_self_destruct).toBeGreaterThan(0);
    const root = await createTestTempDirectory("awa-white-random-replays-");
    for (const game of report.games) {
      const record = await readReproduction(path.join(game.recordDir, "reproduction.json"));
      expect((await replayReproduction(record, root)).snapshot.result).toEqual(game.result);
    }
  }, 30000);
