/**
 * 单元层负责新广播自动字幕的真实字宽与静止阅读时钟；输入独立中文长稿与FPS，输出字面页边界和完整原文。
 * 不使用渲染器或从实现生成预期；同时锁定晚揭晓、固定作者预算和旧椭圆脚本兼容，避免时长修复吞原话。
 */
import { expect, test } from "bun:test";
import type { ReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { compileVideoPlan } from "../../../src/video/compiler";
import { buildVideoFrame } from "../../../src/video/frame";
import { getVideoSourceIdentity } from "../../../src/video/source";
import { paginateVideoCaption } from "../../../src/video/captions";
function replay(
  type = "phase_changed",
  payload: Record<string, unknown> = { phase: "night" },
): ReplayDocument {
  return {
    schemaVersion: 2,
    perspective: "god",
    sessionId: "read",
    meta: { board: "test", startedAt: "s", endedAt: "e", locale: "zh-CN" },
    result: { winner: null, reason: null },
    players: [{ player_id: 1, role: "seer", camp: "good" }],
    events: [{ seq: 1, timestamp: "2026-10-17T00:00:00Z", type, payload, day: 1, phase: "night" }],
  };
}
test("a known neutral notice reads immediately for at least three seconds while explicit clocks and unknown events keep their defaults", () => {
  const document = replay("wolf_discussion_ended", {
    actorId: 1,
    reason: "End discussion",
    round: 1,
  });
  const source = getVideoSourceIdentity(document);
  for (const fps of [30, 60]) {
    const shot = compileVideoPlan(document, { source, layout: "broadcast-v1", fps }).shots[0]!;
    expect(shot.scene.cues).toEqual({ establish: 0, travel: 0, impact: 0, settled: 0 });
    expect(shot.durationFrames).toBe(fps * 3);
    expect(shot.captionPageRanges).toEqual([{ from: 0, durationFrames: fps * 3 }]);
    expect(
      buildVideoFrame(compileVideoPlan(document, { source, layout: "broadcast-v1", fps }), 0)
        .sourceSeq,
    ).toBe(1);
  }
  const explicit = compileVideoPlan(document, {
    source,
    layout: "broadcast-v1",
    edits: [{ anchor: { seq: 1, type: "wolf_discussion_ended" }, durationFrames: 150 }],
  }).shots[0]!;
  expect(explicit.durationFrames).toBe(150);
  expect(explicit.scene.cues).toEqual({ establish: 0, travel: 8, impact: 24, settled: 40 });
  const cue = compileVideoPlan(document, {
    source,
    layout: "broadcast-v1",
    edits: [
      {
        anchor: { seq: 1, type: "wolf_discussion_ended" },
        scene: { cues: { impact: 50, settled: 60 } },
      },
    ],
  }).shots[0]!;
  expect(cue.scene.cues).toEqual({ establish: 0, travel: 8, impact: 50, settled: 60 });
  expect(cue.durationFrames).toBe(150);
  expect(compileVideoPlan(replay("future_unknown_notice", {})).shots[0]!.scene.cues).toEqual({
    establish: 0,
    travel: 8,
    impact: 24,
    settled: 40,
  });
});
test("automatic 42px reading pages preserve all 120 characters and the first page has 248 still frames after settled", () => {
  const document = replay();
  const plan = compileVideoPlan(document, {
    source: getVideoSourceIdentity(document),
    layout: "broadcast-v1",
    edits: [{ anchor: { seq: 1, type: "phase_changed" }, caption: "甲".repeat(120) }],
  });
  const shot = plan.shots[0]!;
  expect(shot.captionPages).toEqual(["甲".repeat(66), "甲".repeat(54)]);
  expect(shot.captionPages.join("")).toBe("甲".repeat(120));
  expect(shot.durationFrames).toBe(491);
  expect(shot.scene.cues).toEqual({ establish: 0, travel: 8, impact: 24, settled: 40 });
  expect(shot.captionPageRanges).toEqual([
    { from: 24, durationFrames: 264 },
    { from: 288, durationFrames: 203 },
  ]);
  expect(buildVideoFrame(plan, 287).captionPageIndex).toBe(0);
  expect(buildVideoFrame(plan, 288).captionPageIndex).toBe(1);
  expect(buildVideoFrame(plan, 490).caption).toBe("甲".repeat(54));
});
test("late impact retains the full first page and follows final scene kind with deterministic FPS conversion", () => {
  const document = replay();
  const make = (fps: number) =>
    compileVideoPlan(document, {
      source: getVideoSourceIdentity(document),
      layout: "broadcast-v1",
      fps,
      edits: [
        {
          anchor: { seq: 1, type: "phase_changed" },
          caption: "甲".repeat(120),
          scene: { cues: { travel: 80, impact: 120, settled: 150 } },
        },
      ],
    });
  const late = make(30);
  expect(late.shots[0]!.durationFrames).toBe(601);
  expect(late.shots[0]!.captionPageRanges).toEqual([
    { from: 120, durationFrames: 278 },
    { from: 398, durationFrames: 203 },
  ]);
  expect(buildVideoFrame(late, 397).captionPageIndex).toBe(0);
  expect(buildVideoFrame(late, 398).captionPageIndex).toBe(1);
  const sixty = compileVideoPlan(document, {
    source: getVideoSourceIdentity(document),
    layout: "broadcast-v1",
    fps: 60,
    edits: [{ anchor: { seq: 1, type: "phase_changed" }, caption: "甲".repeat(120) }],
  });
  expect(sixty.shots[0]!.scene.cues).toEqual({ establish: 0, travel: 16, impact: 48, settled: 80 });
  expect(sixty.shots[0]!.durationFrames).toBe(980);
  expect(sixty.shots[0]!.captionPageRanges).toEqual([
    { from: 48, durationFrames: 527 },
    { from: 575, durationFrames: 405 },
  ]);
});
test("speech begins at zero while author timing, explicit pagination and old scripts keep their original clock", () => {
  const document = replay("day_speech", { actorId: 1, text: "甲".repeat(120) });
  const automatic = compileVideoPlan(document);
  expect(automatic.shots[0]!.durationFrames).toBe(451);
  expect(automatic.shots[0]!.captionPageRanges).toEqual([
    { from: 0, durationFrames: 248 },
    { from: 248, durationFrames: 203 },
  ]);
  const explicit = compileVideoPlan(document, {
    source: getVideoSourceIdentity(document),
    layout: "broadcast-v1",
    edits: [{ anchor: { seq: 1, type: "day_speech" }, durationFrames: 10 }],
  });
  expect(explicit.shots[0]!.durationFrames).toBe(10);
  expect(explicit.shots[0]!.captionPages).toEqual(["甲".repeat(108), "甲".repeat(12)]);
  expect(explicit.shots[0]!.captionPageRanges).toBeUndefined();
  const legacy = compileVideoPlan(document, {
    source: getVideoSourceIdentity(document),
    captionPageFrames: 90,
  });
  expect(legacy.layout).toBe("legacy-ellipse-v1");
  expect(legacy.shots[0]!.captionPageRanges).toBeUndefined();
  expect(legacy.shots[0]!.durationFrames).toBe(180);
});
test("English words remain whole at automatic page boundaries and prepared voice gets an explicit tail", () => {
  const body = "abcdefgh ".repeat(40);
  const document = replay("day_speech", { actorId: 1, text: body });
  const plan = compileVideoPlan(document);
  expect(plan.shots[0]!.captionPages.join("")).toBe(body);
  for (const page of plan.shots[0]!.captionPages)
    expect(page.trim()).toMatch(/^abcdefgh(?: abcdefgh)*$/);
  const short = replay("day_speech", { actorId: 1, text: "你好" });
  const voiced = compileVideoPlan(short, {
    source: getVideoSourceIdentity(short),
    layout: "broadcast-v1",
    media: [{ id: "prepared", kind: "audio", src: "voice.wav", durationFrames: 300 }],
    edits: [
      {
        anchor: { seq: 1, type: "day_speech" },
        speech: [{ speaker: "player:1", text: "独立已准备音轨", assetId: "prepared" }],
      },
    ],
  });
  expect(voiced.shots[0]!.durationFrames).toBe(312);
  expect(voiced.shots[0]!.speech[0]!.durationFrames).toBe(300);
  expect(voiced.audio[0]!.durationFrames).toBe(300);
});
test("word-aware pages never divide one Unicode code point into isolated surrogate halves", () => {
  expect(paginateVideoCaption("a😀b", 3, 1, true)).toEqual(["a😀", "b"]);
  expect(paginateVideoCaption("a😀b", 2, 1, true)).toEqual(["a", "😀", "b"]);
  const body = "a😀b ".repeat(40);
  const pages = paginateVideoCaption(body, 11, 2, true);
  expect(pages.join("")).toBe(body);
  for (const page of pages)
    expect(
      [...page].every((glyph) => glyph.codePointAt(0)! < 0xd800 || glyph.codePointAt(0)! > 0xdfff),
    ).toBe(true);
});
