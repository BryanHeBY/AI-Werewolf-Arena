/**
 * 负责核对活动范围只随公开记录前缀变化。输入为独立手写夜聊、退水及PK记录，输出字面席位集合和不受台词影响的状态。
 * 同时覆盖倒看、畸形名单、缺失名单、换日及快照隔离；不调用后端规则，也不由生产集合计算预期。
 */
import { expect, test } from "bun:test";
import type { ReplayDocument, ReplayEvent } from "@ai-werewolf-arena/replay-contract";
import {
  buildReplaySnapshot,
  createReplayCursorIndex,
} from "../../../../src/replay/replay-projection";

function replay(
  rows: Array<Pick<ReplayEvent, "type" | "payload"> & Partial<ReplayEvent>>,
): ReplayDocument {
  return {
    schemaVersion: 2,
    perspective: "god",
    sessionId: "explicit-roster-activity-review",
    meta: { board: "test", startedAt: "s", endedAt: "e" },
    result: { winner: null, reason: null },
    players: [
      { player_id: 1, role: "seer", camp: "good" },
      { player_id: 2, role: "wolf", camp: "wolf" },
      { player_id: 3, role: "villager", camp: "good" },
      { player_id: 4, role: "wolf", camp: "wolf" },
      { player_id: 5, role: "hunter", camp: "good" },
      { player_id: 6, role: "wolf", camp: "wolf" },
    ],
    events: rows.map((row, index) => ({
      seq: index + 1,
      timestamp: "t",
      day: 1,
      phase: "day",
      ...row,
    })),
  };
}
const activity = (snapshot: ReturnType<typeof buildReplaySnapshot>) =>
  snapshot.players.flatMap((p) =>
    p.rosterActivity ? [[p.playerId, p.rosterActivity.kind, p.rosterActivity.status]] : [],
  );

test("night chat scope comes only from the recorded order, individual end keeps teammates and knife votes leave chat", () => {
  const input = replay([
    { type: "wolf_tactical_order", phase: "night", payload: { order: [4, 2] } },
    {
      type: "wolf_discussion",
      phase: "night",
      payload: { actorId: 2, text: "6号也自称狼人", round: 1 },
    },
    {
      type: "wolf_discussion_ended",
      phase: "night",
      payload: { actorId: 2, reason: "结束个人讨论", round: 2 },
    },
    {
      type: "wolf_discussion",
      phase: "night",
      payload: { actorId: 4, text: "仍在讨论", round: 2 },
    },
    {
      type: "wolf_kill_vote_cast",
      phase: "night",
      stage: "wolf_discussion",
      payload: { actorId: 4, targetId: 1, abstain: false },
    },
  ]);
  const before = JSON.stringify(input),
    index = createReplayCursorIndex(input);
  expect(activity(index.initial)).toEqual([]);
  expect(activity(index.events[0]!)).toEqual([
    [2, "wolf-discussion", "participant"],
    [4, "wolf-discussion", "participant"],
  ]);
  for (const i of [1, 2])
    expect(activity(index.events[i]!)).toEqual([
      [2, "wolf-discussion", "speaker"],
      [4, "wolf-discussion", "participant"],
    ]);
  expect(activity(index.events[3]!)).toEqual([
    [2, "wolf-discussion", "participant"],
    [4, "wolf-discussion", "speaker"],
  ]);
  expect(activity(index.events[4]!)).toEqual([]);
  expect(activity(buildReplaySnapshot(input, 2))).toEqual([
    [2, "wolf-discussion", "speaker"],
    [4, "wolf-discussion", "participant"],
  ]);
  index.events[0]!.players[1]!.rosterActivity = { kind: "sheriff-election", status: "candidate" };
  expect(index.events[1]!.players[1]!.rosterActivity!.status).toBe("speaker");
  expect(JSON.stringify(input)).toBe(before);
});

