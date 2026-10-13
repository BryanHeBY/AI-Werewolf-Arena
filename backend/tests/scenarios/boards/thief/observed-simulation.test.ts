/**
 * Observed-game scenarios verify Thief optional choice and original initial-role setup.
 * Input: Twenty restricted robot seeds per board/locale with preserved action records.
 * Output and independent oracle: Literal setup choices, no repaired terminal result and exact strict reproduction.
 * The test never calls a billed model or rewrites expected fixture/Tape bytes.
 */
import { expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { Role } from "../../../../src/core";
import { foxBoard } from "../../../support/features/cursed-fox/builders/scenario";
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
const six = [Role.Thief, Role.Wolf, Role.Wolf, Role.Seer, Role.Witch, Role.Hunter];
const boards = [
  { name: "six", roles: six },
  {
    name: "twelve",
    roles: [
      ...Array<Role>(4).fill(Role.Wolf),
      Role.Seer,
      Role.Witch,
      Role.Hunter,
      Role.Thief,
      ...Array<Role>(4).fill(Role.Villager),
    ],
  },
  ...[Role.Guard, Role.Idiot].map((role) => ({
    name: role,
    roles: [Role.Thief, Role.Wolf, Role.Wolf, Role.Seer, Role.Witch, role],
  })),
  { name: "sheriff", roles: six },
];
for (const { name, roles } of boards)
  for (const locale of ["zh-CN", "en"] as const)
    test(`${name}/${locale}: twenty restricted robots + records/strict thief Tape`, async () => {
      const config = {
          ...foxBoard(roles),
          ...(name === "sheriff"
            ? {
                enableSheriff: true,
                sheriff: { voteWeight: 2.25, badgePolicy: "awa_holder_choice_v1" as const },
              }
            : {}),
        },
        board = parseBoardDefinition(boardDefinitionFromConfig(`thief_observed_${name}`, config));
      const report = await simulateGames(board, {
        locale,
        seeds: Array.from({ length: 20 }, (_, i) => `thief-observed:${name}:${i}`),
        styles: ["active", "conservative", "competitive", "random"],
        maxDays: 30,
        recordRoot: await createTestTempDirectory("awa-thief-observed-"),
      });
      expect(report.games).toHaveLength(20);
      expect(report.rejects).toBe(0);
      expect(report.fallbacks).toBe(0);
      expect(report.naturallyFinished).toBe(20);
      await fs.writeFile(
        `/tmp/awa-p8-thief-observed-${name}-${locale}.json`,
        JSON.stringify(report),
      );
      const root = await createTestTempDirectory("awa-thief-tape-");
      for (const game of report.games) {
        const record = await readReproduction(path.join(game.recordDir, "reproduction.json"));
        expect(record.checkpoints.at(-1)!.snapshot.gameOver).toBe(true);
        const starts = record.decisions.filter((e) => e.stage === "thief");
        expect(starts.length).toBeLessThanOrEqual(1);
        expect(record.checkpoints.at(-1)!.thiefSetup?.status).toBe("complete");
        const replay = await replayReproduction(
          record,
          path.join(root, game.seed.replace(/[^a-z0-9]/gi, "_")),
        );
        expect(replay.snapshot).toEqual(record.checkpoints.at(-1)!.snapshot);
      }
    }, 120000);
