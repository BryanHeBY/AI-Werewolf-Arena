/**
 * Observed-game scenarios verify Psychic unique inspection, repeat and optional pass.
 * Input: Restricted observations, existing boards and recorded fixed seed games.
 * Output and independent oracle: Real inspection coverage, no hidden-pack input and exact original checkpoint replay.
 * The test never calls a billed model or rewrites expected fixture/Tape bytes.
 */
import { fixtureNumber } from "../support/fixture_values";
import { expect, test } from "bun:test";
import path from "node:path";
import { loadBoardDefinition } from "../../src/runtime/config/load_board_definition";
import { simulateGames } from "../../src/runtime/simulation/simulate_games";
import {
  readReproduction,
  replayReproduction,
} from "../../src/runtime/simulation/replay_reproduction";
import { createTestTempDirectory } from "../support/drivers/temp-directories";
for (const id of ["six_player_psychic", "twelve_player_psychic"] as const)
  test(`${id}: restricted observations exercise real inspection, repeat and pass without hidden truth; every complete game strictly replays`, async () => {
    const board = await loadBoardDefinition(
        path.resolve(import.meta.dir, "../../../configs.example"),
        id,
      ),
      report = await simulateGames(board, {
        seeds: Array.from({ length: 20 }, (_, i) => `psychic-random:${i}`),
        styles: ["active", "conservative", "competitive", "random"],
        recordRoot: await createTestTempDirectory("awa-psychic-random-"),
        maxDays: 12,
      });
    expect(report.games).toHaveLength(20);
    expect(report.naturallyFinished).toBe(20);
    expect(report.rejects).toBe(0);
    expect(report.fallbacks).toBe(0);
    expect(report.branches.role_inspected).toBeGreaterThan(0);
    expect(report.branches.role_inspection_skipped).toBeGreaterThan(0);
    let repeats = 0;
    const root = await createTestTempDirectory("awa-psychic-random-replay-");
    for (const game of report.games) {
      const record = await readReproduction(path.join(game.recordDir, "reproduction.json")),
        actor = record.metadata.players.find((p) => p.role === "psychic")!.id,
        seen = new Set<number>();
      for (const e of record.events) {
        if (e.type === "role_inspected" && e.payload.actorId === actor) {
          if (seen.has(fixtureNumber(e.payload.targetId))) repeats++;
          seen.add(fixtureNumber(e.payload.targetId));
        }
        if (["wolf_discussion", "wolf_kill_vote_cast"].includes(e.type))
          expect(e.payload.actorId).not.toBe(actor);
      }
      expect((await replayReproduction(record, root)).snapshot.result).toEqual(game.result);
    }
    expect(repeats).toBeGreaterThan(0);
  }, 30000);
