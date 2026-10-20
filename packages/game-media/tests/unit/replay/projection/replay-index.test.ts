/**
 * 单元测试负责验证共享前缀索引与原投影的事实边界。输入为手写死亡、警徽和未知事件，预期为独立状态序列。
 * 索引消费者修改已取得快照不能污染后续快照或原档案；不调用游戏引擎、不生成 golden。
 */
import { expect, test } from "bun:test";
import type { ReplayDocument } from "@ai-werewolf-arena/replay-contract";
import {
  buildReplaySnapshot,
  createReplaySnapshotIndex,
} from "../../../../src/replay/replay-projection";

test("prefix index preserves recorded death and badge order with detached snapshots", () => {
  const replay: ReplayDocument = {
    schemaVersion: 2,
    perspective: "god",
    sessionId: "index",
    meta: { board: "test", startedAt: "", endedAt: "" },
    result: { winner: null, reason: null },
    players: [
      { player_id: 1, role: "seer", camp: "good" },
      { player_id: 2, role: "wolf", camp: "wolf" },
    ],
    events: [
      {
        seq: 1,
        timestamp: "",
        day: 1,
        phase: "day",
        type: "sheriff_elected",
        payload: { winnerId: 1 },
      },
      { seq: 2, timestamp: "", day: 1, phase: "voting", type: "voted_out", payload: { target: 1 } },
      {
        seq: 3,
        timestamp: "",
        day: 1,
        phase: "voting",
        type: "sheriff_badge_transferred",
        payload: { fromId: 1, toId: 2 },
      },
    ],
  };
  const original = JSON.stringify(replay),
    index = createReplaySnapshotIndex(replay);
  expect(
    index.map((snapshot) => snapshot.players.map((player) => [player.alive, player.isSheriff])),
  ).toEqual([
    [
      [true, true],
      [true, false],
    ],
    [
      [false, true],
      [true, false],
    ],
    [
      [false, false],
      [true, true],
    ],
  ]);
  for (let cursor = 0; cursor < index.length; cursor++)
    expect(index[cursor]).toEqual(buildReplaySnapshot(replay, cursor));
  index[0]!.players[1]!.alive = false;
  index[0]!.event!.payload.winnerId = 99;
  expect(index[2]!.players[1]!.alive).toBe(true);
  expect(JSON.stringify(replay)).toBe(original);
});
