import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { assertReplayDocument, type ReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { parseBoardDefinition } from "../../src/runtime/config/board_definition";
import { simulateGames, type SimulationReport } from "../../src/runtime/simulation/simulate_games";
import {
  readReproduction,
  replayReproduction,
} from "../../src/runtime/simulation/replay_reproduction";
import { createTestTempDirectory } from "../support/drivers/temp-directories";
const board = async () =>
  parseBoardDefinition(
    JSON.parse(
      await readFile(
        new URL("../../../configs.example/boards/awa_radiant_eclipse_12_v1.json", import.meta.url),
        "utf8",
      ),
    ),
  );
const languages = new Map<string, SimulationReport>();
const summary = (r: SimulationReport) => r.games.map(({ recordDir: _, ...row }) => row);
for (const policy of ["mixed", "conservative"] as const)
  for (const locale of ["en", "zh-CN"] as const)
    test(`Radiant restricted DTO ${policy} fixed seeds and independent strict replays/${locale}`, async () => {
      const count = policy === "mixed" ? 30 : 20;
      const report = await simulateGames(await board(), {
        locale,
        seeds: Array.from(
          { length: count },
          (_, i) => `radiant-${policy === "mixed" ? "observed" : "conservative"}-v1:${i}`,
        ),
        styles:
          policy === "conservative"
            ? ["conservative"]
            : ["active", "conservative", "competitive", "random"],
        recordRoot: await createTestTempDirectory("awa-radiant-observed-"),
        maxDays: 30,
      });
      expect(report.games).toHaveLength(count);
      expect(report.naturallyFinished).toBe(count);
      expect(report.rejects).toBe(0);
      expect(report.fallbacks).toBe(0);
      for (const branch of [
        "eclipse_swallowed.pass",
        "radiant_shelter_chosen.pass",
        "seer_checked",
      ])
        expect(report.branches[branch]).toBeGreaterThan(0);
      if (policy === "mixed")
        for (const branch of [
          "eclipse_swallowed.spend",
          "radiant_shelter_chosen.spend",
          "eclipse_native_suppressed",
          "eclipse_native_restored",
          "ability_changed",
          "wolf_self_destruct",
          "dream_death",
          "sheriff_pk_started",
          "exile_pk_started",
        ])
          expect(report.branches[branch]).toBeGreaterThan(0);
      else {
        expect(report.branches["eclipse_swallowed.spend"] ?? 0).toBe(0);
        expect(report.branches["radiant_shelter_chosen.spend"] ?? 0).toBe(0);
      }
      const replayRoot = await createTestTempDirectory("awa-radiant-observed-replay-");
      for (const game of report.games) {
        const record = await readReproduction(path.join(game.recordDir, "reproduction.json"));
        expect(record.metadata.locale).toBe(locale);
        expect(record.checkpoints.every((c) => c.complete)).toBe(true);
        expect(record.decisions.every((d) => d.outcome.kind === "action")).toBe(true);
        const replay: ReplayDocument = JSON.parse(
          await readFile(path.join(game.recordDir, "replay.json"), "utf8"),
        );
        assertReplayDocument(replay);
        expect(replay.result.decision).toEqual(game.result ?? undefined);
        expect((await replayReproduction(record, replayRoot)).snapshot).toEqual(
          record.checkpoints.at(-1)!.snapshot,
        );
        for (const type of ["eclipse_swallowed", "radiant_shelter_chosen"] as const) {
          const facts = record.events.filter((e) => e.type === type);
          expect(game.branches[type] ?? 0).toBe(facts.length);
          expect(game.branches[`${type}.spend`] ?? 0).toBe(
            facts.filter((e) => e.payload.targetId !== null).length,
          );
          expect(game.branches[`${type}.pass`] ?? 0).toBe(
            facts.filter((e) => e.payload.targetId === null).length,
          );
        }
      }
      const previous = languages.get(policy);
      if (previous) expect(summary(report)).toEqual(summary(previous));
      languages.set(policy, report);
      if (policy === "mixed" && locale === "en") {
        const repeated = await simulateGames(await board(), {
          locale,
          seeds: ["radiant-observed-v1:6"],
          recordRoot: await createTestTempDirectory("awa-radiant-observed-repeat-"),
          maxDays: 30,
        });
        expect(summary(repeated)[0]).toEqual(summary(report)[6]);
      }
    }, 180000);
