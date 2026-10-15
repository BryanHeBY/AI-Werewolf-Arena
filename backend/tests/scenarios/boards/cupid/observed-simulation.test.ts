/**
 * 观察驱动的整局场景验证丘比特策略分支及关系胜利成员。
 * 输入为每种策略／语言下二十个受限观察种子，各局单独录制。
 * 配对／互认次数及手写关系／成员公式构成字面约束；完整对局重放结果另与原录制作一致性对照。
 * 测试不调用付费模型，也不重写预期 fixture／Tape 字节。
 */
import { expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { Camp, Role } from "../../../../src/domain";
import {
  cupidBoard,
  CUPID_CASES,
  cupidScenario,
} from "../../../support/features/cupid/builders/scenario";
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
const boards = [
  ...CUPID_CASES.map((name) => ({ name, board: cupidScenario(name).board })),
  ...(["netease_2017_cupid_follows_lovers_v1", "lui_meme_lovers_only_v1"] as const).map(
    (policy) => ({
      name: `twelve_${policy}`,
      board: parseBoardDefinition(
        boardDefinitionFromConfig(
          `cupid_twelve_${policy}`,
          cupidBoard(
            [
              Role.Cupid,
              Role.Wolf,
              Role.Wolf,
              Role.Wolf,
              Role.Hunter,
              Role.Seer,
              Role.Witch,
              Role.Guard,
              Role.Villager,
              Role.Villager,
              Role.Villager,
              Role.Idiot,
            ],
            policy,
          ),
        ),
      ),
    }),
  ),
];
for (const { name, board } of boards)
  for (const locale of ["zh-CN", "en"] as const)
    test(`${name}/${locale}: twenty restricted-observation robot games record choices/branches and strictly reproduce manual member oracles`, async () => {
      const report = await simulateGames(board, {
        locale,
        seeds: Array.from({ length: 20 }, (_, i) => `cupid-observed:${name}:${i}`),
        styles: ["active", "conservative", "competitive", "random"],
        maxDays: 20,
        recordRoot: await createTestTempDirectory("awa-cupid-observed-"),
      });
      expect(report.games).toHaveLength(20);
      expect(report.rejects).toBe(0);
      expect(report.fallbacks).toBe(0);
      expect(report.branches.cupid_lovers_chosen).toBe(20);
      expect(report.branches.lover_recognized).toBe(40);
      expect(report.naturallyFinished).toBeGreaterThan(0);
      await fs.writeFile(
        `/tmp/awa-p8-cupid-observed-branches-${name}-${locale}.json`,
        JSON.stringify(report),
      );
      const replayRoot = await createTestTempDirectory("awa-cupid-observed-tape-");
      for (const game of report.games) {
        const record = await readReproduction(path.join(game.recordDir, "reproduction.json")),
          relation = record.events.find(
            (event) => event.type === "cupid_relation_resolved",
          )!.payload,
          final = record.checkpoints.at(-1)!,
          outcome = final.snapshot.result!.outcome;
        expect(final.snapshot.gameOver).toBe(true);
        const pair = relation.pairIds as number[],
          camps = relation.pairCamps as string[],
          cupid = relation.actorId as number,
          net = relation.policy === "netease_2017_cupid_follows_lovers_v1",
          mixed = camps[0] !== camps[1];
        const members = [...new Set([...pair, ...(net ? [cupid] : [])])].sort((a, b) => a - b),
          alive = final.players.filter((player) => player.alive);
        expect(alive.some((p) => p.id === pair[0])).toBe(alive.some((p) => p.id === pair[1]));
        if (outcome.kind === "victory") {
          if (outcome.primary.kind === "relationship") {
            expect(mixed).toBe(true);
            expect(pair.every((id) => alive.some((p) => p.id === id))).toBe(true);
            expect(alive.every((p) => members.includes(p.id))).toBe(true);
            expect(outcome.winningPlayerIds).toEqual(members);
          } else {
            const wolves = alive.filter((p) => p.camp === Camp.Wolf).length,
              good = alive.filter(
                (p) =>
                  p.camp === Camp.Good &&
                  !(net && p.id === cupid && (mixed || camps[0] === Camp.Wolf)),
              ).length;
            const winner = wolves === 0 ? Camp.Good : good === 0 ? Camp.Wolf : null;
            expect(final.snapshot.result!.winner).toBe(winner);
            expect(winner).not.toBeNull();
            const expected = final.players
              .filter((p) => {
                if (members.includes(p.id)) return !mixed && camps[0] === winner;
                return p.camp === winner;
              })
              .map((p) => p.id);
            expect(outcome.winningPlayerIds).toEqual(expected);
          }
        }
        expect((await replayReproduction(record, replayRoot)).snapshot.result).toEqual(game.result);
      }
    }, 60000);
