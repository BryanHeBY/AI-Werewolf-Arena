import { expect, test } from "bun:test";
import path from "node:path";
import { writeFile } from "node:fs/promises";
import { loadBoardDefinition } from "../../src/runtime/config/load_board_definition";
import { simulateGames } from "../../src/runtime/simulation/simulate_games";
import { readReproduction, replayReproduction } from "../../src/runtime/simulation/replay_reproduction";
import { createTestTempDirectory } from "../support/temp_directory";

for (const id of ["six_player_awakened_hidden_wolf", "twelve_player_awakened_hidden_wolf"]) test(`${id}: twenty observed seeds finish naturally, preserve copied resources and reproduce strict Tape`, async () => {
  const board = await loadBoardDefinition(path.resolve(import.meta.dir, "../../../configs.example"), id);
  const report = await simulateGames(board, { seeds: Array.from({ length: 20 }, (_, i) => `awakened-random:${i}`), styles: ["active", "conservative", "competitive", "random"], recordRoot: await createTestTempDirectory("awa-awakened-seeds-"), maxDays: 12 });
  expect(report.games).toHaveLength(20); expect(report.naturallyFinished).toBe(20); expect(report.rejects).toBe(0); expect(report.fallbacks).toBe(0);
  expect(report.branches.awakened_mimicked).toBeGreaterThan(0); expect(report.branches.awakened_ready).toBeGreaterThan(0); expect(report.branches.awakened_inherited).toBeGreaterThan(0); expect(report.branches.awakened_mimic_skipped).toBeGreaterThan(0);
  expect(report.branches.awakened_poison_used).toBeGreaterThan(0);
  await writeFile(`/tmp/awa-p7-${id}-seed-branches.json`, JSON.stringify({ naturallyFinished: report.naturallyFinished, branches: report.branches }));
  const output = await createTestTempDirectory("awa-awakened-seed-replayed-");
  for (const game of report.games) {
    const record = await readReproduction(path.join(game.recordDir, "reproduction.json")), actor = record.metadata.players.find(player => player.role === "awakened_hidden_wolf")!.id;
    let poison = 1, extra = "available"; const checked = new Set<number>();
    for (const checkpoint of record.checkpoints) {
      const state = checkpoint.players.find(player => player.id === actor)!.privateState.awakened_hidden_wolf as any, learned = state.learned;
      if (learned?.skill.kind === "poison") { expect(learned.skill.remaining).toBeLessThanOrEqual(poison); poison = learned.skill.remaining; }
      if (learned?.skill.kind === "wolf") { if (extra === "spent") expect(learned.skill.extraKnife).toBe("spent"); extra = learned.skill.extraKnife; }
    }
    for (const event of record.events) {
      if (event.type === "role_inspected" && event.payload.actorId === actor) { expect(checked.has(event.payload.targetId)).toBe(false); checked.add(event.payload.targetId); }
      if (["wolf_discussion", "wolf_discussion_ended", "wolf_self_destruct"].includes(event.type)) expect(event.payload.actorId ?? event.payload.wolfId).not.toBe(actor);
      if (event.type === "awakened_ready") expect(event.payload.activeFromNight).toBe(event.payload.activationNight + 1);
    }
    expect((await replayReproduction(record, output)).snapshot.result).toEqual(game.result);
  }
}, 30000);
