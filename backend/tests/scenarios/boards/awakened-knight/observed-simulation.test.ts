/**
 * 场景测试负责原觉醒骑士十二人板中英各二十受限观察整局及逐份严格复现。
 * 本人DTO驱动守卫与骑士，不读取隐藏阵营选目标；独立要求自然终局、零回退及私有资源不泄漏。
 * 精确三方与连续词顺序另由手写真实协议路线核验，此处不把机器人输出用作规则oracle。
 */
import { expect, test } from "bun:test";
import path from "node:path";
import { awakenedKnightTwelveConfig } from "../../../../src/rulesets/presets/awakened-knight-twelve";
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
for (const locale of ["zh-CN", "en"] as const)
  test(`AwKnight自然整局与严格复现/${locale}`, async () => {
    const board = parseBoardDefinition(
        boardDefinitionFromConfig(
          "awa_netease_awakened_knight_12_v1",
          structuredClone(awakenedKnightTwelveConfig),
        ),
      ),
      report = await simulateGames(board, {
        locale,
        seeds: Array.from({ length: 20 }, (_, i) => `awakened-knight:${locale}:${i}`),
        styles: ["active", "conservative", "competitive", "random"],
        maxDays: 30,
        recordRoot: await createTestTempDirectory("awa-knight-observed-"),
      });
    expect(report.naturallyFinished).toBe(20);
    expect(report.fallbacks).toBe(0);
    expect(report.branches.awakened_protection_chosen).toBeGreaterThan(0);
    expect(report.branches.awakened_duel_committed).toBeGreaterThan(0);
    const output = await createTestTempDirectory("awa-knight-replay-");
    for (const [i, game] of report.games.entries()) {
      const record = await readReproduction(path.join(game.recordDir, "reproduction.json"));
      expect((await replayReproduction(record, path.join(output, String(i)))).snapshot).toEqual(
        record.checkpoints.at(-1)!.snapshot,
      );
      const choice = record.events.findIndex((e) => e.type === "awakened_protection_chosen");
      if (choice >= 0) {
        const leak = structuredClone(record);
        leak.events[choice]!.audience = [];
        expect(() => parseReproductionRecord(leak)).toThrow();
      }
      const attempt = record.events.findIndex((e) => e.type === "awakened_duel_committed");
      if (attempt >= 0) {
        const flipped = structuredClone(record);
        flipped.events[attempt]!.payload.branch =
          flipped.events[attempt]!.payload.branch === "wolf" ? "good" : "wolf";
        expect(() => parseReproductionRecord(flipped)).toThrow();
        const refunded = structuredClone(record);
        refunded.checkpoints
          .at(-1)!
          .players.find((p) => p.role === "awakened_knight")!.privateState.awakenedKnight = {
          policy: "awa_awakened_duel_chain_v1",
          attempts: [],
        };
        expect(() => parseReproductionRecord(refunded)).toThrow();
      }
    }
  }, 240000);
