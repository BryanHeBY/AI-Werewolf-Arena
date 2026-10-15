/**
 * 观察驱动的整局场景运行噩梦之影恐惧与狼人行动策略组合。
 * 输入为公开恐惧／狼人策略分支、有限观察及逐局录制。
 * 字面预期为首恐惧事实存在、畸形受众／payload 被拒、自然完成及无回退；严格重放与原末 checkpoint 做一致性对照。
 * 测试不调用付费模型，也不重写预期 fixture／Tape 字节。
 */
import { parseReproductionRecord } from "../../../../src/recording/reproduction/format";
import { expect, test } from "bun:test";
import path from "node:path";
import { nightmareTwelveConfig } from "../../../../src/rulesets/presets/nightmare-twelve";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../../src/app/config/board-definition";
import { simulateGames } from "../../../../src/app/simulation/simulate-games";
import {
  readReproduction,
  replayReproduction,
} from "../../../../src/app/simulation/replay-reproduction";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";
for (const fear of ["optional", "required_when_legal"] as const)
  for (const wolf of ["standard", "no_blast_no_self_knife"] as const)
    for (const locale of ["zh-CN", "en"] as const)
      test(`Nightmare restricted observation games and strict Tape/${fear}/${wolf}/${locale}`, async () => {
        const config = structuredClone(nightmareTwelveConfig);
        config.nightmareShadow!.fearActionPolicy = fear;
        config.nightmareShadow!.wolfActionPolicy = wolf;
        const board = parseBoardDefinition(
          boardDefinitionFromConfig(`nightmare_${fear}_${wolf}`, config),
        );
        const report = await simulateGames(board, {
          locale,
          seeds: Array.from({ length: 20 }, (_, i) => `nightmare:${fear}:${wolf}:${i}`),
          styles: ["active", "conservative", "competitive", "random"],
          maxDays: 30,
          recordRoot: await createTestTempDirectory("awa-nightmare-observed-"),
        });
        expect(report.games).toHaveLength(20);
        expect(report.fallbacks).toBe(0);
        expect(report.naturallyFinished).toBe(20);
        const output = await createTestTempDirectory("awa-nightmare-tape-");
        for (const game of report.games) {
          const record = await readReproduction(path.join(game.recordDir, "reproduction.json"));
          const factIndex = record.events.findIndex((e) => e.type === "nightmare_fear_committed");
          expect(factIndex).toBeGreaterThanOrEqual(0);
          const badAudience = structuredClone(record);
          badAudience.events[factIndex]!.audience = [];
          expect(() => parseReproductionRecord(badAudience)).toThrow("reproduction_record_invalid");
          const badPayload = structuredClone(record);
          badPayload.events[factIndex]!.payload.wolfBlocked = true;
          expect(() => parseReproductionRecord(badPayload)).toThrow("reproduction_record_invalid");
          const missingAudience = structuredClone(record);
          delete missingAudience.events[factIndex]!.audience;
          expect(() => parseReproductionRecord(missingAudience)).toThrow(
            "reproduction_record_invalid",
          );
          expect(
            (
              await replayReproduction(
                record,
                path.join(output, game.seed.replace(/[^a-z0-9]/gi, "_")),
              )
            ).snapshot,
          ).toEqual(record.checkpoints.at(-1)!.snapshot);
        }
      }, 180000);
