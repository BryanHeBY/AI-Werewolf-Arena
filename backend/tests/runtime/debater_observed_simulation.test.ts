/**
 * Observed-game scenarios verify Debater challenges, ballots and natural termination.
 * Input: Declared boards, restricted robot requests and twenty per-game seed records.
 * Output and independent oracle: Literal debate action coverage, no repaired finish and exact checkpoint/Tape reproduction.
 * The test never calls a billed model or rewrites expected fixture/Tape bytes.
 */
import { expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { Role, KnightDuelWindow } from "../../src/core";
import { foxBoard } from "../support/cursed_fox_scenarios";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../src/runtime/config/board_definition";
import { simulateGames } from "../../src/runtime/simulation/simulate_games";
import {
  readReproduction,
  replayReproduction,
} from "../../src/runtime/simulation/replay_reproduction";
import { createTestTempDirectory } from "../support/drivers/temp-directories";
const six = [Role.Debater, Role.Wolf, Role.Hunter, Role.Seer, Role.Witch, Role.Villager];
const boards = [
  { name: "six", roles: six },
  {
    name: "twelve",
    roles: [
      Role.Debater,
      Role.Seer,
      Role.Witch,
      Role.Hunter,
      ...Array<Role>(4).fill(Role.Wolf),
      ...Array<Role>(4).fill(Role.Villager),
    ],
  },
  ...[Role.Guard, Role.Idiot, Role.WolfKing, Role.WhiteWolfKing, Role.Knight].map((role) => ({
    name: role,
    roles: [Role.Debater, Role.Wolf, Role.Villager, Role.Villager, Role.Hunter, role],
  })),
  { name: "sheriff", roles: six },
];
for (const { name, roles } of boards)
  for (const locale of ["zh-CN", "en"] as const)
    test(`${name}/${locale}: twenty restricted robots, natural finish, per-game recording and strict Tape`, async () => {
      const config = {
          ...foxBoard(roles),
          ...(name === "sheriff"
            ? {
                enableSheriff: true,
                sheriff: { voteWeight: 2.25, badgePolicy: "awa_holder_choice_v1" as const },
              }
            : {}),
          ...(name === Role.Knight
            ? { knight: { enabledWindows: [KnightDuelWindow.BetweenSpeeches] } }
            : {}),
        },
        board = parseBoardDefinition(boardDefinitionFromConfig(`debater_observed_${name}`, config)),
        report = await simulateGames(board, {
          locale,
          seeds: Array.from({ length: 20 }, (_, i) => `debater-observed:${name}:${i}`),
          styles: ["active", "conservative", "competitive", "random"],
          maxDays: 30,
          recordRoot: await createTestTempDirectory("awa-debater-observed-"),
        });
      expect(report.games).toHaveLength(20);
      expect(report.rejects).toBe(0);
      expect(report.fallbacks).toBe(0);
      expect(report.naturallyFinished).toBe(20);
      await fs.writeFile(
        `/tmp/awa-p8-debater-observed-${name}-${locale}.json`,
        JSON.stringify(report),
      );
      const root = await createTestTempDirectory("awa-debater-observed-tape-");
      for (const game of report.games) {
        const record = await readReproduction(path.join(game.recordDir, "reproduction.json"));
        expect(record.checkpoints.at(-1)!.snapshot.gameOver).toBe(true);
        const accepted = record.events.filter((e) => e.type === "debater_revealed");
        expect(accepted.length).toBeLessThanOrEqual(1);
        for (const event of record.events.filter((e) => e.type === "debate_resolved")) {
          const p = event.payload;
          expect(p.success).toBe((p.supports as number) > (p.eligibleCount as number) / 2);
          expect((p.supports as number) + (p.rejects as number) + (p.abstentions as number)).toBe(
            p.eligibleCount as number,
          );
          expect(p.blockedId).toBe(p.success ? p.targetId : p.actorId);
          expect(
            record.decisions.some(
              (d) =>
                ["voting", "exile_pk_vote"].includes(d.stage) &&
                d.day === p.day &&
                d.actorId === p.blockedId,
            ),
          ).toBe(false);
        }
        const replay = await replayReproduction(
          record,
          path.join(root, game.seed.replace(/[^a-z0-9]/gi, "_")),
        );
        expect(replay.snapshot).toEqual(record.checkpoints.at(-1)!.snapshot);
      }
    }, 120000);
