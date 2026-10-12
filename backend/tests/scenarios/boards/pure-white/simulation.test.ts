/**
 * Observed-game scenarios verify Pure White action priority and self-heal variants.
 * Input: Public policy boards, restricted robot requests and saved fixed-seed games.
 * Output and independent oracle: Manual policy/resource branch checks, natural outcomes and exact strict Tape.
 * The test never calls a billed model or rewrites expected fixture/Tape bytes.
 */
import { expect, test } from "bun:test";
import path from "node:path";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../../src/runtime/config/board_definition";
import { pureWhiteTwelveConfig } from "../../../../src/runtime/scenarios/pure_white_twelve";
import { WitchSelfHealRule } from "../../../../src/core";
import { simulateGames } from "../../../../src/runtime/simulation/simulate_games";
import {
  readReproduction,
  replayReproduction,
} from "../../../../src/runtime/simulation/replay_reproduction";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";
for (const priority of ["awa_wolf_priority_v1", "awa_good_priority_v1"] as const)
  for (const selfHeal of [WitchSelfHealRule.Disabled, WitchSelfHealRule.FirstNightOnly])
    for (const locale of ["zh-CN", "en"] as const)
      test(`pure white observed simulation ${priority}/${selfHeal}/${locale}`, async () => {
        const config = structuredClone(pureWhiteTwelveConfig);
        config.pureWhite!.eliminationPriority = priority;
        config.witch!.canSelfHeal = selfHeal;
        const board = parseBoardDefinition(boardDefinitionFromConfig("pure_white_twelve", config));
        const report = await simulateGames(board, {
          locale,
          seeds: Array.from({ length: 20 }, (_, i) => `pure-white:${i}`),
          styles: ["active", "conservative", "competitive", "random"],
          recordRoot: await createTestTempDirectory("awa-pure-white-simulation-"),
          maxDays: 20,
        });
        expect(report.games).toHaveLength(20);
        expect(report.naturallyFinished).toBe(20);
        expect(report.rejects).toBe(0);
        expect(report.fallbacks).toBe(0);
        expect(report.branches.role_inspected).toBeGreaterThan(0);
        expect(report.branches.role_inspection_skipped).toBeGreaterThan(0);
        const root = await createTestTempDirectory("awa-pure-white-replay-");
        for (const game of report.games) {
          const record = await readReproduction(path.join(game.recordDir, "reproduction.json"));
          expect((await replayReproduction(record, root)).snapshot.result).toEqual(game.result);
        }
      }, 120000);
