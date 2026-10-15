/**
 * Observed-game scenarios verify Wolf Beauty charm choices and linked deaths.
 * Input: Existing policy boards, restricted player inputs and recorded seeds.
 * Output and independent oracle: Actual charm/death coverage, original scope outcomes and exact complete-game replay.
 * The test never calls a billed model or rewrites expected fixture/Tape bytes.
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
      path.resolve(import.meta.dir, "../../../../../configs.example"),
      id,
    );
    // Twelve-player seeds 20–39 include literal observed charm-death branches;
    // 0–19 alone finish naturally but have no charm death, so completion alone is insufficient.
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
