/**
 * 单元数据测试验证离线复盘加载和历史格式处理。输入为字面有效／畸形元数据、事件序列与固定 legacy 样本；
 * 输出以原错误、字段和两语字幕预期检查解析、未知原文与旧版本转换。fixture 只是输入来源，不调用 live 对局或重新生成预期。
 */
import { expect, test } from "bun:test";
import type { ReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { eventLabel } from "../../../../src/replay/event-labels";
import { parseOfflineReplayJson } from "../../../../src/replay/offline-replay";

test("parses a backend replay document", () => {
  const replay = parseOfflineReplayJson(
    JSON.stringify({
      perspective: "god",
      sessionId: "session_1",
      meta: { board: "six_player_mvp", startedAt: "t1", endedAt: "t2" },
      result: { winner: "good", reason: "wolves_eliminated" },
      players: [],
      events: [
        {
          seq: 1,
          timestamp: "t1",
          day: 1,
          phase: "day",
          type: "day_speech",
          payload: { actorId: 1, text: "大家好" },
        },
      ],
    }),
  );
  expect(replay.sessionId).toBe("session_1");
  expect(eventLabel(replay.events[0])).toBe("1号发言：大家好");
});

test("rejects a legacy timeline instead of guessing its schema", () => {
  expect(() => parseOfflineReplayJson(JSON.stringify({ events: [] }))).toThrow("replay.json");
});

test("rejects a replay whose perspective is not the complete god view", () => {
  expect(() =>
    parseOfflineReplayJson(
      JSON.stringify({
        perspective: "unredacted",
        sessionId: "session_legacy",
        meta: { board: "six_player_mvp", startedAt: "t1", endedAt: "t2" },
        result: { winner: null, reason: null },
        players: [],
        events: [],
      }),
    ),
  ).toThrow("replay.json");
});

test("rejects malformed nested event payloads", () => {
  expect(() =>
    parseOfflineReplayJson(
      JSON.stringify({
        perspective: "god",
        sessionId: "session_nested_invalid",
        meta: { board: "six_player_mvp", startedAt: "t1", endedAt: "t1" },
        result: { winner: null, reason: null },
        players: [{ player_id: 1, role: "villager", camp: "good" }],
        events: [
          { seq: 1, timestamp: "t1", phase: "night", day: 1, type: "day_speech", payload: [] },
        ],
      }),
    ),
  ).toThrow("replay.json");
});

test.each([
  ["meta.board", { meta: { board: 7, startedAt: "t1", endedAt: "t1" } }],
  ["meta.startedAt", { meta: { board: "test", startedAt: null, endedAt: "t1" } }],
  ["meta.endedAt", { meta: { board: "test", startedAt: "t1", endedAt: false } }],
  ["result.winner", { result: { winner: {}, reason: null } }],
  ["result.reason", { result: { winner: null, reason: [] } }],
  ["player record", { players: [null] }],
  ["player identifier", { players: [{ player_id: 1.5, role: "wolf", camp: "wolf" }] }],
  ["player role", { players: [{ player_id: 1, role: [], camp: "wolf" }] }],
  ["player camp", { players: [{ player_id: 1, role: "wolf", camp: false }] }],
  [
    "duplicate players",
    {
      players: [
        { player_id: 1, role: "wolf", camp: "wolf" },
        { player_id: 1, role: "seer", camp: "good" },
      ],
    },
  ],
] as const)("rejects invalid %s before opening the replay", (_field, fields) => {
  expect(() =>
    parseOfflineReplayJson(
      JSON.stringify({
        perspective: "god",
        sessionId: "invalid_nested",
        meta: { board: "test", startedAt: "t1", endedAt: "t1" },
        result: { winner: null, reason: null },
        players: [],
        events: [],
        ...fields,
      }),
    ),
  ).toThrow("replay.json");
});

test.each([
  ["timestamp", { timestamp: 123 }],
  ["phase", { phase: null }],
  ["day", { day: 1.5 }],
  ["stage", { stage: [] }],
  ["type", { type: {} }],
  ["payload", { payload: null }],
  ["sequence", { seq: 2 }],
] as const)("rejects invalid event %s", (_field, fields) => {
  expect(() =>
    parseOfflineReplayJson(
      JSON.stringify({
        perspective: "god",
        sessionId: "invalid_event",
        meta: { board: "test", startedAt: "t1", endedAt: "t1" },
        result: { winner: null, reason: null },
        players: [],
        events: [
          {
            seq: 1,
            timestamp: "t1",
            phase: "night",
            day: 1,
            type: "phase_changed",
            payload: {},
            ...fields,
          },
        ],
      }),
    ),
  ).toThrow("replay.json");
});

test("accepts an in-progress document without players or terminal events", () => {
  const document = {
    perspective: "god",
    sessionId: "in_progress",
    meta: { board: "test", startedAt: "t1", endedAt: "t1" },
    result: { winner: null, reason: "in_progress" },
    players: [],
    events: [
      { seq: 1, timestamp: "t1", phase: "night", day: 1, type: "phase_changed", payload: {} },
    ],
  } satisfies Omit<ReplayDocument, "schemaVersion">;
  expect(parseOfflineReplayJson(JSON.stringify(document))).toEqual({
    ...document,
    schemaVersion: 2,
  });
});

test("rejects duplicate and out-of-order canonical event sequences", () => {
  for (const sequences of [
    [1, 1],
    [2, 1],
    [1, 3],
  ]) {
    expect(() =>
      parseOfflineReplayJson(
        JSON.stringify({
          perspective: "god",
          sessionId: "invalid_sequence",
          meta: { board: "test", startedAt: "t1", endedAt: "t1" },
          result: { winner: null, reason: null },
          players: [],
          events: sequences.map((seq) => ({
            seq,
            timestamp: "t1",
            day: 1,
            phase: "night",
            type: "phase_changed",
            payload: {},
          })),
        }),
      ),
    ).toThrow("replay.json");
  }
});

test("localizes the initial role lineup without machine separators", () => {
  expect(
    eventLabel({
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
    }),
  ).toBe("角色分布：1号：狼人，2号：预言家");
});

test("localizes weighted vote summaries", () => {
  expect(
    eventLabel({
      seq: 1,
      timestamp: "t1",
      day: 1,
      phase: "voting",
      type: "vote_summary",
      payload: {
        votes: [{ actorId: 1, targetId: 2, abstain: false, weight: 1.5 }],
      },
    }),
  ).toBe("放逐票型：1号→2号（票权1.5）");
});

test("localizes the final winner and reason", () => {
  expect(
    eventLabel({
      seq: 1,
      timestamp: "t1",
      day: 4,
      phase: "game_over",
      type: "game_over",
      payload: { winner: "good", reason: "all_wolves_eliminated" },
    }),
  ).toBe("对局结束：好人阵营获胜（狼人全部出局）");
});

test("browser loader converts legacy metadata and keeps unknown fields and player prose", async () => {
  const raw = await Bun.file(
    new URL(
      "../../../../../packages/replay-contract/fixtures/synthetic/legacy-localized/locale-unrecorded/god.replay.json",
      import.meta.url,
    ),
  ).text();
  const replay = parseOfflineReplayJson(raw);
  expect(replay.schemaVersion).toBe(2);
  expect(replay.events[0].phase).toBe("night");
  expect(replay.players[0].name).toBe("玩家1");
  expect(replay.events[0].payload.reason).toBe("狼人全部出局");
  expect(replay.events[2].phase).toBe("未知阶段");
  expect(replay.events[2].payload.role).toBe("狼人");
  expect(() => parseOfflineReplayJson(JSON.stringify({ ...replay, schemaVersion: 3 }))).toThrow(
    "不支持此复盘格式版本",
  );
});
