/**
 * 单元测试负责旁白节奏的独立时钟验收。输入为手写阶段、行动、票型和原话，输出两秒页面预算及半秒动画、精确揭晓前后与音轨优先约定。
 * 旧阅读脚本和显式导演时钟继续单独受测；不运行TTS，不从当前结果推未来生命，不把压缩时长当删除原文。
 */
import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { compileVideoPlan } from "../../../src/video/compiler";
import { buildVideoFrame, getVideoEventFrame } from "../../../src/video/frame";
import { getVideoSourceIdentity } from "../../../src/video/source";
import { VideoFrame } from "../../../src/video/VideoComposition";
import { text } from "@ai-werewolf-arena/game-text";

function document(): ReplayDocument {
  return {
    schemaVersion: 2,
    perspective: "god",
    sessionId: "explicit-narration-pacing-acceptance",
    meta: { board: "test", startedAt: "s", endedAt: "e", locale: "zh-CN" },
    result: { winner: null, reason: null },
    players: [
      { player_id: 1, role: "guard", camp: "good" },
      { player_id: 2, role: "wolf", camp: "wolf" },
    ],
    events: [
      {
        seq: 1,
        timestamp: "t",
        day: 1,
        phase: "night",
        type: "phase_changed",
        payload: { phase: "night" },
      },
      {
        seq: 2,
        timestamp: "t",
        day: 1,
        phase: "night",
        type: "guard_applied",
        payload: { actorId: 1, targetId: 2, abstain: false },
      },
      {
        seq: 3,
        timestamp: "t",
        day: 1,
        phase: "day",
        type: "day_speech",
        payload: { actorId: 2, text: "甲".repeat(120) },
      },
      {
        seq: 4,
        timestamp: "t",
        day: 1,
        phase: "voting",
        type: "vote_summary",
        payload: {
          round: 1,
          votes: [{ actorId: 1, targetId: 2, abstain: false, weight: 1 }],
          tally: { 2: 1 },
          target: 2,
        },
      },
      {
        seq: 5,
        timestamp: "t",
        day: 1,
        phase: "voting",
        type: "voted_out",
        payload: { target: 2 },
      },
    ],
  };
}
test("default preview uses two-second non-speech shots, immediate useful content and separate result fact prefixes", () => {
  const input = document(),
    original = JSON.stringify(input),
    plan = compileVideoPlan(input);
  expect(plan.shots.map((s) => [s.eventSeq, s.durationFrames])).toEqual([
    [1, 60],
    [2, 60],
    [3, 450],
    [4, 60],
  ]);
  const action = plan.shots[1]!,
    ballot = plan.shots[3]!;
  expect(action.scene.cues).toEqual({ establish: 0, travel: 1, impact: 3, settled: 9 });
  expect(ballot.scene.resolution?.revealFrame).toBe(7);
  expect(buildVideoFrame(plan, ballot.from + 2).sourceSeq).toBe(3);
  expect(buildVideoFrame(plan, ballot.from + 3).sourceSeq).toBe(4);
  expect(buildVideoFrame(plan, ballot.from + 6).currentView.players[1]!.alive).toBe(true);
  expect(buildVideoFrame(plan, ballot.from + 7).currentView.players[1]!.alive).toBe(false);
  expect(getVideoEventFrame(plan, 5)).toBe(ballot.from + 7);
  expect(buildVideoFrame(plan, ballot.from + 6).sourceSeq).toBe(4);
  expect(plan.shots[2]!.captionPages).toEqual(["甲".repeat(120)]);
  for (const shot of plan.shots)
    for (const age of [0, Math.max(0, shot.scene.cues.impact - 1)])
      expect(
        renderToStaticMarkup(<VideoFrame plan={plan} frame={shot.from + age} />),
      ).not.toContain(text("zh-CN", "video.waiting"));
  expect(JSON.stringify(input)).toBe(original);
});
test("60fps fast scripts stop decoration within half a second while explicit clocks and audio keep their requested duration", () => {
  const input = document(),
    source = getVideoSourceIdentity(input);
  const fast = compileVideoPlan(input, {
    source,
    layout: "broadcast-v1",
    pacing: "narration",
    fps: 60,
  });
  expect(fast.shots[1]!.durationFrames).toBe(120);
  expect(fast.shots[1]!.scene.cues).toEqual({ establish: 0, travel: 3, impact: 7, settled: 18 });
  expect(fast.shots[3]!.scene.resolution?.revealFrame).toBe(15);
  const voiced = compileVideoPlan(input, {
    source,
    layout: "broadcast-v1",
    pacing: "narration",
    media: [{ id: "voice", kind: "audio", src: "voice.wav", durationFrames: 120 }],
    edits: [
      {
        anchor: { seq: 2, type: "guard_applied" },
        speech: [{ speaker: "god", text: "已准备旁白", assetId: "voice" }],
      },
    ],
  }).shots[1]!;
  expect(voiced.durationFrames).toBe(120);
  expect(voiced.scene.cues.settled).toBe(9);
  expect(voiced.speech[0]!.assetId).toBe("voice");
  const authored = compileVideoPlan(input, {
    source,
    layout: "broadcast-v1",
    pacing: "narration",
    edits: [{ anchor: { seq: 2, type: "guard_applied" }, durationFrames: 150 }],
  });
  expect(authored.shots[1]!.durationFrames).toBe(150);
  expect(authored.shots[1]!.scene.cues.impact).toBe(24);
  const legacy = compileVideoPlan(input, { source, layout: "broadcast-v1", pacing: "reading" });
  expect(legacy.shots[1]!.durationFrames).toBeGreaterThan(90);
  expect(legacy.shots[1]!.scene.cues.impact).toBe(24);
  expect(() => compileVideoPlan(input, { source, pacing: "slow" as "reading" })).toThrow(
    "video_pacing_invalid",
  );
});
