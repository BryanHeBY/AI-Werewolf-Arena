/**
 * 观察驱动的整局场景运行有限玩家输入下猎魔人不同人数／目标的板子。
 * 输入为每种人数／目标／语言下二十五个固定种子及模拟记录。
 * 字面预期为二十五局自然完成及无回退；逐局严格重放与原末 checkpoint 对照，不额外宣称猎杀分支必已覆盖。
 * 测试不调用付费模型，也不重写预期 fixture／Tape 字节。
 */
import { expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { WinCondition } from "../../../../src/domain";
import { demonHunterBoard } from "../../../support/features/demon-hunter/builders/candidate-world";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../../src/app/config/board-definition";
import { simulateGames } from "../../../../src/app/simulation/simulate-games";
import {
  readReproduction,
  replayReproduction,
} from "../../../../src/app/simulation/replay-reproduction";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";
for (const size of [6, 12] as const)
  for (const goal of [WinCondition.SlaughterCity, WinCondition.SlaughterSide])
    for (const locale of ["zh-CN", "en"] as const)
      test(`${size}/${goal}/${locale}: twenty-five restricted observation games each strict Tape`, async () => {
        const board = parseBoardDefinition(
          boardDefinitionFromConfig(`demon_observed_${size}_${goal}`, demonHunterBoard(size, goal)),
        );
        const report = await simulateGames(board, {
          locale,
          seeds: Array.from({ length: 25 }, (_, i) => `demon-observed:${size}:${goal}:${i}`),
          styles: ["active", "conservative", "competitive", "random"],
          maxDays: 30,
          recordRoot: await createTestTempDirectory("awa-demon-observed-"),
        });
        await fs.writeFile(
          `/tmp/awa-p9-demon-observed-${size}-${goal}-${locale}.json`,
          JSON.stringify(report),
        );
        expect(report.games).toHaveLength(25);
        expect(report.fallbacks).toBe(0);
        expect(report.naturallyFinished).toBe(25);
        const output = await createTestTempDirectory("awa-demon-observed-tape-");
        for (const game of report.games) {
          const record = await readReproduction(path.join(game.recordDir, "reproduction.json"));
          expect(
            (
              await replayReproduction(
                record,
                path.join(output, game.seed.replace(/[^a-z0-9]/gi, "_")),
              )
            ).snapshot,
          ).toEqual(record.checkpoints.at(-1)!.snapshot);
        }
      }, 180000);
