/**
 * 负责基础板子的观察对局场景测试，核对受玩家 DTO 限制的决定完成对局。
 * 输入为每板二十五个固定种子及原逐局归档；输出由实际技能覆盖、无修复、公开文档校验与精确完整复盘核对。
 * 不调用计费模型、不重生预期 fixture／Tape；磁盘新封装经 canonical reader 解包。
 */
import { readReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { assertReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { loadBoardDefinition } from "../../../../src/runtime/config/load_board_definition";
import { simulateGames } from "../../../../src/runtime/simulation/simulate_games";
import {
  readReproduction,
  replayReproduction,
} from "../../../../src/runtime/simulation/replay_reproduction";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";

const fixtures = path.resolve(import.meta.dir, "../../../../../configs.example");

for (const boardId of ["six_player_mvp", "twelve_player_standard"]) {
  test(`${boardId}: 25 restricted-observation seeds finish with executed skill coverage and no repairs`, async () => {
    const board = await loadBoardDefinition(fixtures, boardId);
    const root = await createTestTempDirectory("awa-observed-simulation-");
    const seeds = Array.from({ length: 25 }, (_, index) => `regression:${index}`);
    const report = await simulateGames(board, { seeds, recordRoot: root });
    const actionReplayRoot = await createTestTempDirectory("awa-observed-action-replays-");
    expect(report.naturallyFinished).toBe(25);
    expect(report.rejects).toBe(0);
    expect(report.fallbacks).toBe(0);
    expect(report.branches.seer_checked).toBeGreaterThan(0);
    if (boardId === "six_player_mvp") {
      expect(report.branches["guard_applied.protect"]).toBeGreaterThan(0);
      expect(report.branches["guard_applied.skip"]).toBeGreaterThan(0);
    } else {
      for (const branch of [
        "witch_potion_used.heal",
        "witch_potion_used.poison",
        "witch_potion_skipped",
        "hunter_shot",
        "wolf_self_destruct",
        "idiot_revealed",
        "sheriff_elected",
      ])
        expect(report.branches[branch]).toBeGreaterThan(0);
    }
    for (const game of report.games) {
      const replay = readReplayDocument(JSON.parse(await readFile(path.join(game.recordDir, "replay.json"), "utf8")));
      assertReplayDocument(replay);
      expect(replay.result).toEqual({
        winner: game.result!.winner,
        reason: game.result!.reason,
        decision: game.result ?? undefined,
      });
      const reproduction = await readReproduction(path.join(game.recordDir, "reproduction.json"));
      expect((await replayReproduction(reproduction, actionReplayRoot)).snapshot.result).toEqual(
        game.result,
      );
    }
    const replayRoot = await createTestTempDirectory("awa-observed-repeat-");
    const replayed = await simulateGames(board, { seeds: [seeds[4]], recordRoot: replayRoot });
    const { recordDir: _firstDir, ...first } = report.games[4];
    const { recordDir: _secondDir, ...second } = replayed.games[0];
    expect(second).toEqual(first); // Position within a batch cannot determine styles or random consumption.
  }, 30_000); // 25 complete games plus 25 strict replays; independent of Bun's 5s unit-test default.
}
