/**
 * 观察驱动的整局场景验证奇迹商人赠予／反噬及接收者的幸运效果。
 * 输入为自身观察种子及原有原生／赠予实例。
 * 字面约束为赠予、反噬、幸运效果及跳过分支均出现；逐局 checkpoint 重放结果另与原录制作一致性对照。
 * 测试不调用付费模型，也不重写预期 fixture／Tape 字节。
 */
import { expect, test } from "bun:test";
import path from "node:path";
import { loadBoardDefinition } from "../../../../src/app/config/load-board-definition";
import { simulateGames } from "../../../../src/app/simulation/simulate-games";
import {
  readReproduction,
  replayReproduction,
} from "../../../../src/app/simulation/replay-reproduction";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";
for (const id of ["six_player_miracle_merchant", "twelve_player_miracle_merchant"])
  test(`${id}: own-observation Merchant seeds reach real gifts/backlashes and Lucky effects with exact Tape`, async () => {
    const board = await loadBoardDefinition(
        path.resolve(import.meta.dir, "../../../../../../configs.example"),
        id,
      ),
      report = await simulateGames(board, {
        seeds: Array.from({ length: 20 }, (_, i) => `merchant-random:${i}`),
        styles: ["active", "conservative", "competitive", "random"],
        recordRoot: await createTestTempDirectory("awa-merchant-random-"),
        maxDays: 12,
      });
    expect(report.games).toHaveLength(20);
    expect(report.naturallyFinished).toBe(20);
    expect(report.rejects).toBe(0);
    expect(report.fallbacks).toBe(0);
    expect(report.branches.merchant_trade_committed).toBeGreaterThan(0);
    let gifts = 0,
      failures = 0,
      luckyEffects = 0,
      waits = 0;
    const root = await createTestTempDirectory("awa-merchant-replayed-");
    for (const game of report.games) {
      const record = await readReproduction(path.join(game.recordDir, "reproduction.json"));
      for (const event of record.events) {
        if (event.type === "merchant_trade_resolved")
          event.payload.outcome === "granted" ? gifts++ : failures++;
        if (
          ["guard_applied", "seer_checked", "witch_potion_used"].includes(event.type) &&
          event.payload.abilityId === "gift:miracle"
        )
          luckyEffects++;
        if (["merchant_trade_skipped", "lucky_ability_skipped"].includes(event.type)) waits++;
      }
      expect((await replayReproduction(record, root)).snapshot.result).toEqual(game.result);
    }
    expect(gifts).toBeGreaterThan(0);
    expect(failures).toBeGreaterThan(0);
    expect(luckyEffects).toBeGreaterThan(0);
    expect(waits).toBeGreaterThan(0);
  }, 30000);
