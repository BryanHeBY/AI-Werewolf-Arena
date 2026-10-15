/**
 * 负责雾鸦政策时点与已发表知识的观察对局场景测试。
 * 输入为显式政策板子、受 DTO 限制机器人及固定种子归档；输出由独立资源、知识、终局核对与原记录的严格 replay 检查。
 * 不调用计费模型、不改预期 fixture／Tape，新封装只在真实文件入口解包。
 */
import { readReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { assertReplayDocument, type ReplayDocument } from "@ai-werewolf-arena/replay-contract";
import {
  simulateGames,
  type SimulationReport,
} from "../../../../src/app/simulation/simulate-games";
import {
  readReproduction,
  replayReproduction,
} from "../../../../src/app/simulation/replay-reproduction";
import { mistBoard } from "../../../support/features/mist-raven/builders/board";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";

const languages = new Map<string, SimulationReport>();
for (const policy of ["mixed", "conservative"] as const)
  for (const locale of ["en", "zh-CN"] as const)
    test(`Mist restricted DTO ${policy} fixed seeds and independent strict replays/${locale}`, async () => {
      const count = policy === "mixed" ? 30 : 20;
      const report = await simulateGames(await mistBoard(), {
        locale,
        seeds: Array.from({ length: count }, (_, i) =>
          policy === "mixed" ? `mist-raven-observed-v1:${i}` : `mist-raven-conservative-v1:${i}`,
        ),
        styles:
          policy === "conservative"
            ? ["conservative"]
            : ["active", "conservative", "competitive", "random"],
        recordRoot: await createTestTempDirectory("awa-mist-observed-"),
        maxDays: 30,
      });
      expect(report.games).toHaveLength(count);
      expect(report.naturallyFinished).toBe(count);
      expect(report.rejects).toBe(0);
      expect(report.fallbacks).toBe(0);
      for (const branch of [
        "alchemist_mist_chosen.spend",
        "alchemist_mist_chosen.pass",
        "alchemist_mist_chosen.later_spend",
        "seer_checked",
        "raven_unsealed",
      ])
        expect(report.branches[branch]).toBeGreaterThan(0);
      if (policy === "mixed") {
        for (const branch of [
          "alchemist_snake_chosen.spend",
          "alchemist_snake_chosen.pass",
          "alchemist_snake_chosen.later_spend",
          "raven_knife_chosen.spend",
          "raven_knife_chosen.pass",
          "wolf_self_destruct",
        ])
          expect(report.branches[branch]).toBeGreaterThan(0);
      } else {
        expect(report.branches.mist_knife_drawn).toBe(
          report.branches["alchemist_mist_chosen.spend"],
        );
        expect(report.branches["alchemist_mist_chosen.pass"]).toBe(count);
        expect(report.branches["alchemist_snake_chosen.spend"] ?? 0).toBe(0);
        expect(report.branches["raven_knife_chosen.spend"] ?? 0).toBe(0);
      }
      const replayRoot = await createTestTempDirectory("awa-mist-observed-replay-");
      for (const game of report.games) {
        const record = await readReproduction(path.join(game.recordDir, "reproduction.json"));
        expect(record.metadata.locale).toBe(locale);
        expect(record.checkpoints.every((c) => c.complete)).toBe(true);
        expect(record.decisions.every((d) => d.outcome.kind === "action")).toBe(true);
        const replay: ReplayDocument = readReplayDocument(
          JSON.parse(await readFile(path.join(game.recordDir, "replay.json"), "utf8")),
        );
        assertReplayDocument(replay);
        expect(replay.result.decision).toEqual(game.result ?? undefined);
        const cp = record.checkpoints.at(-1)!;
        expect((await replayReproduction(record, replayRoot)).snapshot).toEqual(cp.snapshot);
        for (const [type, field] of [
          ["alchemist_mist_chosen", "targetIds"],
          ["alchemist_snake_chosen", "targetId"],
          ["raven_knife_chosen", "targetId"],
        ] as const) {
          const facts = record.events.filter((e) => e.type === type);
          expect(game.branches[type] ?? 0).toBe(facts.length);
          expect(game.branches[`${type}.spend`] ?? 0).toBe(
            facts.filter((e) => e.payload[field] !== null).length,
          );
          expect(game.branches[`${type}.pass`] ?? 0).toBe(
            facts.filter((e) => e.payload[field] === null).length,
          );
          expect(game.branches[`${type}.later_spend`] ?? 0).toBe(
            facts.filter((e) => e.payload[field] !== null && Number(e.payload.day) > 1).length,
          );
        }
        if (policy === "conservative") {
          for (const d of record.decisions.filter((d) => d.stage === "wolf_vote"))
            expect(d.outcome).toEqual({
              kind: "action",
              action: { name: "kill_vote", args: { target_id: null, abstain: true } },
            });
        }
      }
      const summary = (r: SimulationReport) => r.games.map(({ recordDir: _, ...row }) => row);
      const previous = languages.get(policy);
      if (previous) expect(summary(report)).toEqual(summary(previous));
      languages.set(policy, report);
      if (policy === "mixed" && locale === "en") {
        const repeated = await simulateGames(await mistBoard(), {
          locale,
          seeds: ["mist-raven-observed-v1:6"],
          recordRoot: await createTestTempDirectory("awa-mist-observed-repeat-"),
          maxDays: 30,
        });
        expect(summary(repeated)[0]).toEqual(summary(report)[6]);
      }
    }, 180000);
