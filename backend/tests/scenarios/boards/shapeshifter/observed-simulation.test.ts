/**
 * 观察驱动的整局场景运行千面人原开局牌及严格录制请求。
 * 输入为每个板子／语言下二十个受限机器人种子及固定开局输入。
 * 字面预期为自然完成、无拒绝／回退、起始决定至多一次及开局完成；逐局重放与原末 checkpoint 对照，不将该次数上限说成每局选择覆盖。
 * 测试不调用付费模型，也不重写预期 fixture／Tape 字节。
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
const six = [Role.Shapeshifter, Role.Wolf, Role.Wolf, Role.Seer, Role.Witch, Role.Hunter];
const boards = [
  { name: "six", roles: six },
  {
    name: "twelve",
    roles: [
      ...Array<Role>(4).fill(Role.Wolf),
      Role.Seer,
      Role.Witch,
      Role.Hunter,
      Role.Shapeshifter,
      ...Array<Role>(4).fill(Role.Villager),
    ],
  },
  ...[Role.Guard, Role.Idiot].map((role) => ({
    name: role,
    roles: [Role.Shapeshifter, Role.Wolf, Role.Wolf, Role.Seer, Role.Witch, role],
  })),
  { name: "sheriff", roles: six },
];
for (const { name, roles } of boards)
  for (const locale of ["zh-CN", "en"] as const)
    test(`${name}/${locale}: twenty restricted robots + records/strict shapeshifter Tape`, async () => {
      const config = {
          ...foxBoard(roles),
          ...(name === "sheriff"
            ? {
                enableSheriff: true,
                sheriff: { voteWeight: 2.25, badgePolicy: "awa_holder_choice_v1" as const },
              }
            : {}),
        },
        board = parseBoardDefinition(
          boardDefinitionFromConfig(`shapeshifter_observed_${name}`, config),
        );
      const report = await simulateGames(board, {
        locale,
        seeds: Array.from({ length: 20 }, (_, i) => `shapeshifter-observed:${name}:${i}`),
        styles: ["active", "conservative", "competitive", "random"],
        maxDays: 30,
        recordRoot: await createTestTempDirectory("awa-shapeshifter-observed-"),
      });
      expect(report.games).toHaveLength(20);
      expect(report.rejects).toBe(0);
      expect(report.fallbacks).toBe(0);
      expect(report.naturallyFinished).toBe(20);
      await fs.writeFile(
        `/tmp/awa-p9-shapeshifter-observed-${name}-${locale}.json`,
        JSON.stringify(report),
      );
      const root = await createTestTempDirectory("awa-shapeshifter-tape-");
      for (const game of report.games) {
        const record = await readReproduction(path.join(game.recordDir, "reproduction.json"));
        expect(record.checkpoints.at(-1)!.snapshot.gameOver).toBe(true);
        const starts = record.decisions.filter((e) => e.stage === "shapeshifter");
        expect(starts.length).toBeLessThanOrEqual(1);
        expect(record.checkpoints.at(-1)!.shapeshifterSetup?.status).toBe("complete");
        const replay = await replayReproduction(
          record,
          path.join(root, game.seed.replace(/[^a-z0-9]/gi, "_")),
        );
        expect(replay.snapshot).toEqual(record.checkpoints.at(-1)!.snapshot);
      }
    }, 120000);
