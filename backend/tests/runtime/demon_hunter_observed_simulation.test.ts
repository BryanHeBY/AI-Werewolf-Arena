import { expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { WinCondition } from "../../src/core";
import { demonHunterBoard } from "../support/demon_hunter_scenarios";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../src/runtime/config/board_definition";
import { simulateGames } from "../../src/runtime/simulation/simulate_games";
import {
  readReproduction,
  replayReproduction,
} from "../../src/runtime/simulation/replay_reproduction";
import { createTestTempDirectory } from "../support/drivers/temp-directories";
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
