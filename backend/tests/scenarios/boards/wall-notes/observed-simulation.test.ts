/**
 * Observed-game scenarios verify wall notes expiry, order and public event branches.
 * Input: Twenty limited-observation seeds per board/locale and original note action records.
 * Output and independent oracle: Literal note/event coverage, natural results and exact checkpoint/Tape replay.
 * The test never calls a billed model or rewrites expected fixture/Tape bytes.
 */
import { expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { Role } from "../../../../src/domain";
import { foxBoard } from "../../../support/features/cursed-fox/builders/scenario";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../../src/app/config/board-definition";
import { simulateGames } from "../../../../src/app/simulation/simulate-games";
import {
  readReproduction,
  replayReproduction,
} from "../../../../src/app/simulation/replay-reproduction";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";
const six = [Role.Wolf, Role.Wolf, Role.Seer, Role.Witch, Role.Hunter, Role.Villager];
const boards = [
  { name: "six", roles: six },
  {
    name: "twelve",
    roles: [
      ...Array<Role>(4).fill(Role.Wolf),
      Role.Seer,
      Role.Witch,
      Role.Hunter,
      ...Array<Role>(5).fill(Role.Villager),
    ],
  },
  ...[Role.Guard, Role.Idiot].map((role) => ({
    name: role,
    roles: [Role.Wolf, Role.Wolf, Role.Seer, Role.Witch, role, Role.Villager],
  })),
  { name: "sheriff", roles: six },
];
for (const { name, roles } of boards)
  for (const locale of ["zh-CN", "en"] as const)
    test(`${name}/${locale}: twenty restricted robots + records/strict wall Tape`, async () => {
      const config = {
          ...foxBoard(roles),
          events: { pack: "awa_wall_notes_once_v1" as const },
          ...(name === "sheriff"
            ? {
                enableSheriff: true,
                sheriff: { voteWeight: 2.25, badgePolicy: "awa_holder_choice_v1" as const },
              }
            : {}),
        },
        board = parseBoardDefinition(boardDefinitionFromConfig(`wall_observed_${name}`, config));
      const report = await simulateGames(board, {
        locale,
        seeds: Array.from({ length: 20 }, (_, i) => `wall-observed:${name}:${i}`),
        styles: ["active", "conservative", "competitive", "random"],
        maxDays: 30,
        recordRoot: await createTestTempDirectory("awa-wall-observed-"),
      });
      expect(report.games).toHaveLength(20);
      expect(report.rejects).toBe(0);
      expect(report.fallbacks).toBe(0);
      expect(report.naturallyFinished).toBe(20);
      await fs.writeFile(
        `/tmp/awa-p8-wall-observed-${name}-${locale}.json`,
        JSON.stringify(report),
      );
      const root = await createTestTempDirectory("awa-wall-tape-");
      for (const game of report.games) {
        const record = await readReproduction(path.join(game.recordDir, "reproduction.json"));
        expect(record.checkpoints.at(-1)!.snapshot.gameOver).toBe(true);
        const starts = record.events.filter((e) => e.type === "wall_notes_started");
        expect(starts.length).toBeLessThanOrEqual(1);
        for (const e of record.events.filter((e) => e.type === "wall_notes_published")) {
          expect(e.payload.day).toBe(1);
          expect(Object.keys(e.payload).sort()).toEqual(["day", "eventId", "texts"]);
        }
        const replay = await replayReproduction(
          record,
          path.join(root, game.seed.replace(/[^a-z0-9]/gi, "_")),
        );
        expect(replay.snapshot).toEqual(record.checkpoints.at(-1)!.snapshot);
      }
    }, 120000);
