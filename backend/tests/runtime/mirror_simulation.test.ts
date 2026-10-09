import { fixtureNumber } from "../support/fixture_values";
import { expect, test } from "bun:test";
import path from "node:path";
import { loadBoardDefinition } from "../../src/runtime/config/load_board_definition";
import { simulateGames } from "../../src/runtime/simulation/simulate_games";
import { readReproduction, replayReproduction } from "../../src/runtime/simulation/replay_reproduction";
import { createTestTempDirectory } from "../support/temp_directory";
for (const id of ["six_player_mirror_girl", "twelve_player_mirror_girl"]) test(`${id}: twenty observed seeds exercise real unique reports and optional passes, with exact Tape`, async () => {
  const board = await loadBoardDefinition(path.resolve(import.meta.dir, "../../../configs.example"), id), report = await simulateGames(board, { seeds: Array.from({ length: 20 }, (_, i) => `mirror-random:${i}`), styles: ["active", "conservative", "competitive", "random"], recordRoot: await createTestTempDirectory("awa-mirror-random-"), maxDays: 12 });
  expect(report.games).toHaveLength(20); expect(report.naturallyFinished).toBe(20); expect(report.rejects).toBe(0); expect(report.fallbacks).toBe(0); expect(report.branches.role_inspected).toBeGreaterThan(0); expect(report.branches.role_inspection_skipped).toBeGreaterThan(0);
  const root = await createTestTempDirectory("awa-mirror-seed-replayed-");
  for (const game of report.games) { const record = await readReproduction(path.join(game.recordDir, "reproduction.json")), actor = record.metadata.players.find(p => p.role === "mirror_girl")!.id, seen = new Set<number>();
    for (const event of record.events) { if (event.type === "role_inspected" && event.payload.actorId === actor) { expect(seen.has(fixtureNumber(event.payload.targetId))).toBe(false); seen.add(fixtureNumber(event.payload.targetId)); } if (["wolf_discussion", "wolf_kill_vote_cast"].includes(event.type)) expect(event.payload.actorId).not.toBe(actor); }
    expect((await replayReproduction(record, root)).snapshot.result).toEqual(game.result);
  }
}, 30000);
