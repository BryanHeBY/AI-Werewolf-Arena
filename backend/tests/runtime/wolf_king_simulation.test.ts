/**
 * Observed-game scenarios verify Wolf King original death shot is actually exercised.
 * Input: Restricted-observation fixed seeds and original runtime records.
 * Output and independent oracle: Real shot coverage, natural terminal state and exact strict reproduction.
 * The test never calls a billed model or rewrites expected fixture/Tape bytes.
 */
import { expect, test } from "bun:test";
import { loadBoardDefinition } from "../../src/runtime/config/load_board_definition";
import { simulateGames } from "../../src/runtime/simulation/simulate_games";
import {
  readReproduction,
  replayReproduction,
} from "../../src/runtime/simulation/replay_reproduction";
import { createTestTempDirectory } from "../support/drivers/temp-directories";
import path from "node:path";

for (const id of ["six_player_wolf_king", "twelve_player_wolf_king"] as const)
  test(`${id}: restricted-observation random games actually execute the new shot and strictly reproduce every result`, async () => {
    const board = await loadBoardDefinition(
      path.resolve(import.meta.dir, "../../../configs.example"),
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
