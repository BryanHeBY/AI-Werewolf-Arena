/**
 * Observed-game scenarios verify Animal Dream policy variants over fixed restricted-observation seeds.
 * Input: Existing Animal boards, explicit Cat/Puffer policies and simulation recordings.
 * Output and independent oracle: Natural termination, per-game policy/resource checks and exact strict replay of original checkpoints.
 * The test never calls a billed model or rewrites expected fixture/Tape bytes.
 */
import { expect, test } from "bun:test";
import path from "node:path";
import { loadBoardDefinition } from "../../../../src/runtime/config/load_board_definition";
import { simulateGames } from "../../../../src/runtime/simulation/simulate_games";
import {
  readReproduction,
  replayReproduction,
} from "../../../../src/runtime/simulation/replay_reproduction";
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
