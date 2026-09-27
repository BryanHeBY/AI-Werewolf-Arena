import { expect, test } from "bun:test";
import { bootstrapGame } from "../../src/app/bootstrap";
import type { GameEvent } from "../../src/core/domain/model";
import { SessionRecordManager } from "../../src/recording/session_recorder";
import { presentStreamEvents } from "../../src/runtime/console_presenter";
import { GameEventRecorder } from "../../src/runtime/game_event_recorder";
import { sixPlayerMvpConfig } from "../../src/runtime/scenarios/six_player_mvp";
import { createTestTempDirectory } from "../support/temp_directory";

test("terminal presentation failure does not replay already recorded events", async () => {
  const root = await createTestTempDirectory("awa-event-recorder-");
  const manager = await SessionRecordManager.create({
    sessionId: "session_event_recorder",
    board: "six_player_mvp",
    startedAtIso: new Date(0).toISOString(),
  }, root);
  const { world } = bootstrapGame(sixPlayerMvpConfig);
  const recorder = new GameEventRecorder({ world, replayManager: manager }, "night");
  const events: GameEvent[] = [
    { timestamp: 1, type: "phase_changed", payload: { phase: "day", day: 1 } },
    { timestamp: 2, type: "day_speech", payload: { actorId: 1, text: "hello" } },
  ];

  const delta = recorder.flush(events);
  expect(delta).toEqual(events);
  expect(() => presentStreamEvents(delta, false, () => { throw new Error("output_failed"); })).toThrow("output_failed");
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
