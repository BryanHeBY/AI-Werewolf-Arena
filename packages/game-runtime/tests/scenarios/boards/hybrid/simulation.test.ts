/**
 * 观察驱动的整局场景验证混血儿按自身知识选择，以及阵营分支覆盖。
 * 输入为现有混血儿板上的二十个固定自身观察种子。
 * 字面约束为本体仍属好人、胜利归属与已录选择相符，以及两种选择／胜方分支均出现；Tape 结果另与原录制作一致性对照，不生成独立胜方表。
 * 测试不调用付费模型，也不重写预期 fixture／Tape 字节。
 */
import { Camp } from "../../../../src/domain";
import { expect, test } from "bun:test";
import path from "node:path";
import { loadBoardDefinition } from "../../../../src/app/config/load-board-definition";
import { simulateGames } from "../../../../src/app/simulation/simulate-games";
import {
  readReproduction,
  replayReproduction,
} from "../../../../src/app/simulation/replay-reproduction";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";

for (const id of ["six_player_hybrid", "twelve_player_hybrid"])
  test(`${id}: twenty own-observation seeds commit both factions and reproduce exact member outcomes`, async () => {
    const board = await loadBoardDefinition(
        path.resolve(import.meta.dir, "../../../../../../configs.example"),
        id,
      ),
      report = await simulateGames(board, {
        seeds: Array.from({ length: 20 }, (_, i) => `hybrid-random:${i}`),
        styles: ["active", "conservative", "competitive", "random"],
        recordRoot: await createTestTempDirectory("awa-hybrid-random-"),
        maxDays: 12,
      });
    expect(report.games).toHaveLength(20);
    expect(report.naturallyFinished).toBe(20);
    expect(report.rejects).toBe(0);
    expect(report.fallbacks).toBe(0);
    expect(report.branches.hybrid_exemplar_chosen).toBe(20);
    let good = 0,
      wolf = 0,
      wonGood = 0,
      wonWolf = 0;
    const root = await createTestTempDirectory("awa-hybrid-replayed-");
    for (const game of report.games) {
      const record = await readReproduction(path.join(game.recordDir, "reproduction.json")),
        choice = record.events.find((e) => e.type === "hybrid_affiliation_resolved")!;
      choice.payload.faction === "good" ? good++ : wolf++;
      game.result?.winner === "good" ? wonGood++ : wonWolf++;
      const own = record.checkpoints.at(-1)!.players.find((p) => p.role === "hybrid")!;
      expect(own.camp).toBe(Camp.Good);
      expect(own.victory.affiliations).toEqual([
        { kind: "faction", faction: choice.payload.faction === "good" ? "good" : "wolf" },
      ]);
      expect(choice.payload.faction === "good" || choice.payload.faction === "wolf").toBe(true);
      expect((await replayReproduction(record, root)).snapshot.result).toEqual(game.result);
    }
    expect(good).toBeGreaterThan(0);
    expect(wolf).toBeGreaterThan(0);
    expect(wonGood).toBeGreaterThan(0);
    expect(wonWolf).toBeGreaterThan(0);
  }, 30000);
