/**
 * Observed-game scenarios verify White Wolf King actual blast targets and outcomes.
 * Input: Existing boards, restricted player inputs and fixed seed recordings.
 * Output and independent oracle: Executed target/death coverage and strict replay of every complete game.
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
for (const id of ["six_player_white_wolf_king", "twelve_player_white_wolf_king"] as const)
  test(`${id}: restricted-observation seeds really take targets and every outcome strictly replays`, async () => {
    const board = await loadBoardDefinition(
      path.resolve(import.meta.dir, "../../../../../configs.example"),
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
