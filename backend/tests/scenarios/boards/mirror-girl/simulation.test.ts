/**
 * Observed-game scenarios verify Mirror Girl unique reports and optional passes.
 * Input: Twenty observation-limited seeds and recorded native-role metadata.
 * Output and independent oracle: Original identity/pack exclusions, real report/pass coverage and exact strict Tape.
 * The test never calls a billed model or rewrites expected fixture/Tape bytes.
 */
import { fixtureNumber } from "../../../support/oracles/fixture-values";
import { expect, test } from "bun:test";
import path from "node:path";
import { loadBoardDefinition } from "../../../../src/runtime/config/load_board_definition";
import { simulateGames } from "../../../../src/runtime/simulation/simulate_games";
import {
  readReproduction,
  replayReproduction,
} from "../../../../src/runtime/simulation/replay_reproduction";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";
for (const id of ["six_player_mirror_girl", "twelve_player_mirror_girl"])
  test(`${id}: twenty observed seeds exercise real unique reports and optional passes, with exact Tape`, async () => {
    const board = await loadBoardDefinition(
        path.resolve(import.meta.dir, "../../../../../configs.example"),
        id,
      ),
      report = await simulateGames(board, {
        seeds: Array.from({ length: 20 }, (_, i) => `mirror-random:${i}`),
        styles: ["active", "conservative", "competitive", "random"],
        recordRoot: await createTestTempDirectory("awa-mirror-random-"),
        maxDays: 12,
      });
    expect(report.games).toHaveLength(20);
    expect(report.naturallyFinished).toBe(20);
    expect(report.rejects).toBe(0);
    expect(report.fallbacks).toBe(0);
    expect(report.branches.role_inspected).toBeGreaterThan(0);
    expect(report.branches.role_inspection_skipped).toBeGreaterThan(0);
    const root = await createTestTempDirectory("awa-mirror-seed-replayed-");
    for (const game of report.games) {
      const record = await readReproduction(path.join(game.recordDir, "reproduction.json")),
        actor = record.metadata.players.find((p) => p.role === "mirror_girl")!.id,
        seen = new Set<number>();
      for (const event of record.events) {
        if (event.type === "role_inspected" && event.payload.actorId === actor) {
          expect(seen.has(fixtureNumber(event.payload.targetId))).toBe(false);
          seen.add(fixtureNumber(event.payload.targetId));
        }
        if (["wolf_discussion", "wolf_kill_vote_cast"].includes(event.type))
          expect(event.payload.actorId).not.toBe(actor);
      }
      expect((await replayReproduction(record, root)).snapshot.result).toEqual(game.result);
    }
  }, 30000);
