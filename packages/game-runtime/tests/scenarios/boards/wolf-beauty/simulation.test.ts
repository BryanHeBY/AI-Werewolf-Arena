/**
 * 观察驱动的整局场景验证狼美人魅惑选择及关联死亡分支。
 * 输入为现有策略板子、受限玩家输入及录制种子。
 * 字面预期为自然完成、无拒绝／回退及魅惑／魅惑死亡分支出现；完整对局重放与原录制结果做一致性对照。
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
for (const id of ["six_player_wolf_beauty", "twelve_player_wolf_beauty"] as const)
  test(`${id}: restricted-observation seeds receive real charm choices/deaths and each complete game strictly replays`, async () => {
    const board = await loadBoardDefinition(
      path.resolve(import.meta.dir, "../../../../../../configs.example"),
      id,
    );
    // 十二人种子 20–39 包含明确观察到的魅惑死亡分支；
    // 仅用 0–19 虽能自然结束却没有魅惑死亡，因此完成对局本身不足以证明该分支。
    const report = await simulateGames(board, {
      seeds: Array.from(
        { length: 20 },
        (_, index) => `beauty-random:${index + (id.startsWith("twelve") ? 20 : 0)}`,
      ),
      styles: ["active"],
      recordRoot: await createTestTempDirectory("awa-beauty-random-"),
      maxDays: 12,
    });
    expect(report.games).toHaveLength(20);
    expect(report.rejects).toBe(0);
    expect(report.fallbacks).toBe(0);
    expect(report.naturallyFinished).toBe(20);
    expect(report.branches.charm_applied).toBeGreaterThan(0);
    expect(report.branches.charm_death).toBeGreaterThan(0);
    const root = await createTestTempDirectory("awa-beauty-random-replay-");
    for (const game of report.games) {
      const record = await readReproduction(path.join(game.recordDir, "reproduction.json"));
      expect((await replayReproduction(record, root)).snapshot.result).toEqual(game.result);
    }
  }, 30000);
