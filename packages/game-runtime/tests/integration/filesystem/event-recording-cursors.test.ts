/**
 * 文件系统集成测试以原游戏事件、临时 SessionRecordManager 及抛错终端 presenter 为输入，核对展示失败后事件游标仍使每条事件仅持久化一次。字面记录数和中立玩家枪阶段字段保留原上帝视角来源身份；终端展示不持有持久化职责。
 */
import { Phase } from "../../../src/domain";
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import type { GameEvent } from "../../../src/domain/model";
import { SessionRecordManager } from "../../../src/recording/session/recorder";
import { presentStreamEvents } from "../../../src/adapters/console/console-presenter";
import { GameEventRecorder } from "../../../src/app/game-event-recorder";
import { sixPlayerMvpConfig } from "../../../src/rulesets/presets/six-player-mvp";
import { createTestTempDirectory } from "../../support/drivers/temp-directories";

test("terminal presentation failure does not replay already recorded events", async () => {
  const root = await createTestTempDirectory("awa-event-recorder-");
  const manager = await SessionRecordManager.create(
    {
      sessionId: "session_event_recorder",
      board: "six_player_mvp",
      startedAtIso: new Date(0).toISOString(),
    },
    root,
  );
  const { world } = bootstrapGame(sixPlayerMvpConfig);
  const recorder = new GameEventRecorder({ world, replayManager: manager }, "night");
  const events: GameEvent[] = [
    { timestamp: 1, type: "phase_changed", payload: { phase: Phase.Day, day: 1 } },
    { timestamp: 2, type: "day_speech", payload: { actorId: 1, text: "hello" } },
  ];

  const delta = recorder.flush(events);
  expect(delta).toEqual(events);
  expect(() =>
    presentStreamEvents(delta, false, () => {
      throw new Error("output_failed");
    }),
  ).toThrow("output_failed");
  expect(recorder.flush(events)).toEqual([]);

  const summary = await manager.finalize({
    endedAtIso: new Date(3).toISOString(),
    winner: null,
    finishReason: "test_done",
    players: [],
  });
  expect(summary.publicEvents.map((event) => event.type)).toEqual(["phase_changed", "day_speech"]);
  expect(summary.playerViews).toHaveLength(6);
  expect(summary.playerViews[0].timeline.filter((entry) => entry.kind === "event")).toHaveLength(2);
});

test("both gun origins persist the same neutral player event stage while God keeps the native origin", async () => {
  const root = await createTestTempDirectory("awa-neutral-shot-");
  const manager = await SessionRecordManager.create(
    {
      sessionId: "session_neutral_shot",
      board: "six_player_mvp",
      startedAtIso: new Date(0).toISOString(),
    },
    root,
  );
  const { world } = bootstrapGame(sixPlayerMvpConfig);
  const recorder = new GameEventRecorder({ world, replayManager: manager }, "day");
  const events: GameEvent[] = [
    { timestamp: 1, type: "hunter_shot", payload: { hunterId: 3, targetId: 2 } },
    { timestamp: 2, type: "player_shot", payload: { actorId: 3, targetId: 2 } },
  ];
  expect(recorder.flush(events)).toEqual(events);
  expect(recorder.flush(events)).toEqual([]);
  const summary = await manager.finalize({
    endedAtIso: new Date(3).toISOString(),
    winner: null,
    finishReason: "test_done",
    players: [],
  });
  expect(summary.publicEvents.map((e) => [e.type, e.stage, e.payload])).toEqual([
    ["hunter_shot", "hunter_shot", { hunterId: 3, targetId: 2 }],
    ["player_shot", "death_shot", { actorId: 3, targetId: 2 }],
  ]);
  expect(summary.playerViews).toHaveLength(6);
  for (const view of summary.playerViews) {
    const entries = view.timeline.filter((entry) => entry.kind === "event");
    expect(entries.map((entry) => entry.stage)).toEqual(["death_shot", "death_shot"]);
    expect(entries.map((entry) => entry.event)).toEqual([
      { seq: 1, type: "player_shot", payload: { actorId: 3, targetId: 2 } },
      { seq: 2, type: "player_shot", payload: { actorId: 3, targetId: 2 } },
    ]);
  }
});
