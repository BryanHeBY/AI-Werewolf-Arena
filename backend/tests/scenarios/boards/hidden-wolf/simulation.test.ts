/**
 * 观察驱动的整局场景验证隐狼没有狼聊时的激活及后续刀权。
 * 输入为声明的策略板子、固定受限观察种子及记录。
 * 字面约束为未继承初态、伪装开局计数、实际继承狼刀及狼聊排除；精确行动重放结果另与原录制作一致性对照。
 * 测试不调用付费模型，也不重写预期 fixture／Tape 字节。
 */
import { expect, test } from "bun:test";
import { loadBoardDefinition } from "../../../../src/app/config/load-board-definition";
import { simulateGames } from "../../../../src/app/simulation/simulate-games";
import {
  readReproduction,
  replayReproduction,
} from "../../../../src/app/simulation/replay-reproduction";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";
import path from "node:path";
for (const id of ["six_player_hidden_wolf", "twelve_player_hidden_wolf"] as const)
  test(`${id}: restricted-observation seeds inherit real knives without pack chat and every complete game strictly replays`, async () => {
    // 十二人全主动风格的脚本会在继承前使狼方获胜；现有
    // 种子 0–19 的四种风格混合用于覆盖真实继承及后续狼刀。
    const board = await loadBoardDefinition(
        path.resolve(import.meta.dir, "../../../../../configs.example"),
        id,
      ),
      report = await simulateGames(board, {
        seeds: Array.from({ length: 20 }, (_, i) => `hidden-random:${i}`),
        styles: id.startsWith("twelve")
          ? ["active", "conservative", "competitive", "random"]
          : ["active"],
        recordRoot: await createTestTempDirectory("awa-hidden-random-"),
        maxDays: 12,
      });
    expect(report.games).toHaveLength(20);
    expect(report.rejects).toBe(0);
    expect(report.fallbacks).toBe(0);
    expect(report.naturallyFinished).toBe(20);
    expect(report.branches.hidden_wolf_awakened).toBeGreaterThan(0);
    let inheritedKnives = 0,
      maskedOpenings = 0;
    const root = await createTestTempDirectory("awa-hidden-random-replay-");
    for (const game of report.games) {
      const record = await readReproduction(path.join(game.recordDir, "reproduction.json")),
        hidden = record.metadata.players.find((p) => p.role === "hidden_wolf")!.id;
      expect(
        record.checkpoints[0].players.find((p) => p.id === hidden)!.privateState.hidden_wolf,
      ).toEqual({ hasInheritedKnife: false });
      maskedOpenings++;
      for (const e of record.events) {
        if (e.type === "wolf_kill_vote_cast" && e.payload.actorId === hidden) inheritedKnives++;
        if (["wolf_discussion", "wolf_discussion_ended"].includes(e.type))
          expect(e.payload.actorId).not.toBe(hidden);
      }
      expect((await replayReproduction(record, root)).snapshot.result).toEqual(game.result);
    }
    expect(inheritedKnives).toBeGreaterThan(0);
    expect(maskedOpenings).toBe(20);
  }, 30000);
