import { Camp } from "../../src/core";
import { expect, test } from "bun:test";
import path from "node:path";
import { loadBoardDefinition } from "../../src/runtime/config/load_board_definition";
import { simulateGames } from "../../src/runtime/simulation/simulate_games";
import { readReproduction, replayReproduction } from "../../src/runtime/simulation/replay_reproduction";
import { createTestTempDirectory } from "../support/temp_directory";

for (const id of ["six_player_hybrid", "twelve_player_hybrid"]) test(`${id}: twenty own-observation seeds commit both factions and reproduce exact member outcomes`, async () => {
  const board = await loadBoardDefinition(path.resolve(import.meta.dir, "../../../configs.example"), id), report = await simulateGames(board, { seeds: Array.from({ length: 20 }, (_, i) => `hybrid-random:${i}`), styles: ["active", "conservative", "competitive", "random"], recordRoot: await createTestTempDirectory("awa-hybrid-random-"), maxDays: 12 });
  expect(report.games).toHaveLength(20); expect(report.naturallyFinished).toBe(20); expect(report.rejects).toBe(0); expect(report.fallbacks).toBe(0); expect(report.branches.hybrid_exemplar_chosen).toBe(20);
  let good = 0, wolf = 0, wonGood = 0, wonWolf = 0; const root = await createTestTempDirectory("awa-hybrid-replayed-");
  for (const game of report.games) {
    const record = await readReproduction(path.join(game.recordDir, "reproduction.json")), choice = record.events.find(e => e.type === "hybrid_affiliation_resolved")!;
    choice.payload.faction === "good" ? good++ : wolf++; game.result?.winner === "good" ? wonGood++ : wonWolf++;
    const own = record.checkpoints.at(-1)!.players.find(p => p.role === "hybrid")!;
    expect(own.camp).toBe(Camp.Good); expect(own.victory.affiliations).toEqual([{ kind: "faction", faction: choice.payload.faction === "good" ? "good" : "wolf" }]); expect(choice.payload.faction === "good" || choice.payload.faction === "wolf").toBe(true);
    expect((await replayReproduction(record, root)).snapshot.result).toEqual(game.result);
  }
  expect(good).toBeGreaterThan(0); expect(wolf).toBeGreaterThan(0); expect(wonGood).toBeGreaterThan(0); expect(wonWolf).toBeGreaterThan(0);
}, 30000);
