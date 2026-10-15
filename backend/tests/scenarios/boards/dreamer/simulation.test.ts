/**
 * 观察驱动的整局场景验证受限观察对局中摄梦技能实际执行及逐局重放。
 * 输入为现有板子、受限机器人种子及持久化的完整对局。
 * 字面预期为梦技能分支出现、自然结束及无拒绝／回退；重放结果与本局录制结果做一致性对照，机器人输入不携带隐藏 World 数据。
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
for (const id of ["six_player_dreamer", "twelve_player_dreamer"] as const)
  test(`${id}: restricted-observation seeds receive real dream actions and each complete game strictly replays`, async () => {
    const board = await loadBoardDefinition(
      path.resolve(import.meta.dir, "../../../../../configs.example"),
      id,
    );
    const report = await simulateGames(board, {
      seeds: Array.from({ length: 20 }, (_, index) => `dream-random:${index}`),
      styles: ["active"],
      recordRoot: await createTestTempDirectory("awa-dream-random-"),
      maxDays: 12,
    });
    expect(report.games).toHaveLength(20);
    expect(report.rejects).toBe(0);
    expect(report.fallbacks).toBe(0);
    expect(report.naturallyFinished).toBe(20);
    expect(report.branches.dream_applied).toBeGreaterThan(0);
    const root = await createTestTempDirectory("awa-dream-random-replay-");
    for (const game of report.games) {
      const record = await readReproduction(path.join(game.recordDir, "reproduction.json"));
      expect((await replayReproduction(record, root)).snapshot.result).toEqual(game.result);
    }
  }, 30000);
