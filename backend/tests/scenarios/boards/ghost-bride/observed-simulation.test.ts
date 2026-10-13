/**
 * Observed-game scenarios verify Ghost Bride full three-faction games under limited observations.
 * Input: One hundred fixed robot seeds per locale and captured per-game archives.
 * Output and independent oracle: Natural finish, explicit relationship/membership checks and strict replay of every record.
 * The test never calls a billed model or rewrites expected fixture/Tape bytes.
 */
import { expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { ghostBrideBoard } from "../../../support/features/ghost-bride/builders/scenario";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../../src/runtime/config/board_definition";
import { simulateGames } from "../../../../src/runtime/simulation/simulate_games";
import {
  readReproduction,
  replayReproduction,
} from "../../../../src/runtime/simulation/replay_reproduction";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";
for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: one hundred restricted Ghost Bride robots each record and pass strict Tape`, async () => {
    const board = parseBoardDefinition(
      boardDefinitionFromConfig("ghost_bride_observed", ghostBrideBoard()),
    );
    const report = await simulateGames(board, {
      locale,
      seeds: Array.from({ length: 100 }, (_, i) => `ghost-observed:${i}`),
      styles: ["active", "conservative", "competitive", "random"],
      maxDays: 30,
      recordRoot: await createTestTempDirectory("awa-ghost-observed-"),
    });
    await fs.writeFile(`/tmp/awa-p9-ghost-bride-observed-${locale}.json`, JSON.stringify(report));
    for (const game of report.games.filter((g) => g.rejects || g.fallbacks))
      await fs.writeFile(
        `/tmp/awa-p9-ghost-bride-reject-${locale}-${game.seed.replace(/[^a-z0-9]/gi, "_")}.json`,
        await fs.readFile(path.join(game.recordDir, "logic_ops.json")),
      );
    expect(report.games).toHaveLength(100);
    // The private per-actor shooting candidate list excludes co-night deaths without exposing roles or causes.
    expect(report.rejects).toBe(0);
    expect(report.games.filter((game) => game.rejects)).toEqual([]);
    expect(report.fallbacks).toBe(0);
    expect(report.naturallyFinished).toBe(100);
    await fs.writeFile(`/tmp/awa-p9-ghost-bride-observed-${locale}.json`, JSON.stringify(report));
    const output = await createTestTempDirectory("awa-ghost-observed-tape-");
    for (const game of report.games) {
      const record = await readReproduction(path.join(game.recordDir, "reproduction.json"));
      expect(record.checkpoints.at(-1)!.ghostBrideSetup?.status).toBe("complete");
      expect(
        (await replayReproduction(record, path.join(output, game.seed.replace(/[^a-z0-9]/gi, "_"))))
          .snapshot,
      ).toEqual(record.checkpoints.at(-1)!.snapshot);
    }
  }, 180000);
