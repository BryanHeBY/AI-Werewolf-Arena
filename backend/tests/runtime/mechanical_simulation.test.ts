import { expect, test } from "bun:test";
import path from "node:path";
import { loadBoardDefinition } from "../../src/runtime/config/load_board_definition";
import { simulateGames } from "../../src/runtime/simulation/simulate_games";
import {
  readReproduction,
  replayReproduction,
} from "../../src/runtime/simulation/replay_reproduction";
import { createTestTempDirectory } from "../support/temp_directory";

for (const id of ["six_player_mechanical_wolf", "twelve_player_mechanical_wolf"] as const)
  test(`${id}: restricted-observation mechanical seeds naturally finish with active learning, skill/mode and exact Tape`, async () => {
    const board = await loadBoardDefinition(
      path.resolve(import.meta.dir, "../../../configs.example"),
      id,
    );
    const report = await simulateGames(board, {
      seeds: Array.from(
        { length: 20 },
        (_, i) => `mechanical-random:${i + (id.startsWith("twelve") ? 60 : 0)}`,
      ),
      styles: ["active", "conservative", "competitive", "random"],
      recordRoot: await createTestTempDirectory("awa-mechanical-random-"),
      maxDays: 12,
    });
    expect(report.games).toHaveLength(20);
    expect(report.rejects).toBe(0);
    expect(report.fallbacks).toBe(0);
    expect(report.naturallyFinished).toBe(20);
    expect(report.branches.mechanical_mimicked).toBeGreaterThan(0);
    expect(report.branches.mechanical_mode_selected).toBeGreaterThan(0);
    const root = await createTestTempDirectory("awa-mechanical-random-replay-");
    let inheritedKnives = 0,
      skills = 0,
      skips = 0,
      inheritance = 0;
    for (const game of report.games) {
      const record = await readReproduction(path.join(game.recordDir, "reproduction.json")),
        actor = record.metadata.players.find((p) => p.role === "mechanical_wolf")!.id;
      for (const event of record.events) {
        if (event.type === "wolf_kill_vote_cast" && event.payload.actorId === actor)
          inheritedKnives++;
        if (
          ["mechanical_poison_used", "mechanical_guard_chosen"].includes(event.type) ||
          (event.type === "role_inspected" && event.payload.actorId === actor)
        )
          skills++;
        if (["mechanical_skill_skipped", "mechanical_mimic_skipped"].includes(event.type)) skips++;
        if (event.type === "mechanical_awakened") inheritance++;
        if (["wolf_discussion", "wolf_discussion_ended"].includes(event.type))
          expect(event.payload.actorId).not.toBe(actor);
      }
      expect((await replayReproduction(record, root)).snapshot.result).toEqual(game.result);
    }
    expect(skills).toBeGreaterThan(0);
    expect(skips).toBeGreaterThan(0);
    expect(inheritance).toBeGreaterThan(0);
    expect(inheritedKnives).toBeGreaterThan(0);
  }, 30000);
