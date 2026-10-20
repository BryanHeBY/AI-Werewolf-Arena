/**
 * 负责贵族狼／秘密身体政策与明确学习状态的观察对局场景测试。
 * 输入为受 DTO 限制机器人、固定种子、政策／风格／语言变体及捕获记录；输出由独立政策、资源、死亡成员核对与精确严格复盘检查。
 * 不调用计费模型、不重生 fixture／Tape，实际归档入口解包新封装。
 */
import { readReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { assertReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { nobleSecretBodyTwelveConfig } from "../../../../src/rulesets/presets/noble-secret-body-twelve";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../../src/app/config/board-definition";
import {
  simulateGames,
  type SimulationReport,
} from "../../../../src/app/simulation/simulate-games";
import {
  readReproduction,
  replayReproduction,
} from "../../../../src/app/simulation/replay-reproduction";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";
const languages = new Map<string, SimulationReport>(),
  summary = (r: SimulationReport) => r.games.map(({ recordDir: _, ...g }) => g);
for (const wolf of ["standard", "no_blast_no_self_knife"] as const)
  for (const repeat of ["awa_nonconsecutive_nights_v1", "awa_repeat_v1"] as const)
    for (const style of ["mixed", "conservative"] as const)
      for (const locale of ["en", "zh-CN"] as const)
        test(`Noble observed DTO ${wolf}/${repeat}/${style}/${locale}`, async () => {
          const id = `noble-observed:${wolf}:${repeat}:${style}`,
            count = style === "mixed" ? 12 : 8,
            board = parseBoardDefinition(
              boardDefinitionFromConfig(
                "awa_noble_secret_body_12_v1",
                nobleSecretBodyTwelveConfig(wolf, repeat),
              ),
            ),
            report = await simulateGames(board, {
              locale,
              seeds: Array.from({ length: count }, (_, i) => `${id}:${i}`),
              styles:
                style === "mixed"
                  ? ["active", "conservative", "competitive", "random"]
                  : ["conservative"],
              recordRoot: await createTestTempDirectory("awa-noble-observed-"),
              maxDays: 30,
            });
          expect(report.naturallyFinished).toBe(count);
          expect(report.rejects).toBe(0);
          expect(report.fallbacks).toBe(0);
          expect(report.branches.secret_body_chosen).toBeGreaterThan(0);
          expect(report.branches.seer_checked).toBeGreaterThan(0);
          if (style === "conservative") {
            expect(report.branches["secret_body_chosen.select"] ?? 0).toBe(0);
            expect(report.branches["noble_servant_chosen.select"] ?? 0).toBe(0);
          } else {
            expect(report.branches["secret_body_chosen.select"] ?? 0).toBeGreaterThan(0);
            expect(report.branches["noble_servant_chosen.select"] ?? 0).toBeGreaterThan(0);
            expect(report.branches.secret_body_blocked ?? 0).toBeGreaterThan(0);
            expect(report.branches.noble_contract_closed ?? 0).toBeGreaterThan(0);
          }
          const replayRoot = await createTestTempDirectory("awa-noble-observed-tape-");
          for (const game of report.games) {
            const record = await readReproduction(path.join(game.recordDir, "reproduction.json"));
            expect(record.metadata.locale).toBe(locale);
            expect(record.checkpoints.every((c) => c.complete)).toBe(true);
            expect(record.decisions.every((d) => d.outcome.kind === "action")).toBe(true);
            const replay = readReplayDocument(
              JSON.parse(await readFile(path.join(game.recordDir, "replay.json"), "utf8")),
            );
            assertReplayDocument(replay);
            expect((await replayReproduction(record, replayRoot)).snapshot).toEqual(
              record.checkpoints.at(-1)!.snapshot,
            );
            for (const type of ["noble_servant_chosen", "secret_body_chosen"] as const) {
              const facts = record.events.filter((e) => e.type === type);
              expect(game.branches[type] ?? 0).toBe(facts.length);
              expect(game.branches[`${type}.select`] ?? 0).toBe(
                facts.filter((e) => e.payload.targetId !== null).length,
              );
              expect(game.branches[`${type}.pass`] ?? 0).toBe(
                facts.filter((e) => e.payload.targetId === null).length,
              );
            }
            if (wolf === "no_blast_no_self_knife") {
              const noble = record.metadata.players.find((p) => p.role === "night_noble")!.id;
              expect(
                record.decisions.some(
                  (d) =>
                    d.actorId === noble && ["on_pre_election", "on_pre_vote"].includes(d.stage),
                ),
              ).toBe(false);
              expect(
                record.events.some(
                  (e) => e.type === "noble_body_knife_committed" && e.payload.targetId === noble,
                ),
              ).toBe(false);
            }
          }
          const previous = languages.get(id);
          if (previous) expect(summary(report)).toEqual(summary(previous));
          languages.set(id, report);
        }, 180000);
