/**
 * 单元测试负责发言阅读策略的脚本校验、全局/逐段覆盖与纯帧兼容。输入为独立手写原话、事实和显式作者窗口，输出字面元数据及游标/语音不变断言。
 * 本层不测量DOM行高、不计算像素位移；旧计划返回形状、静态/连续选择和30/60帧率换算均独立核对。
 */
import { expect, test } from "bun:test";
import type { ReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { compileVideoPlan } from "../../../src/video/compiler";
import { buildVideoFrame } from "../../../src/video/frame";
import { getVideoSourceIdentity } from "../../../src/video/source";
import { videoReadingProgress } from "../../../src/video/captions";
import type {
  VideoReading,
  VideoScript,
  VideoSpeechReadingOptions,
} from "../../../src/video/types";

function replay(): ReplayDocument {
  return {
    schemaVersion: 2,
    sessionId: "speech-reading",
    perspective: "god",
    meta: { board: "test", startedAt: "s", endedAt: "e", locale: "zh-CN" },
    result: { winner: null, reason: null },
    players: [{ player_id: 1, role: "seer", camp: "good" }],
    events: [
      {
        seq: 1,
        timestamp: "2026-10-19T00:00:00Z",
        day: 1,
        phase: "day",
        type: "day_speech",
        payload: { actorId: 1, text: "甲".repeat(120) },
      },
      {
        seq: 2,
        timestamp: "2026-10-19T00:00:01Z",
        day: 1,
        phase: "night",
        type: "phase_changed",
        payload: { phase: "night" },
      },
      {
        seq: 3,
        timestamp: "2026-10-19T00:00:02Z",
        day: 1,
        phase: "night",
        type: "wolf_discussion_ended",
        payload: { actorId: 1, reason: "乙".repeat(120), round: 1 },
      },
    ],
    factCoverage: { committedDeaths: 1 },
    facts: [
      {
        seq: 1,
        afterSeq: 2,
        kind: "potion_stock",
        day: 1,
        actorId: 1,
        abilityId: "explicit-instance",
        heal: 0,
        poison: 1,
      },
    ],
  };
}
function compile(options: Omit<VideoScript, "source"> = {}) {
  const document = replay();
  return compileVideoPlan(document, {
    source: getVideoSourceIdentity(document),
    layout: "broadcast-v1",
    ...options,
  });
}

test("new automatic speech defaults to line motion with FPS-scaled transition but other scene clocks do not change", () => {
  for (const [fps, transitionFrames, durationFrames, hold] of [
    [30, 5, 450, 90],
    [60, 9, 900, 180],
  ] as const) {
    const plan = compile({ fps });
    expect(plan.shots[0]!.reading).toEqual({
      version: 1,
      mode: "flow",
      from: 0,
      durationFrames,
      headHoldFrames: hold,
      tailHoldFrames: hold,
      motion: "line",
      transitionFrames,
    });
    expect(plan.shots[1]!.reading?.motion).toBeUndefined();
    expect(plan.shots[2]!.reading?.motion).toBe("line");
    expect(plan.shots[0]!.captionPages).toEqual(["甲".repeat(120)]);
    expect(plan.shots[0]!.speech[0]?.speaker).toBe("player:1");
    expect(plan.shots[2]!.speech[0]?.speaker).toBe("player:1");
    expect(plan.shots[2]!.captionPages).toEqual(["乙".repeat(120)]);
    expect(buildVideoFrame(plan, 0).reading).toEqual({
      progress: 0,
      scrollProgress: 0,
      active: true,
      motion: "line",
      transitionFrames,
      scrollFrames: durationFrames - hold * 2,
    });
    expect(JSON.parse(JSON.stringify(plan))).toEqual(plan);
  }
});

test("per-shot complete policy overrides the global choice without changing state, speech, source or reading budgets", () => {
  const baseline = compile();
  const changed = compile({
    speechReading: { motion: "continuous", transitionFrames: 17 },
    edits: [
      { anchor: { seq: 3, type: "wolf_discussion_ended" }, speechReading: { motion: "static" } },
    ],
  });
  expect(changed.shots[0]!.reading?.motion).toBe("continuous");
  expect(changed.shots[0]!.reading?.transitionFrames).toBe(17);
  expect(changed.shots[2]!.reading?.motion).toBe("static");
  expect(changed.shots[2]!.reading?.transitionFrames).toBe(0);
  expect(changed.source).toEqual(baseline.source);
  expect(changed.eventFrames).toEqual(baseline.eventFrames);
  expect(changed.audio).toEqual(baseline.audio);
  expect(changed.durationFrames).toBe(baseline.durationFrames);
  for (let index = 0; index < baseline.shots.length; index++) {
    const first = baseline.shots[index]!,
      second = changed.shots[index]!;
    expect(second.stateCues).toEqual(first.stateCues);
    expect(second.speech).toEqual(first.speech);
    expect(second.scene).toEqual(first.scene);
    expect(second.sourceSeqs).toEqual(first.sourceSeqs);
    expect(second.sourceFacts).toEqual(first.sourceFacts);
    expect(second.captionPages).toEqual(first.captionPages);
  }
  const snap = buildVideoFrame(changed, changed.shots[2]!.from + 225);
  expect([snap.sourceSeq, snap.sourceFactSeq]).toEqual([3, 1]);
  expect(snap.reading?.motion).toBe("static");
  const instant = compile({ speechReading: { motion: "line", transitionFrames: 0 } });
  expect(instant.shots[0]!.reading?.transitionFrames).toBe(0);
});

test("legacy prepared reading preserves its exact continuous progress shape and new metadata remains seek-pure", () => {
  const old: VideoReading = {
    version: 1,
    mode: "flow",
    from: 20,
    durationFrames: 300,
    headHoldFrames: 60,
    tailHoldFrames: 60,
  };
  expect(videoReadingProgress(old, 170)).toEqual({
    progress: 0.5,
    scrollProgress: 0.5,
    active: true,
  });
  const modern = { ...old, motion: "line" as const, transitionFrames: 5 };
  const expected = {
    progress: 0.5,
    scrollProgress: 0.5,
    active: true,
    motion: "line" as const,
    transitionFrames: 5,
    scrollFrames: 180,
  };
  expect(videoReadingProgress(modern, 170)).toEqual(expected);
  expect(videoReadingProgress(modern, 0).scrollProgress).toBe(0);
  expect(videoReadingProgress(modern, 500).scrollProgress).toBe(1);
  expect(videoReadingProgress(modern, 170)).toEqual(expected);
  expect(old).not.toHaveProperty("motion");
});

test("global speech policy leaves legacy layout, explicit duration, pagination and holds on their original contracts", () => {
  const policy = { motion: "static" as const };
  const legacy = compile({ layout: "legacy-ellipse-v1", speechReading: policy });
  expect(legacy.shots.every((shot) => shot.reading === undefined)).toBe(true);
  const paged = compile({ captionPageFrames: 90, speechReading: policy });
  expect(paged.shots[0]!.reading).toBeUndefined();
  expect(paged.shots[0]!.captionPages).toEqual(["甲".repeat(108), "甲".repeat(12)]);
  const manual = compile({
    speechReading: policy,
    edits: [{ anchor: { seq: 1, type: "day_speech" }, durationFrames: 10 }],
  });
  expect(manual.shots[0]!.reading).toBeUndefined();
  expect(manual.shots[0]!.durationFrames).toBe(10);
  const held = compile({
    speechReading: policy,
    holds: [{ id: "recall", after: { seq: 1, type: "day_speech" }, durationFrames: 30 }],
  });
  expect(held.shots.find((shot) => shot.id === "hold:recall")!.reading).toBeUndefined();
});

test("invalid motion and transition values reject globally and locally and explicit unavailable windows report errors", () => {
  for (const value of [
    null,
    [],
    {},
    { motion: "jump" },
    { motion: ["line"] },
    { motion: "line", transitionFrame: 5 },
    { motion: "static", unknown: true },
    { motion: "line", transitionFrames: -1 },
    { motion: "line", transitionFrames: 1.5 },
    { motion: "line", transitionFrames: Infinity },
    { motion: "line", transitionFrames: "5" },
  ]) {
    const invalid = value as VideoSpeechReadingOptions;
    expect(() => compile({ speechReading: invalid })).toThrow("video_speech_reading_");
    expect(() =>
      compile({ edits: [{ anchor: { seq: 1, type: "day_speech" }, speechReading: invalid }] }),
    ).toThrow("video_speech_reading_");
  }
  for (const options of [
    {
      edits: [
        { anchor: { seq: 2, type: "phase_changed" }, speechReading: { motion: "line" as const } },
      ],
    },
    {
      edits: [
        {
          anchor: { seq: 1, type: "day_speech" },
          speechReading: { motion: "line" as const },
          durationFrames: 90,
        },
      ],
    },
    {
      captionPageFrames: 90,
      edits: [
        { anchor: { seq: 1, type: "day_speech" }, speechReading: { motion: "line" as const } },
      ],
    },
    {
      holds: [
        {
          id: "manual",
          after: { seq: 1, type: "day_speech" },
          durationFrames: 90,
          speechReading: { motion: "line" as const },
        },
      ],
    },
  ])
    expect(() => compile(options)).toThrow("video_speech_reading_unavailable");
});
