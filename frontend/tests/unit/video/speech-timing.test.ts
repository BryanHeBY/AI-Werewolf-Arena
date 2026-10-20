/** 字幕准备测试负责核对真实边界、分块静音与本地补齐。输入为手写时间和PCM，预期字幕编辑不重发语音请求，缺失时间不会被估造。 */
import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { segmentSpeechSubtitles, validateSpeechTimings } from "../../../src/speech-timing";
import { preparedSpeech, type SpeechProject } from "../../../src/speech";
import { prepareSpeech, speechRequests } from "../../../scripts/tts/prepare";
import { writePcmWav } from "../../../scripts/tts/wav";

function project(text = "你好，狼人。再见。🐺"): SpeechProject {
  return {
    casting: {
      god: { provider: "tencent", voiceId: 402002, name: "云大围", tier: "ultra-natural" },
    },
    lines: [{ id: "opening", speaker: "god", text }],
  };
}
test("segmentation preserves provider text and uses only real boundaries across punctuation and pauses", () => {
  const spans = [
    { text: "你好，", startMs: 100, endMs: 600 },
    { text: "狼人。", startMs: 700, endMs: 1300 },
    { text: "再见。", startMs: 1400, endMs: 2000 },
    { text: "🐺", startMs: 2600, endMs: 3000 },
  ];
  const cues = segmentSpeechSubtitles({ source: "provider", spans }, { maxCharacters: 24 });
  expect(cues).toEqual(spans);
  expect(cues.map((cue) => cue.text).join("")).toBe("你好，狼人。再见。🐺");
  expect(
    segmentSpeechSubtitles(
      {
        source: "aligned",
        spans: [
          { text: "一二", startMs: 0, endMs: 500 },
          { text: "三四", startMs: 500, endMs: 1000 },
          { text: "五六", startMs: 1501, endMs: 2000 },
        ],
      },
      { maxCharacters: 4 },
    ),
  ).toEqual([
    { text: "一二三四", startMs: 0, endMs: 1000 },
    { text: "五六", startMs: 1501, endMs: 2000 },
  ]);
  expect(() => validateSpeechTimings([{ text: "越界", startMs: 0, endMs: 1001 }], 1000)).toThrow(
    "speech_timings_invalid",
  );
  expect(() => validateSpeechTimings([{ text: "倒序", startMs: 100, endMs: 90 }])).toThrow(
    "speech_timings_invalid",
  );
  expect(() =>
    validateSpeechTimings([
      { text: "重", startMs: 0, endMs: 100 },
      { text: "叠", startMs: 90, endMs: 200 },
    ]),
  ).toThrow("speech_timings_invalid");
});
test("subframe provider cues merge with a nearby sentence without losing text or changing source timing", () => {
  const spans = [
    { text: "可4报了5、", startMs: 11265, endMs: 12705 },
    { text: "11，", startMs: 13535.084, endMs: 13565.0835 },
    { text: "也提前交代遇到对跳会调整，", startMs: 13570.126, endMs: 15215.126 },
  ];
  const original = structuredClone(spans);
  const alignment = { source: "provider" as const, spans };
  const expected = [
    spans[0]!,
    {
      text: "11，也提前交代遇到对跳会调整，",
      startMs: 13535.084,
      endMs: 15215.126,
    },
  ];
  expect(segmentSpeechSubtitles(alignment, { minDurationMs: 1000 / 30 })).toEqual(expected);
  expect(spans).toEqual(original);
  expect(expected.map((cue) => cue.text).join("")).toBe(spans.map((cue) => cue.text).join(""));
  const speech = project(spans.map((cue) => cue.text).join(""));
  const manifest = {
    opening: {
      key: "subframe",
      text: speech.lines[0]!.text,
      voice: speech.casting.god!,
      take: "1",
      gapMs: 160,
      src: "audio.wav",
      sha256: "unused-in-binding",
      samples: 480000,
      sampleRate: 24000,
      chunks: [],
      alignment,
    },
  };
  expect(preparedSpeech(speech, manifest, "opening", 30).cue.subtitles).toEqual(expected);
  speech.lines[0]!.subtitles = spans;
  expect(preparedSpeech(speech, manifest, "opening", 30).cue.subtitles).toEqual(spans);
  expect(
    segmentSpeechSubtitles(
      {
        source: "manual",
        spans: [
          { text: "末句", startMs: 0, endMs: 500 },
          { text: "。", startMs: 500, endMs: 510 },
        ],
      },
      { minDurationMs: 1000 / 30 },
    ),
  ).toEqual([{ text: "末句。", startMs: 0, endMs: 510 }]);
  expect(
    segmentSpeechSubtitles(
      {
        source: "provider",
        spans: [
          { text: "短", startMs: 0, endMs: 10 },
          { text: "相隔很久。", startMs: 1000, endMs: 2000 },
        ],
      },
      { minDurationMs: 1000 / 30 },
    ),
  ).toHaveLength(2);
  expect(() => segmentSpeechSubtitles(alignment, { minDurationMs: -1 })).toThrow(
    "speech_subtitle_options_invalid",
  );
});
test("chunk timestamps include exact inserted silence and subtitle-only edits reuse prepared audio", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "awa-timing-"));
  const speech = project("一段完整发言。".repeat(30));
  let calls = 0;
  const options = {
    project: speech,
    directory,
    manifestPath: path.join(directory, "speech.ts"),
    provider: {
      async synthesize() {
        calls++;
        return {
          audio: writePcmWav(Buffer.alloc(48000), 24000),
          alignment: {
            source: "provider" as const,
            spans: [{ text: "发言。", startMs: 100, endMs: 800 }],
          },
        };
      },
    },
  };
  try {
    const manifest = await prepareSpeech(options);
    expect(calls).toBe(2);
    expect(manifest.opening!.alignment!.spans).toEqual([
      { text: "发言。", startMs: 100, endMs: 800 },
      { text: "发言。", startMs: 1260, endMs: 1960 },
    ]);
    const key = speechRequests(speech)[0]!.key;
    speech.lines[0]!.subtitles = [{ text: "只改字幕显示", startMs: 120, endMs: 900 }];
    speech.subtitles = { maxCharacters: 12, requireTiming: true };
    expect(speechRequests(speech)[0]!.key).toBe(key);
    expect(preparedSpeech(speech, manifest, "opening", 30).cue.subtitles).toEqual(
      speech.lines[0]!.subtitles,
    );
    await prepareSpeech({ ...options, check: true });
    expect(calls).toBe(2);
    speech.lines[0]!.subtitles = false;
    expect(preparedSpeech(speech, manifest, "opening", 30).cue.subtitles).toBeUndefined();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
test("missing timing stays missing until a local aligner enriches the same cached audio", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "awa-aligner-"));
  const speech = project("原始台词。");
  speech.subtitles = { requireTiming: true };
  let calls = 0,
    alignCalls = 0;
  const options = {
    project: speech,
    directory,
    manifestPath: path.join(directory, "speech.ts"),
    provider: {
      async synthesize() {
        calls++;
        return { audio: writePcmWav(Buffer.alloc(48000), 24000) };
      },
    },
  };
  try {
    const first = await prepareSpeech(options);
    expect(first.opening!.alignment).toBeUndefined();
    expect(() => preparedSpeech(speech, first, "opening", 30)).toThrow(
      "speech_timing_missing:opening",
    );
    const next = await prepareSpeech({
      ...options,
      aligner: {
        async align({ text, audio }) {
          alignCalls++;
          expect(text).toBe("原始台词。");
          expect(audio.length).toBe(48044);
          return { source: "aligned", spans: [{ text, startMs: 50, endMs: 950 }] };
        },
      },
    });
    expect(calls).toBe(1);
    expect(alignCalls).toBe(1);
    expect(next.opening!.sha256).toBe(first.opening!.sha256);
    expect(preparedSpeech(speech, next, "opening", 30).cue.subtitles?.[0]?.text).toBe("原始台词。");
    const checked = await prepareSpeech({ ...options, check: true });
    expect(checked.opening!.alignment?.source).toBe("aligned");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
