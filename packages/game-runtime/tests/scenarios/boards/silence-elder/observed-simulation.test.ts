/**
 * 负责禁言原板的受限观察整局场景测试。输入为两语、每语二十固定seed与公开观察机器人，
 * 独立预期为自然终局、零fallback、本人选择／公开表达分离及严格同构建Tape一致。
 * 篡改受众、动作内容、历史和公告身份必须拒绝；不使用God状态替机器人选择或更改旧指纹。
 */
import { expect, test } from "bun:test";
import path from "node:path";
import { silenceElderTwelveConfig } from "../../../../src/rulesets/presets/silence-elder-twelve";
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
  test(`Silence自然整局与严格复现/${locale}`, async () => {
    const board = parseBoardDefinition(
      boardDefinitionFromConfig("silence_observed", structuredClone(silenceElderTwelveConfig)),
    );
    const report = await simulateGames(board, {
      locale,
      seeds: Array.from({ length: 20 }, (_, i) => `silence:${locale}:${i}`),
      styles: ["active", "conservative", "competitive", "random"],
      maxDays: 30,
      recordRoot: await createTestTempDirectory("awa-silence-observed-"),
    });
    expect(report.naturallyFinished).toBe(20);
    expect(report.fallbacks).toBe(0);
    expect(report.branches.silence_chosen).toBeGreaterThan(0);
    expect(report.branches.silence_gesture).toBeGreaterThan(0);
    const output = await createTestTempDirectory("awa-silence-replay-");
    for (const [i, game] of report.games.entries()) {
      const record = await readReproduction(path.join(game.recordDir, "reproduction.json"));
      expect((await replayReproduction(record, path.join(output, String(i)))).snapshot).toEqual(
        record.checkpoints.at(-1)!.snapshot,
      );
      const chosen = record.events.findIndex((e) => e.type === "silence_chosen");
      if (chosen >= 0) {
        const audience = structuredClone(record);
        audience.events[chosen]!.audience = [];
        expect(() => parseReproductionRecord(audience)).toThrow();
        const state = structuredClone(record);
        state.checkpoints
          .at(-1)!
          .players.find((p) => p.role === "silence_elder")!.privateState.silenceElder = {
          policy: "awa_melbourne_gestures_v1",
          history: [],
        };
        expect(() => parseReproductionRecord(state)).toThrow();
      }
      const announced = record.events.findIndex((e) => e.type === "silence_announced");
      if (announced >= 0) {
        const leak = structuredClone(record);
        leak.events[announced]!.payload.actorId = 99;
        expect(() => parseReproductionRecord(leak)).toThrow();
      }
      const gesture = record.events.findIndex((e) => e.type === "silence_gesture");
      if (gesture >= 0) {
        const altered = structuredClone(record);
        altered.events[gesture]!.payload.description = "Forged other gesture";
        expect(() => parseReproductionRecord(altered)).toThrow();
      }
    }
  }, 180000);
