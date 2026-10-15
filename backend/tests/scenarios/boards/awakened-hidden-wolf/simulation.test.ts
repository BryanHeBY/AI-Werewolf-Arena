/**
 * 观察驱动的整局场景验证觉醒隐狼复制资源及激活中的具体不变量。
 * 输入为现有板子、二十个固定自身观察种子及逐局录制。
 * 字面约束包括毒库存不增、耗尽刀不恢复、查验去重、下一夜就绪及狼聊排除；逐局 Tape 结果另与原录制作一致性对照。
 * 测试不调用付费模型，也不重写预期 fixture／Tape 字节。
 */
import { fixtureNumber } from "../../../support/oracles/fixture-values";
import { expect, test } from "bun:test";
import path from "node:path";
import { writeFile } from "node:fs/promises";
import { loadBoardDefinition } from "../../../../src/app/config/load-board-definition";
import { simulateGames } from "../../../../src/app/simulation/simulate-games";
import {
  readReproduction,
  replayReproduction,
} from "../../../../src/app/simulation/replay-reproduction";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";

for (const id of ["six_player_awakened_hidden_wolf", "twelve_player_awakened_hidden_wolf"])
  test(`${id}: twenty observed seeds finish naturally, preserve copied resources and reproduce strict Tape`, async () => {
    const board = await loadBoardDefinition(
      path.resolve(import.meta.dir, "../../../../../configs.example"),
      id,
    );
    const report = await simulateGames(board, {
      seeds: Array.from({ length: 20 }, (_, i) => `awakened-random:${i}`),
      styles: ["active", "conservative", "competitive", "random"],
      recordRoot: await createTestTempDirectory("awa-awakened-seeds-"),
      maxDays: 12,
    });
    expect(report.games).toHaveLength(20);
    expect(report.naturallyFinished).toBe(20);
    expect(report.rejects).toBe(0);
    expect(report.fallbacks).toBe(0);
    expect(report.branches.awakened_mimicked).toBeGreaterThan(0);
    expect(report.branches.awakened_ready).toBeGreaterThan(0);
    expect(report.branches.awakened_inherited).toBeGreaterThan(0);
    expect(report.branches.awakened_mimic_skipped).toBeGreaterThan(0);
    expect(report.branches.awakened_poison_used).toBeGreaterThan(0);
    await writeFile(
      `/tmp/awa-p7-${id}-seed-branches.json`,
      JSON.stringify({ naturallyFinished: report.naturallyFinished, branches: report.branches }),
    );
    const output = await createTestTempDirectory("awa-awakened-seed-replayed-");
    for (const game of report.games) {
      const record = await readReproduction(path.join(game.recordDir, "reproduction.json")),
        actor = record.metadata.players.find(
          (player) => player.role === "awakened_hidden_wolf",
        )!.id;
      let poison = 1,
        extra = "available";
      const checked = new Set<number>();
      for (const checkpoint of record.checkpoints) {
        const state = checkpoint.players.find((player) => player.id === actor)!.privateState
            .awakened_hidden_wolf as any,
          learned = state.learned;
        if (learned?.skill.kind === "poison") {
          expect(learned.skill.remaining).toBeLessThanOrEqual(poison);
          poison = learned.skill.remaining;
        }
        if (learned?.skill.kind === "wolf") {
          if (extra === "spent") expect(learned.skill.extraKnife).toBe("spent");
          extra = learned.skill.extraKnife;
        }
      }
      for (const event of record.events) {
        if (event.type === "role_inspected" && event.payload.actorId === actor) {
          expect(checked.has(fixtureNumber(event.payload.targetId))).toBe(false);
          checked.add(fixtureNumber(event.payload.targetId));
        }
        if (["wolf_discussion", "wolf_discussion_ended", "wolf_self_destruct"].includes(event.type))
          expect(event.payload.actorId ?? event.payload.wolfId).not.toBe(actor);
        if (event.type === "awakened_ready")
          expect(event.payload.activeFromNight).toBe(
            fixtureNumber(event.payload.activationNight) + 1,
          );
      }
      expect((await replayReproduction(record, output)).snapshot.result).toEqual(game.result);
    }
  }, 30000);
