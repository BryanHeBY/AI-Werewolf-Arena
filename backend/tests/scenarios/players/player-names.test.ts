/**
 * 场景测试负责验证昵称经真实运行、录制和严格复现保留，以及无昵称板子的自然完局。
 * 输入为合成 LLM 传输、字面行动计划和固定模拟种子；预期来自手写姓名、数字目标、字段缺席与正常终局断言。
 * 精确复现只核本次录制一致性；不调用外部模型，不重写冻结夹具或以模拟策略充当规则 oracle。
 */
import { expect, test } from "bun:test";
import path from "node:path";
import { runTransportGame } from "../../support/drivers/transport/run-game";
import { wolfKingScenario } from "../../support/features/wolf-king/builders/scenario";
import { loadBoardDefinition } from "../../../src/app/config/load-board-definition";
import { simulateGames } from "../../../src/app/simulation/simulate-games";
import {
  readReproduction,
  replayReproduction,
} from "../../../src/app/simulation/replay-reproduction";
import { createTestTempDirectory } from "../../support/drivers/temp-directories";

test("自定义昵称经 LLM 实际运行、录制和精确复现保留，目标依旧是数字 ID", async () => {
  const run = await runTransportGame(wolfKingScenario("exile_chain"), "llm", "zh-CN");
  expect(run.manifest.players[0]!.name).toBe("Seat 1");
  expect(run.replay.players[0]!.name).toBe("Seat 1");
  expect(run.views.every((view) => view.name === `Seat ${view.player_id}`)).toBe(true);
  expect(run.record.metadata.players[0]!.name).toBe("Seat 1");
  expect(run.record.checkpoints.at(-1)!.players[0]!.name).toBe("Seat 1");
  const targets = run.record.decisions.flatMap((decision) => {
    const action = decision.outcome.kind === "action" ? decision.outcome.action : null;
    return action && "target_id" in action.args ? [action.args.target_id] : [];
  });
  expect(targets.length).toBeGreaterThan(0);
  expect(targets.every((target) => target === null || typeof target === "number")).toBe(true);
}, 30000);

for (const boardId of [
  "six_player_mvp",
  "twelve_player_animal_dream_skip_final",
  "awa_netease_demon_hunter_6_side_v1",
]) {
  test(`${boardId}：无昵称完成模拟及严格复现，名字字段保持缺席`, async () => {
    const board = await loadBoardDefinition(
      path.resolve(import.meta.dir, "../../../../configs.example"),
      boardId,
    );
    const root = await createTestTempDirectory("awa-unnamed-players-");
    const report = await simulateGames(board, {
      seeds: ["optional-player-names"],
      styles: ["competitive"],
      recordRoot: root,
      maxDays: 30,
    });
    expect(report.naturallyFinished).toBe(1);
    expect(report.rejects).toBe(0);
    expect(report.fallbacks).toBe(0);
    const record = await readReproduction(
      path.join(report.games[0]!.recordDir, "reproduction.json"),
    );
    expect(record.metadata.players.every((player) => !Object.hasOwn(player, "name"))).toBe(true);
    expect(
      record.checkpoints.every((checkpoint) =>
        checkpoint.players.every((player) => !Object.hasOwn(player, "name")),
      ),
    ).toBe(true);
    expect((await replayReproduction(record, root + "/replayed")).snapshot).toEqual(
      record.checkpoints.at(-1)!.snapshot,
    );
  }, 30000);
}
