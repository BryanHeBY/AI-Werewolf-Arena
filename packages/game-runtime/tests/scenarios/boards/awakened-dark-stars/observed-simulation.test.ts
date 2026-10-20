/**
 * 场景测试负责暗夜星辰两板、两语各二十个受限观察整局与严格同构建复现。
 * 决策只取玩家DTO；验收自然终局、零回退及魅惑／巡猎真实发生，不用God库存驱动策略。
 * 原始归档另做私有受众、巡猎目标和库存退款篡改，独立账本必须拒绝。
 */
import { expect, test } from "bun:test";
import path from "node:path";
import {
  awakenedDarkStarsTenConfig,
  awakenedDarkStarsTwelveConfig,
} from "../../../../src/rulesets/presets/awakened-dark-stars";
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
  [10, awakenedDarkStarsTenConfig],
  [12, awakenedDarkStarsTwelveConfig],
] as const)
  for (const locale of ["zh-CN", "en"] as const)
    test(`DarkStars原板自然整局与严格复现/${size}/${locale}`, async () => {
      const board = parseBoardDefinition(
          boardDefinitionFromConfig(`dark_stars_observed_${size}`, structuredClone(config)),
        ),
        report = await simulateGames(board, {
          locale,
          seeds: Array.from({ length: 20 }, (_, i) => `dark-stars:${size}:${locale}:${i}`),
          styles: ["active", "conservative", "competitive", "random"],
          maxDays: 30,
          recordRoot: await createTestTempDirectory("awa-dark-stars-observed-"),
        });
      expect(report.naturallyFinished).toBe(20);
      expect(report.fallbacks).toBe(0);
      expect(report.branches.awakened_charm_chosen).toBeGreaterThan(0);
      expect(report.branches.awakened_patrol_paid).toBeGreaterThan(0);
      const output = await createTestTempDirectory("awa-dark-stars-replay-");
      for (const [i, game] of report.games.entries()) {
        const record = await readReproduction(path.join(game.recordDir, "reproduction.json"));
        expect((await replayReproduction(record, path.join(output, String(i)))).snapshot).toEqual(
          record.checkpoints.at(-1)!.snapshot,
        );
        const choice = record.events.findIndex((e) => e.type === "awakened_charm_chosen");
        if (choice >= 0) {
          const leak = structuredClone(record);
          leak.events[choice]!.audience = [];
          expect(() => parseReproductionRecord(leak)).toThrow();
        }
        const paid = record.events.findIndex((e) => e.type === "awakened_patrol_paid");
        if (paid >= 0) {
          const changed = structuredClone(record);
          changed.events[paid]!.payload.targetId = size + 1;
          expect(() => parseReproductionRecord(changed)).toThrow();
          const refunded = structuredClone(record),
            hunter = refunded.checkpoints
              .at(-1)!
              .players.find((p) => p.role === "awakened_hunter")!;
          hunter.privateState.awakenedPatrol = {
            policy: "awa_directional_patrol_v1",
            payment: null,
          };
          expect(() => parseReproductionRecord(refunded)).toThrow();
        }
      }
    }, 240000);
