/**
 * Observed-game scenarios verify Evil Knight shot/self-heal policy branches.
 * Input: Public policy variants, limited observations and fixed seed recordings.
 * Output and independent oracle: Declared immunity/bypass outcomes, natural finish and exact per-game Tape.
 * The test never calls a billed model or rewrites expected fixture/Tape bytes.
 */
import { expect, test } from "bun:test";
import path from "node:path";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../../src/runtime/config/board_definition";
import { evilKnightTwelveConfig } from "../../../../src/runtime/scenarios/evil_knight_twelve";
import { WitchSelfHealRule } from "../../../../src/domain";
import { simulateGames } from "../../../../src/runtime/simulation/simulate_games";
import {
  readReproduction,
  replayReproduction,
} from "../../../../src/runtime/simulation/replay_reproduction";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";
for (const shotPolicy of ["night_shot_immune", "hunter_shot_bypasses"] as const)
  for (const selfHeal of [WitchSelfHealRule.Disabled, WitchSelfHealRule.FirstNightOnly])
    for (const locale of ["zh-CN", "en"] as const)
      test(`evil knight observed simulation ${shotPolicy}/${selfHeal}/${locale}`, async () => {
        const config = structuredClone(evilKnightTwelveConfig);
        config.evilKnight!.shotPolicy = shotPolicy;
        config.witch!.canSelfHeal = selfHeal;
        const board = parseBoardDefinition(boardDefinitionFromConfig("evil_knight_twelve", config));
        const report = await simulateGames(board, {
          locale,
          seeds: Array.from({ length: 20 }, (_, i) => `evil-knight:${i}`),
          styles: ["active", "conservative", "competitive", "random"],
          recordRoot: await createTestTempDirectory("awa-evil-knight-simulation-"),
          maxDays: 20,
        });
        expect(report.games).toHaveLength(20);
        expect(report.naturallyFinished).toBe(20);
        expect(report.rejects).toBe(0);
        expect(report.fallbacks).toBe(0);
        expect(report.branches.seer_checked).toBeGreaterThan(0);
        const root = await createTestTempDirectory("awa-evil-knight-replay-");
        for (const game of report.games) {
          const record = await readReproduction(path.join(game.recordDir, "reproduction.json"));
          expect((await replayReproduction(record, root)).snapshot.result).toEqual(game.result);
        }
      }, 120000);
