/**
 * 单元测试负责验证事件视图叶模块和旧90帧采样入口的兼容边界。输入为手写原事件、筛选视图、缓存快照和坏游标。
 * 输出用独立 seq、死亡时点与错误码预期核对原游标和展示游标，不编译视频、不运行对局或重复实现事实 reducer。
 */
import { expect, test } from "bun:test";
import type { ReplayDocument } from "@ai-werewolf-arena/replay-contract";
import {
  buildReplayEventView,
  buildReplayFrame,
  FRAMES_PER_EVENT,
} from "../../../../src/replay/replay-event-view";
import {
  buildReplayFrame as legacyFrame,
  FRAMES_PER_EVENT as legacyFrames,
} from "../../../../src/replay/replay-frame";
import { buildPresentationReplay } from "../../../../src/replay/replay-presentation";
import { createReplaySnapshotIndex } from "../../../../src/replay/replay-projection";

const replay: ReplayDocument = {
  schemaVersion: 2,
  perspective: "god",
  sessionId: "event-view",
  meta: { board: "six", startedAt: "t1", endedAt: "t2" },
  result: { winner: null, reason: null },
  players: [
    { player_id: 1, role: "seer", camp: "good" },
    { player_id: 2, role: "wolf", camp: "wolf" },
  ],
  events: [
    {
      seq: 1,
      timestamp: "t1",
      day: 1,
      phase: "day",
      type: "phase_changed",
      payload: { phase: "day" },
    },
    {
      seq: 2,
      timestamp: "t1",
      day: 1,
      phase: "day",
      type: "vote_cast",
      payload: { actorId: 1, targetId: 2 },
    },
    {
      seq: 3,
      timestamp: "t1",
      day: 1,
      phase: "day",
      type: "day_speech",
      payload: { actorId: 1, text: "二号是狼人。" },
    },
    { seq: 4, timestamp: "t1", day: 1, phase: "day", type: "voted_out", payload: { target: 2 } },
    {
      seq: 5,
      timestamp: "t2",
      day: 2,
      phase: "night",
      type: "phase_changed",
      payload: { phase: "night", day: 2 },
    },
  ],
};
const display = { locale: "zh-CN" as const, timeZone: "UTC" };
const presented = { ...display, replay: buildPresentationReplay(replay) };
const raw = { ...presented, replay: { ...presented.replay, events: replay.events } };

test("old exports retain identity, 90-frame boundary and final-frame clamping", () => {
  expect(legacyFrame).toBe(buildReplayFrame);
  expect(legacyFrames).toBe(FRAMES_PER_EVENT);
  expect(legacyFrame({ ...presented, plan: undefined }, 0).eventSeq).toBe(1);
  expect(FRAMES_PER_EVENT).toBe(90);
  expect(legacyFrame(presented, 89).eventSeq).toBe(1);
  expect(legacyFrame(presented, 90).eventSeq).toBe(3);
  expect(legacyFrame(presented, 179).players[1].alive).toBe(true);
  expect(legacyFrame(presented, 180).eventSeq).toBe(4);
  expect(legacyFrame(presented, 180).players[1].alive).toBe(false);
  expect(legacyFrame(presented, 100000).eventIndex).toBe(3);
  expect(legacyFrame(presented, 100000).snapshot.day).toBe(2);
});

test("index sampling uses the input event array and cached snapshots preserve death boundaries", () => {
  const snapshots = createReplaySnapshotIndex(replay);
  expect(buildReplayEventView(presented, 1).eventSeq).toBe(3);
  expect(buildReplayEventView(raw, 1, snapshots[1]).eventSeq).toBe(2);
  const before = buildReplayEventView(raw, 2, snapshots[2]);
  const after = buildReplayEventView(raw, 3, snapshots[3]);
  expect(before.players[1].alive).toBe(true);
  expect(after.players[1].alive).toBe(false);
  expect(after.snapshot).toBe(snapshots[3]);
  expect(after).toEqual(buildReplayFrame(raw, 270));
  expect(buildReplayEventView(raw, 100000).eventSeq).toBe(5);
});

test("empty archive has an explicit null event and invalid cursors preserve clear errors", () => {
  const empty = { ...raw, replay: { ...raw.replay, events: [] } };
  expect(buildReplayEventView(empty, -1).eventSeq).toBeNull();
  expect(buildReplayEventView(empty, 0)).toEqual(buildReplayFrame(empty, 0));
  expect(() => buildReplayEventView(raw, -1)).toThrow("replay_event_index_invalid");
  expect(() => buildReplayEventView(raw, 0.5)).toThrow("replay_event_index_invalid");
  expect(() => buildReplayFrame(raw, NaN)).toThrow("replay_frame_invalid");
  expect(() => buildReplayFrame(raw, -1)).toThrow("replay_frame_invalid");
  expect(() => buildReplayFrame({ ...raw, timeZone: "invalid" }, -1)).toThrow(
    "replay_display_time_zone_invalid",
  );
});
