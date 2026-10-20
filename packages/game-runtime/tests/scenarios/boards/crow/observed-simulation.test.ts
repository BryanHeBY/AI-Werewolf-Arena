/**
 * 场景测试负责通过受限观察运行乌鸦两种票轮政策与两语真引擎对局。
 * 输入为公开板子、固定20seed和观察机器人；独立预期是自然终局、零fallback、畸形归档拒绝和严格Tape重放一致。
 * 测试不调用付费模型，不用运行计票函数生成预期，也不更改旧指纹以通过复现。
 */
import { expect, test } from "bun:test";
import path from "node:path";
import { crowTwelveConfig } from "../../../../src/rulesets/presets/crow-twelve";
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
for (const policy of ["initial_ballot_only", "all_ballots"] as const)
  for (const locale of ["zh-CN", "en"] as const)
    test(`Crow自然整局、独立验算与严格复现/${policy}/${locale}`, async () => {
      const config = structuredClone(crowTwelveConfig);
      config.crow!.ballotPolicy = policy;
      const board = parseBoardDefinition(boardDefinitionFromConfig(`crow_${policy}`, config));
      const report = await simulateGames(board, {
        locale,
        seeds: Array.from({ length: 20 }, (_, i) => `crow:${policy}:${locale}:${i}`),
        styles: ["active", "conservative", "competitive", "random"],
        maxDays: 30,
        recordRoot: await createTestTempDirectory("awa-crow-observed-"),
      });
      expect(report.games).toHaveLength(20);
      expect(report.fallbacks).toBe(0);
      expect(report.naturallyFinished).toBe(20);
      expect(report.branches.crow_curse_chosen).toBeGreaterThan(0);
      expect(report.branches.crow_curse_applied).toBeGreaterThan(0);
      const output = await createTestTempDirectory("awa-crow-replay-");
      for (const [index, game] of report.games.entries()) {
        const record = await readReproduction(path.join(game.recordDir, "reproduction.json"));
        expect(
          (await replayReproduction(record, path.join(output, String(index)))).snapshot,
        ).toEqual(record.checkpoints.at(-1)!.snapshot);
        const chosen = record.events.findIndex((e) => e.type === "crow_curse_chosen");
        if (chosen >= 0) {
          const bad = structuredClone(record);
          bad.events[chosen]!.audience = [];
          expect(() => parseReproductionRecord(bad)).toThrow("reproduction_record_invalid");
          const badState = structuredClone(record);
          const cp = badState.checkpoints.at(-1)!;
          const player = cp.players.find((p) => p.role === "crow")!;
          (player.privateState.crow as { history: unknown[] }).history = [];
          expect(() => parseReproductionRecord(badState)).toThrow();
        }
        const bonus = record.events.findIndex((e) => e.type === "crow_curse_applied");
        if (bonus >= 0) {
          const bad = structuredClone(record);
          bad.events[bonus]!.payload.bonus = 2;
          expect(() => parseReproductionRecord(bad)).toThrow("reproduction_record_invalid");
          const missing = structuredClone(record);
          missing.events[bonus]!.type = "ignored_crow_bonus";
          expect(() => parseReproductionRecord(missing)).toThrow();
        }
      }
    }, 180000);
