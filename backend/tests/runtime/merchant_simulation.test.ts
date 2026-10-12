/**
 * Observed-game scenarios verify Merchant gifts/backlashes and recipient Lucky effects.
 * Input: Own-observation seeds and original native/gifted instances.
 * Output and independent oracle: Literal grant/backlash/effect coverage and exact per-game checkpoint reproduction.
 * The test never calls a billed model or rewrites expected fixture/Tape bytes.
 */
import { expect, test } from "bun:test";
import path from "node:path";
import { loadBoardDefinition } from "../../src/runtime/config/load_board_definition";
import { simulateGames } from "../../src/runtime/simulation/simulate_games";
import {
  readReproduction,
  replayReproduction,
} from "../../src/runtime/simulation/replay_reproduction";
import { createTestTempDirectory } from "../support/drivers/temp-directories";
for (const id of ["six_player_miracle_merchant", "twelve_player_miracle_merchant"])
  test(`${id}: own-observation Merchant seeds reach real gifts/backlashes and Lucky effects with exact Tape`, async () => {
    const board = await loadBoardDefinition(
        path.resolve(import.meta.dir, "../../../configs.example"),
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
