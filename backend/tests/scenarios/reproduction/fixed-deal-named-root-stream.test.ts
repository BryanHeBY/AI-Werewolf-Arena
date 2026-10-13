/**
 * 场景测试用注入的具名随机流录制并严格重放完整固定发牌对局。输入为原固定牌序、
 * 特权基线动作和临时输出；固定发牌模式、随机流路径及原快照比较提供既有预期。
 * 目录归属迁移不增加独立胜负预期或生成新 golden，也不调用模型。
 */
import { expect, test } from "bun:test";
import path from "node:path";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { createRandom, Phase, Role, type ActionRequest } from "../../../src/core";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";
import { SessionRecordManager } from "../../../src/recording/session_recorder";
import {
  beginGameReproduction,
  captureCheckpoint,
  currentEngineVersion,
} from "../../../src/runtime/simulation/reproduction_context";
import { GameEventRecorder } from "../../../src/runtime/game_event_recorder";
import { createTestTempDirectory } from "../../support/drivers/temp-directories";
import { BaselineBotActionProvider } from "../../../src/game/drivers/privileged-baseline";
import { runWithSessionRecorder } from "../../../src/recording/recording_context";
import {
  readReproduction,
  replayReproduction,
} from "../../../src/runtime/simulation/replay_reproduction";

test("a fixed deal with an injected named root stream reproduces in its declared mode", async () => {
  const root = await createTestTempDirectory("awa-fixed-record-");
  const output = await createTestTempDirectory("awa-fixed-replay-");
  const context = bootstrapGame(sixPlayerMvpConfig, {
    random: createRandom("fixed-root").fork("fixture"),
    fixedRoles: [Role.Wolf, Role.Seer, Role.Villager, Role.Wolf, Role.Guard, Role.Villager],
  });
  const manager = await SessionRecordManager.create(
    { sessionId: "fixed", board: "six_player_mvp", startedAtIso: "2026-10-07T00:00:00.000Z" },
    root,
  );
  const trace = beginGameReproduction(manager, context, {
    engine: await currentEngineVersion(),
    boardId: "six_player_mvp",
    ...(void sixPlayerMvpConfig, {}),
    locale: "zh-CN",
    maxDays: 30,
  });
  const baseline = new BaselineBotActionProvider(context.world);
  const provider = { getAction: (request: ActionRequest) => trace.decide(request, baseline) };
  const recorder = new GameEventRecorder(
    { world: context.world, replayManager: manager },
    Phase.Night,
  );
  await runWithSessionRecorder(manager, async () => {
    let cycle = 0;
    while (!context.phaseManager.getSnapshot().gameOver) {
      await context.phaseManager.runSingleCycle(provider, 30);
      trace.checkpoint(
        captureCheckpoint(
          context.world,
          context.phaseManager.getSnapshot(),
          ++cycle,
          true,
          context.phaseManager.getEvents().length,
        ),
        context.phaseManager.getEvents(),
      );
      recorder.flush(context.phaseManager.getEvents());
    }
    const snapshot = context.phaseManager.getSnapshot();
    await manager.finalize({
      endedAtIso: "2026-10-07T00:01:00.000Z",
      winner: snapshot.result!.winner,
      finishReason: snapshot.result!.reason,
      players: captureCheckpoint(context.world, snapshot, cycle, true, 0).players.map((player) => ({
        player_id: player.id,
        role: player.role,
        camp: player.camp,
        alive: player.alive,
      })),
    });
  });
  const record = await readReproduction(path.join(root, "fixed/reproduction.json"));
  expect(record.metadata.dealMode).toBe("fixed");
  expect(record.metadata.random.path).toEqual(["fixture"]);
  expect((await replayReproduction(record, output)).snapshot).toEqual(
    context.phaseManager.getSnapshot(),
  );
});
