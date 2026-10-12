/**
 * Observed-game scenarios verify Dreamer actual actions and linked deaths.
 * Input: Existing boards, restricted robot seeds and persisted complete games.
 * Output and independent oracle: Literal dream skill coverage and exact strict replay without hidden World data in bot inputs.
 * The test never calls a billed model or rewrites expected fixture/Tape bytes.
 */
import { expect, test } from "bun:test";
import { loadBoardDefinition } from "../../../../src/runtime/config/load_board_definition";
import { simulateGames } from "../../../../src/runtime/simulation/simulate_games";
import {
  readReproduction,
  replayReproduction,
} from "../../../../src/runtime/simulation/replay_reproduction";
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
