/**
 * 观察驱动的整局场景以二十个种子验证黑市库存和赠予分支。
 * 输入为现有板子、受限观察及逐局捕获的记录。
 * 字面约束为库存不增、资源字段固定、至多一次提交及提交／跳过分支覆盖；严格 Tape 结果另与原录制作一致性对照，checkpoint 本身来自记录。
 * 测试不调用付费模型，也不重写预期 fixture／Tape 字节。
 */
import { expect, test } from "bun:test";
import path from "node:path";
import { writeFile } from "node:fs/promises";
import { loadBoardDefinition } from "../../../../src/app/config/load-board-definition";
import { simulateGames } from "../../../../src/app/simulation/simulate-games";
import {
  readReproduction,
  replayReproduction,
} from "../../../../src/app/simulation/replay-reproduction";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";
for (const id of ["six_player_black_market_merchant", "twelve_player_black_market_merchant"])
  test(`${id}: twenty observed games finish naturally and preserve Black resources under strict Tape`, async () => {
    const board = await loadBoardDefinition(
        path.resolve(import.meta.dir, "../../../../../configs.example"),
        id,
      ),
      report = await simulateGames(board, {
        seeds: Array.from({ length: 20 }, (_, i) => `black-random:${i}`),
        styles: ["active", "conservative", "competitive", "random"],
        recordRoot: await createTestTempDirectory("awa-black-seeds-"),
        maxDays: 12,
      });
    expect(report.games).toHaveLength(20);
    expect(report.naturallyFinished).toBe(20);
    expect(report.rejects).toBe(0);
    expect(report.fallbacks).toBe(0);
    expect(report.branches.black_market_trade_committed).toBeGreaterThan(0);
    expect(report.branches.black_market_trade_skipped).toBeGreaterThan(0);
    await writeFile(
      `/tmp/awa-black-${id}-branches.json`,
      JSON.stringify({ branches: report.branches, naturallyFinished: report.naturallyFinished }),
    );
    const output = await createTestTempDirectory("awa-black-replayed-");
    for (const game of report.games) {
      const record = await readReproduction(path.join(game.recordDir, "reproduction.json"));
      const actor = record.metadata.players.find((p) => p.role === "black_market_merchant")!.id;
      let remaining = 1;
      for (const checkpoint of record.checkpoints) {
        const state = checkpoint.players.find((p) => p.id === actor)!.privateState
          .black_market_merchant as any;
        expect(state.remaining).toBeLessThanOrEqual(remaining);
        remaining = state.remaining;
        expect(Object.keys(state).sort()).toEqual(["choice", "closedDay", "remaining"]);
      }
      expect(
        record.events.filter((e) => e.type === "black_market_trade_committed").length,
      ).toBeLessThanOrEqual(1);
      expect((await replayReproduction(record, output)).snapshot.result).toEqual(game.result);
    }
  }, 30000);
