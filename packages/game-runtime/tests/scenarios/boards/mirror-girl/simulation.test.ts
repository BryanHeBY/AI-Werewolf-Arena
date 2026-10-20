/**
 * 观察驱动的整局场景验证魔镜少女查验去重和可选跳过。
 * 输入为二十个有限观察种子及已录原生身份元数据。
 * 字面约束为目标不重复、查验／跳过覆盖及狼聊／刀行动排除；严格 Tape 结果另与原录制作一致性对照，不独立重建完整身份状态。
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
for (const id of ["six_player_mirror_girl", "twelve_player_mirror_girl"])
  test(`${id}: twenty observed seeds exercise real unique reports and optional passes, with exact Tape`, async () => {
    const board = await loadBoardDefinition(
        path.resolve(import.meta.dir, "../../../../../../configs.example"),
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
