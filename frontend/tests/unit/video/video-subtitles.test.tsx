/** 视频字幕测试负责核对局部时间平移和可逆定位。输入为手写片头、已备时间戳与实际音频时长，预期底部字幕不改中央规则或游戏事实。 */
import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { buildVideoFrame, compileVideoPlan, getVideoSourceIdentity } from "../../../src/video/plan";
import { VideoFrame } from "../../../src/video/VideoComposition";
import {
  compileVideoSubtitles,
  videoSubtitleAt,
  videoSubtitlesSrt,
} from "../../../src/video/subtitles";
import { bindVideoSpeech, speechProjectFromPlan, type SpeechManifest } from "../../../src/speech";
import type { VideoScript } from "../../../src/video/types";

function fixture(leadFrames = 60) {
  const replay: ReplayDocument = {
    schemaVersion: 2,
    perspective: "god",
    sessionId: "subtitles",
    meta: { board: "test", startedAt: "s", endedAt: "e" },
    result: { winner: null, reason: null },
    players: [{ player_id: 1, role: "villager", camp: "good" }],
    events: [
      {
        seq: 1,
        type: "phase_changed",
        payload: { phase: "night", day: 1 },
        timestamp: "t",
        day: 1,
        phase: "night",
      },
    ],
  };
  const script: VideoScript = {
    source: getVideoSourceIdentity(replay),
    layout: "broadcast-v1",
    fps: 30,
    intro: [
      { id: "lead", durationFrames: leadFrames, caption: "十二位玩家", speech: [] },
      {
        id: "rules",
        durationFrames: 120,
        readingClock: "flow",
        scene: {
          kind: "phase",
          title: "狼美人骑士",
          body: "完整规则保留在舞台中央。骑士决斗不会触发狼美人的牵连。",
        },
        speech: [{ speaker: "god", text: "规则看屏幕。开始。", from: 15 }],
      },
    ],
    edits: [{ anchor: { seq: 1, type: "phase_changed" }, speech: [] }],
  };
  const initial = compileVideoPlan(replay, script);
  const dialogue = speechProjectFromPlan(initial, {
    god: {
      provider: "volcengine",
      voiceId: "zh_male_m191_uranus_bigtts",
      name: "云舟2.0",
      resourceId: "seed-tts-2.0",
    },
  });
  const line = dialogue.lines[0]!;
  const manifest: SpeechManifest = {
    [line.id]: {
      key: "audio-identity",
      text: line.text,
      voice: dialogue.casting.god!,
      take: "1",
      gapMs: 160,
      src: "voice.wav",
      sha256: "sample-hash",
      samples: 48000,
      sampleRate: 24000,
      chunks: [{ text: line.text, fromSample: 0, samples: 48000 }],
      alignment: {
        source: "provider",
        spans: [
          { text: "规则看屏幕。", startMs: 100, endMs: 900 },
          { text: "开始。", startMs: 1200, endMs: 1800 },
        ],
      },
    },
  };
  const bound = bindVideoSpeech(script, initial, dialogue, manifest);
  return { replay, bound, plan: compileVideoPlan(replay, bound) };
}
test("subtitles use shot plus speech offsets, have half-open boundaries and follow earlier timing edits", () => {
  const { plan } = fixture();
  expect(
    plan.subtitles?.map(({ from, durationFrames, text }) => ({ from, durationFrames, text })),
  ).toEqual([
    { from: 78, durationFrames: 24, text: "规则看屏幕。" },
    { from: 111, durationFrames: 18, text: "开始。" },
  ]);
  expect(plan.audio[0]!.from).toBe(75);
  expect(videoSubtitleAt(plan, 77)).toBeUndefined();
  expect(videoSubtitleAt(plan, 78)?.text).toBe("规则看屏幕。");
  expect(videoSubtitleAt(plan, 102)).toBeUndefined();
  expect(videoSubtitleAt(plan, 120)?.text).toBe("开始。");
  expect(videoSubtitleAt(plan, 78)?.text).toBe("规则看屏幕。");
  const later = fixture(150).plan;
  expect(later.subtitles![0]!.from - plan.subtitles![0]!.from).toBe(90);
  expect(later.audio[0]!.from - plan.audio[0]!.from).toBe(90);
  expect(later.shots[1]!.scene.body).toBe(plan.shots[1]!.scene.body);
  const during = buildVideoFrame(plan, 78).layout;
  expect(buildVideoFrame(plan, 104).layout).toEqual(during);
  const original = buildVideoFrame({ ...plan, subtitles: undefined }, 78).layout;
  expect(during.seats).toEqual(original.seats);
  expect(during.stage.height).toBeLessThan(original.stage.height);
  expect(during.stage.y + during.stage.height).toBeLessThan(plan.height - 56 - 2 * 36 * 1.4 - 8);
});
test("the frame renders spoken subtitles and complete stage rules independently and SRT uses the same clock", () => {
  const { plan } = fixture();
  const frame = renderToStaticMarkup(<VideoFrame plan={plan} frame={78} />);
  expect(frame).toContain('data-testid="video-subtitle"');
  expect(frame).toContain("规则看屏幕。");
  expect(frame.replace(/<[^>]*>/g, "")).toContain("完整规则保留在舞台中央。");
  expect(renderToStaticMarkup(<VideoFrame plan={plan} frame={104} />)).not.toContain(
    'data-testid="video-subtitle"',
  );
  expect(videoSubtitlesSrt(plan)).toBe(
    "1\n00:00:02,600 --> 00:00:03,400\n规则看屏幕。\n\n2\n00:00:03,700 --> 00:00:04,300\n开始。\n",
  );
});
test("out-of-audio and overlapping subtitle overrides fail before export", () => {
  const { replay, bound } = fixture();
  const cue = bound.shotEdits!.find((edit) => edit.id === "intro:rules")!.speech![0]!;
  cue.subtitles = [{ text: "越界", startMs: 0, endMs: 2100 }];
  expect(() => compileVideoPlan(replay, bound)).toThrow("speech_timings_invalid");
  cue.subtitles = [
    { text: "一", startMs: 0, endMs: 900 },
    { text: "二", startMs: 800, endMs: 1000 },
  ];
  expect(() => compileVideoPlan(replay, bound)).toThrow("speech_timings_invalid");
});
test("subtitle tails linger briefly, yield to the next cue and leave long silences empty", () => {
  const { replay, bound, plan: original } = fixture();
  bound.subtitles = { lingerMs: 400 };
  const plan = compileVideoPlan(replay, bound);
  expect(plan.subtitles?.map(({ from, durationFrames }) => ({ from, durationFrames }))).toEqual([
    { from: 78, durationFrames: 33 },
    { from: 111, durationFrames: 30 },
  ]);
  expect(plan.audio).toEqual(original.audio);
  expect(plan.durationFrames).toBe(original.durationFrames);
  expect(plan.shots[1]!.speech).toEqual(original.shots[1]!.speech);
  expect(videoSubtitleAt(plan, 110)?.text).toBe("规则看屏幕。");
  expect(videoSubtitleAt(plan, 111)?.text).toBe("开始。");
  expect(videoSubtitleAt(plan, 140)?.text).toBe("开始。");
  expect(videoSubtitleAt(plan, 141)).toBeUndefined();
  expect(renderToStaticMarkup(<VideoFrame plan={plan} frame={104} />)).toContain("规则看屏幕。");
  expect(videoSubtitlesSrt(plan)).toBe(
    "1\n00:00:02,600 --> 00:00:03,700\n规则看屏幕。\n\n2\n00:00:03,700 --> 00:00:04,700\n开始。\n",
  );
  const shots = structuredClone(plan.shots.slice(0, 2));
  shots[1]!.durationFrames = 75;
  const clipped = compileVideoSubtitles(shots, 30, { lingerMs: 400 });
  expect(clipped[1]).toMatchObject({ from: 111, durationFrames: 24 });
  expect(() => compileVideoSubtitles(shots, 30, { lingerMs: -1 })).toThrow(
    "video_subtitle_linger_invalid",
  );
});
test("isolated subframe words retain one frame and same-frame words merge without changing provider timing", () => {
  const shots = structuredClone(fixture().plan.shots.slice(0, 2));
  const speech = shots[1]!.speech[0]!;
  speech.subtitles = [
    { text: "7、", startMs: 101, endMs: 120 },
    { text: "后面的句子。", startMs: 1200, endMs: 1800 },
  ];
  const original = structuredClone(speech.subtitles);
  expect(compileVideoSubtitles(shots, 30)).toMatchObject([
    { text: "7、", from: 79, durationFrames: 1 },
    { text: "后面的句子。", from: 111, durationFrames: 18 },
  ]);
  expect(speech.subtitles).toEqual(original);
  speech.subtitles = [
    { text: "7、", startMs: 101, endMs: 110 },
    { text: "10、", startMs: 120, endMs: 190 },
    { text: "末句", startMs: 1900, endMs: 1970 },
    { text: "。", startMs: 1970, endMs: 1990 },
  ];
  expect(compileVideoSubtitles(shots, 30)).toMatchObject([
    { text: "7、10、", from: 79, durationFrames: 2 },
    { text: "末句。", from: 132, durationFrames: 3 },
  ]);
});
