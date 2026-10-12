/**
 * Observed-game scenarios verify positive and quiet Bear signals under limited knowledge.
 * Input: Fixed observation seeds and existing Bear boards.
 * Output and independent oracle: Actual positive/quiet skill coverage, natural results and exact complete-game replay.
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
for (const id of ["six_player_bear", "twelve_player_bear"] as const)
  test(`${id}: restricted-observation seeds execute both positive and quiet Bear signals and every complete game strictly replays`, async () => {
    const board = await loadBoardDefinition(
        path.resolve(import.meta.dir, "../../../../../configs.example"),
        id,
      ),
      report = await simulateGames(board, {
        seeds: Array.from({ length: 20 }, (_, i) => `bear-random:${i}`),
        styles: ["active"],
        recordRoot: await createTestTempDirectory("awa-bear-random-"),
        maxDays: 12,
      });
    expect(report.games).toHaveLength(20);
    expect(report.rejects).toBe(0);
    expect(report.fallbacks).toBe(0);
    expect(report.naturallyFinished).toBe(20);
    expect(report.branches.bear_roared).toBeGreaterThan(0);
    let positive = 0,
      quiet = 0;
    const root = await createTestTempDirectory("awa-bear-random-replay-");
    for (const game of report.games) {
      const record = await readReproduction(path.join(game.recordDir, "reproduction.json"));
      for (const e of record.events)
        if (e.type === "bear_roared") {
          expect(Object.keys(e.payload).sort()).toEqual(["day", "roared"]);
          if (e.payload.roared === true) positive++;
          else quiet++;
        }
      expect((await replayReproduction(record, root)).snapshot.result).toEqual(game.result);
    }
    expect(positive).toBeGreaterThan(0);
    expect(quiet).toBeGreaterThan(0);
  }, 30000);
