import { expect, test } from "bun:test";
import { eventLabel, parseOfflineReplayJson } from "../../../src/replay/offline-replay";

test("parses a backend replay document", () => {
  const replay = parseOfflineReplayJson(JSON.stringify({
    perspective: "unredacted", sessionId: "session_1",
    meta: { board: "six_player_mvp", startedAt: "t1", endedAt: "t2" },
    result: { winner: "good", reason: "wolves_eliminated" }, players: [],
    events: [{ seq: 1, timestamp: "t1", day: 1, phase: "day", type: "day_speech", payload: { actorId: 1, text: "大家好" } }],
  }));
  expect(replay.sessionId).toBe("session_1");
  expect(eventLabel(replay.events[0])).toBe("1号发言：大家好");
});

test("rejects a legacy timeline instead of guessing its schema", () => {
  expect(() => parseOfflineReplayJson(JSON.stringify({ events: [] }))).toThrow("replay.json");
});

test("localizes the initial role lineup without machine separators", () => {
  expect(eventLabel({
    seq: 1,
    timestamp: "t1",
    day: 1,
    phase: "night",
    type: "god_private_game_info",
    payload: {
      players: [
        { id: 1, seat: 1, role: "wolf" },
        { id: 2, seat: 2, role: "seer" },
      ],
    },
  })).toBe("角色分布：1号：狼人，2号：预言家");
});

test("localizes weighted vote summaries", () => {
  expect(eventLabel({
    seq: 1,
    timestamp: "t1",
    day: 1,
    phase: "voting",
    type: "vote_summary",
    payload: {
      votes: [{ actorId: 1, targetId: 2, abstain: false, weight: 1.5 }],
    },
  })).toBe("放逐票型：1号→2号（票权1.5）");
});

test("localizes the final winner and reason", () => {
  expect(eventLabel({
    seq: 1,
    timestamp: "t1",
    day: 4,
    phase: "game_over",
    type: "game_over",
    payload: { winner: "good", reason: "all_wolves_eliminated" },
  })).toBe("对局结束：好人阵营获胜（所有狼人出局）");
});
