import { expect, test } from "bun:test";
import { eventLabel, parseOfflineReplayJson } from "../../../src/replay/offline-replay";

test("parses an exported offline replay bundle", () => {
  const replay = parseOfflineReplayJson(JSON.stringify({
    perspective: "unredacted", sessionId: "session_1",
    meta: { board: "six_player_mvp", startedAt: "t1", endedAt: "t2" },
    result: { winner: "good", reason: "wolves_eliminated" }, players: [], phaseWindows: [],
    events: [{ seq: 1, timestamp: "t1", day: 1, phase: "day", type: "day_speech", payload: { actorId: 1, text: "大家好" } }],
  }));
  expect(replay.sessionId).toBe("session_1");
  expect(eventLabel(replay.events[0])).toBe("1号发言：大家好");
});

test("rejects a legacy timeline instead of guessing its schema", () => {
  expect(() => parseOfflineReplayJson(JSON.stringify({ events: [] }))).toThrow(".replay.json");
});
