/**
 * 负责觉醒女巫原十二人板的两语受限观察自然整局与严格复现验收。
 * 每语二十固定seed；机器人只获本人知识和私密feed，独立预期是自然终局、零fallback、资格唯一与保密。
 * 三轮/否决/不足人数的精确分支另有人工窗口和真实四夜协议计划，此处不把特权God状态交给机器人。
 * 此为场景测试层级，覆盖实际观察机器人与完整录制复现，而非仅工具单元。
 */
import { expect, test } from "bun:test";
import path from "node:path";
import { awakenedWitchTwelveConfig } from "../../../../src/rulesets/presets/awakened-witch-twelve";
import {
  parseBoardDefinition,
  boardDefinitionFromConfig,
} from "../../../../src/app/config/board-definition";
import { simulateGames } from "../../../../src/app/simulation/simulate-games";
import {
  readReproduction,
  replayReproduction,
} from "../../../../src/app/simulation/replay-reproduction";
import { parseReproductionRecord } from "../../../../src/recording/reproduction/format";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";
for (const locale of ["zh-CN", "en"] as const)
  test(`AwWitch真实受限观察整局与严格复现/${locale}`, async () => {
    const board = parseBoardDefinition(
        boardDefinitionFromConfig(
          "awa_awakened_witch_12_v1",
          structuredClone(awakenedWitchTwelveConfig),
        ),
      ),
      report = await simulateGames(board, {
        locale,
        seeds: Array.from({ length: 20 }, (_, i) => `awakened-witch:${locale}:${i}`),
        styles: ["active", "conservative", "competitive", "random"],
        maxDays: 30,
        recordRoot: await createTestTempDirectory("awa-awitch-observed-"),
      });
    expect(report.naturallyFinished).toBe(20);
    expect(report.fallbacks).toBe(0);
    expect(report.branches.awakened_brew_chosen).toBeGreaterThan(0);
    expect(report.branches.brew_started).toBeGreaterThan(0);
    const output = await createTestTempDirectory("awa-awitch-replay-");
    for (const [i, game] of report.games.entries()) {
      const record = await readReproduction(path.join(game.recordDir, "reproduction.json"));
      expect((await replayReproduction(record, path.join(output, String(i)))).snapshot).toEqual(
        record.checkpoints.at(-1)!.snapshot,
      );
      const chosen = record.events.findIndex((e) => e.type === "awakened_brew_chosen");
      if (chosen >= 0) {
        const leak = structuredClone(record);
        leak.events[chosen]!.audience = [];
        expect(() => parseReproductionRecord(leak)).toThrow();
      }
      const discussed = record.events.findIndex((e) => e.type === "brew_discussion");
      if (discussed >= 0) {
        const change = structuredClone(record);
        change.events[discussed]!.payload.text = "Forged private contribution";
        expect(() => parseReproductionRecord(change)).toThrow();
      }
      const resolution = record.events.findIndex((e) => e.type === "brew_resolved");
      if (resolution >= 0) {
        const leak = structuredClone(record),
          witch = record.metadata.players.find((p) => p.role === "awakened_witch")!.id;
        leak.events[resolution]!.audience = [witch];
        expect(() => parseReproductionRecord(leak)).toThrow();
      }
      const receipt = record.events.findIndex((e) => e.type === "brew_approval");
      if (receipt >= 0) {
        const flip = structuredClone(record);
        flip.events[receipt]!.payload.approve = !flip.events[receipt]!.payload.approve;
        expect(() => parseReproductionRecord(flip)).toThrow();
      }
    }
  }, 180000);
