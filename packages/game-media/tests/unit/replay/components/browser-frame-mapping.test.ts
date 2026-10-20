/**
 * 单元测试负责旧90帧浏览器采样到聚合揭晓区间的导航映射。输入为独立手写投票／放逐事件，预期固定源 seq 与生死边界。
 * 只验证测试导航工具不越过下一状态 cue，不拿编译 view 生成事实预期，也不执行后端规则或浏览器。
 */
import { expect, test } from "bun:test";
import type { ReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { replayBrowserFrame, replayBrowserPlan } from "../../../support/replay-browser-frame";
import { buildVideoFrame } from "../../../../src/video/frame";

const replay: ReplayDocument = {
  schemaVersion: 2,
  perspective: "god",
  sessionId: "browser-navigation",
  meta: { board: "test", startedAt: "start", endedAt: "end" },
  result: { winner: null, reason: null },
  players: [
    { player_id: 1, role: "villager", camp: "good" },
    { player_id: 2, role: "wolf", camp: "wolf" },
  ],
  events: [
    { type: "day_speech", payload: { actorId: 1, text: "before" } },
    { type: "vote_cast", payload: { actorId: 1, targetId: 2, weight: 1, abstain: false } },
    {
      type: "vote_summary",
      payload: {
        round: 1,
        votes: [{ actorId: 1, targetId: 2, weight: 1, abstain: false }],
        tally: { 2: 1 },
        target: 2,
      },
    },
    { type: "voted_out", payload: { target: 2 } },
    { type: "day_speech", payload: { actorId: 1, text: "after" } },
  ].map((event, index) => ({
    ...event,
    seq: index + 1,
    timestamp: "2026-01-01T00:00:00Z",
    day: 1,
    phase: "voting",
  })),
};

test("summary tail remains alive before the absorbed exile settles, including reverse seeks", () => {
  const display = { locale: "zh-CN" as const, timeZone: "UTC" };
  const plan = replayBrowserPlan(replay, display);
  for (const [legacyFrame, seq, alive] of [
    [90, 3, true],
    [179, 3, true],
    [180, 4, false],
    [225, 4, false],
    [179, 3, true],
    [0, 1, true],
  ] as const) {
    const current = buildVideoFrame(plan, replayBrowserFrame(replay, legacyFrame, display));
    expect(current.sourceSeq).toBe(seq);
    expect(current.currentView.players.find((player) => player.playerId === 2)!.alive).toBe(alive);
  }
});
