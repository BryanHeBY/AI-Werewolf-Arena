/**
 * 观察驱动的整局场景运行动物梦境在固定受限观察种子下的策略分支。
 * 输入为现有动物板、明确的白猫／河豚策略及模拟录制。
 * 字面预期为二十局自然完成、无拒绝／回退；逐局严格重放与原末 checkpoint 对照，属于录制一致性检查。
 * 测试不调用付费模型，也不重写预期 fixture／Tape 字节。
 */
import { expect, test } from "bun:test";
import path from "node:path";
import { loadBoardDefinition } from "../../../../src/app/config/load-board-definition";
import { simulateGames } from "../../../../src/app/simulation/simulate-games";
import {
  readReproduction,
  replayReproduction,
} from "../../../../src/app/simulation/replay-reproduction";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";
for (const skipped of ["wait", "skip"])
  for (const ballot of ["first", "final"])
    for (const locale of ["zh-CN", "en"] as const)
      test(`Animal limited observations 20 fixed seeds ${skipped}/${ballot}/${locale}`, async () => {
        const board = await loadBoardDefinition(
            path.resolve(import.meta.dir, "../../../../../configs.example"),
            `twelve_player_animal_dream_${skipped}_${ballot}`,
          ),
          root = await createTestTempDirectory("awa-animal-observed-");
        const report = await simulateGames(board, {
          locale,
          seeds: Array.from({ length: 20 }, (_, i) => `animal-observed-v1:${i}`),
          styles: ["active", "conservative", "competitive", "random"],
          recordRoot: root,
          maxDays: 30,
        });
        expect(report.naturallyFinished).toBe(20);
        expect(report.rejects).toBe(0);
        expect(report.fallbacks).toBe(0);
        for (const game of report.games) {
          const record = await readReproduction(path.join(game.recordDir, "reproduction.json"));
          expect((await replayReproduction(record, root + "/tape")).snapshot).toEqual(
            record.checkpoints.at(-1)!.snapshot,
          );
        }
      }, 180000);
