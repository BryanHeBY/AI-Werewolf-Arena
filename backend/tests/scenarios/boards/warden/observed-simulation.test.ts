/** 负责两语各二十固定seed的受限观察场景测试；字面预期为自然终局、零fallback及全部严格同构建Tape，不使用God oracle替机器人选择。 */
import { expect, test } from "bun:test";
import path from "node:path";
import { wardenTwelveConfig } from "../../../../src/rulesets/presets/warden-twelve";
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
import { validateWardenRecord } from "../../../../src/recording/verification/warden/validate";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";
for (const locale of ["zh-CN", "en"] as const)
  test(`Warden自然整局与strict/${locale}`, async () => {
    const board = parseBoardDefinition(
      boardDefinitionFromConfig("warden_observed", structuredClone(wardenTwelveConfig)),
    );
    const report = await simulateGames(board, {
      locale,
      seeds: Array.from({ length: 20 }, (_, i) => `warden:${locale}:${i}`),
      styles: ["active", "conservative", "competitive", "random"],
      maxDays: 30,
      recordRoot: await createTestTempDirectory("awa-warden-observed-"),
    });
    expect(report.naturallyFinished).toBe(20);
    expect(report.fallbacks).toBe(0);
    expect(report.branches.warden_pair_chosen).toBeGreaterThan(0);
    const output = await createTestTempDirectory("awa-warden-replay-");
    let protectedSourceChecked = false;
    for (const [i, game] of report.games.entries()) {
      const record = await readReproduction(path.join(game.recordDir, "reproduction.json"));
      expect((await replayReproduction(record, path.join(output, String(i)))).snapshot).toEqual(
        record.checkpoints.at(-1)!.snapshot,
      );
      const choice = record.events.findIndex((e) => e.type === "warden_pair_chosen");
      if (choice >= 0) {
        const bad = structuredClone(record);
        bad.events[choice]!.audience = [];
        expect(() => parseReproductionRecord(bad)).toThrow();
        const forged = structuredClone(record);
        const state = forged.checkpoints.at(-1)!.players.find((p) => p.role === "warden")!
          .privateState.warden as { history: unknown[] };
        state.history = [];
        expect(() => parseReproductionRecord(forged)).toThrow();
      }
      const protectedIndex = record.events.findIndex(
        (e) => e.type === "warden_resolved" && e.payload.outcome === "protect",
      );
      if (protectedIndex >= 0 && !protectedSourceChecked) {
        // 从真实自然整局补造已受保护者的初始刀伤；本族独立账本必须拒绝，不能仅靠最终snapshot不一致。
        const forged = structuredClone(record),
          resolution = forged.events[protectedIndex]!,
          target = (resolution.payload.pair as number[])[0]!,
          nightEnd = forged.events.findIndex(
            (e, index) => index > protectedIndex && e.type === "night_resolved",
          ),
          op = forged.operations.find(
            (op) =>
              op.op === "night_damage_resolved" &&
              op.event_count! > protectedIndex &&
              op.event_count! <= nightEnd,
          )!;
        expect(op).toBeDefined();
        (op.output!.deaths as number[]).push(target);
        (op.output!.death_sources as Record<string, string[]>)[target] = ["wolf_kill"];
        expect(() => validateWardenRecord(forged)).toThrow("reproduction_warden_invalid");
        expect(() => parseReproductionRecord(forged)).toThrow();
        protectedSourceChecked = true;
      }
    }
    expect(protectedSourceChecked).toBe(true);
  }, 180000);
