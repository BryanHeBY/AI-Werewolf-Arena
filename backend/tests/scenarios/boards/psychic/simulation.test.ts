/**
 * 观察驱动的整局场景验证通灵师查验、重复机会及可选跳过。
 * 输入为受限观察、现有板子及固定种子录制对局。
 * 字面约束为查验／重复／跳过覆盖及狼聊／刀行动排除；原 checkpoint 的精确重放另作录制一致性对照。
 * 测试不调用付费模型，也不重写预期 fixture／Tape 字节。
 */
import { fixtureNumber } from "../../../support/oracles/fixture-values";
import { expect, test } from "bun:test";
import path from "node:path";
import { loadBoardDefinition } from "../../../../src/app/config/load-board-definition";
import { simulateGames } from "../../../../src/app/simulation/simulate-games";
import {
  readReproduction,
  replayReproduction,
} from "../../../../src/app/simulation/replay-reproduction";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";
for (const id of ["six_player_psychic", "twelve_player_psychic"] as const)
  test(`${id}: restricted observations exercise real inspection, repeat and pass without hidden truth; every complete game strictly replays`, async () => {
    const board = await loadBoardDefinition(
        path.resolve(import.meta.dir, "../../../../../configs.example"),
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