test("nomination and withdrawal summaries own visible candidates; filtered individual answers never anticipate a reveal", () => {
  const input = replay([
    { type: "sheriff_candidate_declared", payload: { actorId: 1, run: true } },
    { type: "sheriff_nomination_summary", payload: { candidates: [1, 3, 5] } },
    { type: "day_speech", payload: { actorId: 1, text: "2号上警，5号退水只是原话，不是事实" } },
    { type: "sheriff_candidate_declared", payload: { actorId: 3, run: false } },
    { type: "sheriff_withdraw_summary", payload: { withdrawn: [3] } },
    { type: "sheriff_candidates_finalized", payload: { candidates: [1, 5] } },
    { type: "sheriff_vote_summary", payload: { votes: [], winnerId: null } },
    { type: "sheriff_pk_started", payload: { candidates: [5] } },
    { type: "day_speech", payload: { actorId: 5, text: "PK原话" } },
    { type: "sheriff_elected", payload: { winnerId: 5, candidates: [1, 3, 5] } },
    { type: "day_speech", payload: { actorId: 2, text: "选举已结束" } },
  ]);
  const index = createReplayCursorIndex(input);
  const full: ReturnType<typeof activity> = [
    [1, "sheriff-election", "candidate"],
    [3, "sheriff-election", "candidate"],
    [5, "sheriff-election", "candidate"],
  ];
  expect(activity(index.events[0]!)).toEqual([]);
  for (const i of [1, 2, 3]) expect(activity(index.events[i]!)).toEqual(full);
  expect(activity(index.events[4]!)).toEqual([
    [1, "sheriff-election", "candidate"],
    [3, "sheriff-election", "withdrawn"],
    [5, "sheriff-election", "candidate"],
  ]);
  for (const i of [5, 6])
    expect(activity(index.events[i]!)).toEqual([
      [1, "sheriff-election", "candidate"],
      [5, "sheriff-election", "candidate"],
    ]);
  for (const i of [7, 8])
    expect(activity(index.events[i]!)).toEqual([[5, "sheriff-election", "candidate"]]);
  for (const i of [9, 10]) expect(activity(index.events[i]!)).toEqual([]);
  for (let i = input.events.length - 1; i >= 0; i--)
    expect(activity(buildReplaySnapshot(input, i))).toEqual(activity(index.events[i]!));
});

test("missing or rejected lists never infer participants from identities, and phase changes or next-day facts clear scope", () => {
  const missing = replay([
    { type: "wolf_discussion", phase: "night", payload: { actorId: 2, text: "未知名单" } },
  ]);
  expect(activity(buildReplaySnapshot(missing, 0))).toEqual([[2, "wolf-discussion", "speaker"]]);
  const invalid = replay([
    { type: "sheriff_nomination_summary", payload: { candidates: [1, 99] } },
  ]);
  expect(activity(buildReplaySnapshot(invalid, 0))).toEqual([]);
  const changed = replay([
    { type: "sheriff_nomination_summary", payload: { candidates: [1, 3] } },
    { type: "phase_changed", phase: "night", payload: { phase: "night" } },
    { type: "wolf_tactical_order", phase: "night", payload: { order: [2] } },
  ]);
  changed.factCoverage = { committedDeaths: 1 };
  changed.facts = [
    {
      seq: 1,
      afterSeq: 3,
      day: 2,
      kind: "potion_stock",
      actorId: 1,
      abilityId: "explicit",
      heal: 1,
      poison: 1,
    },
  ];
  const index = createReplayCursorIndex(changed);
  expect(activity(index.events[1]!)).toEqual([]);
  expect(activity(index.events[2]!)).toEqual([[2, "wolf-discussion", "participant"]]);
  expect(activity(index.facts[0]!)).toEqual([]);
  const tieEnds = replay([
    { type: "sheriff_candidates_finalized", payload: { candidates: [1, 3] } },
    { type: "sheriff_vote_summary", payload: { votes: [], winnerId: null } },
    { type: "day_speech", payload: { actorId: 2, text: "未继续PK的普通发言" } },
  ]);
  expect(activity(buildReplaySnapshot(tieEnds, 2))).toEqual([]);
  for (const row of [
    { type: "wolf_tactical_order", phase: "day", payload: { order: [2, 4] } },
    { type: "wolf_discussion", phase: "day", payload: { actorId: 2, text: "错误阶段" } },
    { type: "sheriff_nomination_summary", phase: "night", payload: { candidates: [1, 3] } },
    { type: "sheriff_nomination_summary", phase: "game_over", payload: { candidates: [1, 3] } },
  ])
    expect(activity(buildReplaySnapshot(replay([row]), 0))).toEqual([]);
});
