/**
 * 场景测试负责觉醒狼王原十／十二人板的受限观察整局与严格同构建复现。输入为每板两语各二十固定seed，
 * 独立预期是自然终局、零fallback、双方亲传／本人消费分离，以及原库存不得由归档重新授权。
 * 所有行动来自公开DTO机器人；篡改受众、单位库存、付款目标都须被独立账本拒绝。
 */
import { expect, test } from "bun:test";
import path from "node:path";
import {
  awakenedWolfKingTenConfig,
  awakenedWolfKingTwelveConfig,
} from "../../../../src/rulesets/presets/awakened-wolf-king";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../../src/app/config/board-definition";
import { simulateGames } from "../../../../src/app/simulation/simulate-games";
import {
  readReproduction,
  replayReproduction,
} from "../../../../src/app/simulation/replay-reproduction";
import { parseReproductionRecord } from "../../../../src/recording/reproduction/format";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";

for (const [size, config] of [
  [10, awakenedWolfKingTenConfig],
  [12, awakenedWolfKingTwelveConfig],
] as const)
  for (const locale of ["zh-CN", "en"] as const)
    test(`King原板自然整局与严格复现/${size}/${locale}`, async () => {
      const board = parseBoardDefinition(
        boardDefinitionFromConfig(`king_observed_${size}`, structuredClone(config)),
      );
      const report = await simulateGames(board, {
        locale,
        seeds: Array.from({ length: 20 }, (_, i) => `king:${size}:${locale}:${i}`),
        styles: ["active", "conservative", "competitive", "random"],
        maxDays: 30,
        recordRoot: await createTestTempDirectory("awa-king-observed-"),
      });
      expect(report.naturallyFinished).toBe(20);
      expect(report.fallbacks).toBe(0);
      expect(report.branches.awakened_claw_bequeathed).toBeGreaterThan(0);
      expect(report.branches.awakened_claw_spent).toBeGreaterThan(0);
      const output = await createTestTempDirectory("awa-king-replay-");
      for (const [i, game] of report.games.entries()) {
        const record = await readReproduction(path.join(game.recordDir, "reproduction.json"));
        expect((await replayReproduction(record, path.join(output, String(i)))).snapshot).toEqual(
          record.checkpoints.at(-1)!.snapshot,
        );
        const gifted = record.events.findIndex((e) => e.type === "awakened_claw_bequeathed");
        if (gifted >= 0) {
          const audience = structuredClone(record);
          audience.events[gifted]!.audience = [];
          expect(() => parseReproductionRecord(audience)).toThrow();
        }
        const spent = record.events.findIndex((e) => e.type === "awakened_claw_spent");
        if (spent >= 0) {
          const altered = structuredClone(record);
          const event = altered.events[spent]!;
          if (event.type === "awakened_claw_spent")
            event.payload.targetId = event.payload.targetId === null ? 1 : null;
          expect(() => parseReproductionRecord(altered)).toThrow();
        }
        const state = structuredClone(record);
        state.checkpoints
          .at(-1)!
          .players.find((p) => p.role === "awakened_wolf_king")!.privateState.awakenedClaws = {
          policy: "awa_awakened_wolf_king_v1",
          units: [],
          bequests: [],
        };
        expect(() => parseReproductionRecord(state)).toThrow();
      }
    }, 240000);
