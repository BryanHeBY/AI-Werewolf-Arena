import { expect, test } from "bun:test";
import { loadBoardDefinition } from "../../src/runtime/config/load_board_definition";
import { simulateGames } from "../../src/runtime/simulation/simulate_games";
import {
  readReproduction,
  replayReproduction,
} from "../../src/runtime/simulation/replay_reproduction";
import { createTestTempDirectory } from "../support/temp_directory";
import path from "node:path";
for (const id of ["six_player_gargoyle", "twelve_player_gargoyle"] as const)
  test(`${id}: restricted-observation seeds inherit real knives without pack chat and every complete game strictly replays`, async () => {
    // The controller checks real branch coverage; decisions only receive their own observation.
    const board = await loadBoardDefinition(
        path.resolve(import.meta.dir, "../../../configs.example"),
        id,
      ),
      report = await simulateGames(board, {
        seeds: Array.from(
          { length: 20 },
          (_, i) => `garg-random:${i + (id.startsWith("twelve") ? 40 : 0)}`,
        ),
        styles: id.startsWith("twelve")
          ? ["active", "conservative", "competitive", "random"]
          : ["active"],
        recordRoot: await createTestTempDirectory("awa-garg-random-"),
        maxDays: 12,
      });
    expect(report.games).toHaveLength(20);
    expect(report.rejects).toBe(0);
    expect(report.fallbacks).toBe(0);
    expect(report.naturallyFinished).toBe(20);
    expect(report.branches.gargoyle_awakened).toBeGreaterThan(0);
    expect(report.branches.role_inspected).toBeGreaterThan(0);
    let inheritedKnives = 0,
      unacquiredOpenings = 0;
    const root = await createTestTempDirectory("awa-garg-random-replay-");
    for (const game of report.games) {
      const record = await readReproduction(path.join(game.recordDir, "reproduction.json")),
        gargoyle = record.metadata.players.find((p) => p.role === "gargoyle")!.id;
      expect(
        record.checkpoints[0].players.find((p) => p.id === gargoyle)!.privateState.gargoyle,
      ).toEqual({ hasInheritedKnife: false });
      unacquiredOpenings++;
      for (const e of record.events) {
        if (e.type === "wolf_kill_vote_cast" && e.payload.actorId === gargoyle) inheritedKnives++;
        if (["wolf_discussion", "wolf_discussion_ended"].includes(e.type))
          expect(e.payload.actorId).not.toBe(gargoyle);
      }
      expect((await replayReproduction(record, root)).snapshot.result).toEqual(game.result);
    }
    expect(inheritedKnives).toBeGreaterThan(0);
    expect(unacquiredOpenings).toBe(20);
  }, 30000);
