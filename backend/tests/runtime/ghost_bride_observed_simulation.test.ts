import { expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { ghostBrideBoard } from "../support/ghost_bride_scenarios";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../src/runtime/config/board_definition";
import { simulateGames } from "../../src/runtime/simulation/simulate_games";
import {
  readReproduction,
  replayReproduction,
} from "../../src/runtime/simulation/replay_reproduction";
import { createTestTempDirectory } from "../support/temp_directory";
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
    // A blind Hunter can legally attempt a target whose Night death is still private.
    // Preserve that rejection and verify it exactly; never reveal hidden life to the bot.
    expect(report.rejects).toBe(1);
    const rejected = report.games.filter((g) => g.rejects);
    expect(rejected.map((g) => [g.seed, g.rejects])).toEqual([["ghost-observed:43", 1]]);
    const operations = JSON.parse(
      await fs.readFile(path.join(rejected[0]!.recordDir, "logic_ops.json"), "utf8"),
    );
    expect(operations.ops.filter((o: { status: string }) => o.status === "rejected")).toMatchObject(
      [
        {
          op: "validate_tool_call",
          input: { tool: "shoot", args: { target_id: 5 } },
          reason: "shoot_target",
        },
      ],
    );
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
