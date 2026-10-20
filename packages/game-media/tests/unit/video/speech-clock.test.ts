/** 单元测试负责额外留白、局部重录、时间约束和失败发布验收。输入为独立PCM及镜头，预期为字面帧数和请求次数；不访问服务商。 */
import { expect, test } from "bun:test";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { scheduleSpeechScene, LEGACY_SPEECH_TIMING } from "../../../src/speech-clock";
import { retimeSpeechVisuals } from "../../../src/speech-visual-time";
import { preparedSpeech, type SpeechProject } from "../../../src/speech";
import type { VideoShot } from "../../../src/video/types";
import { prepareSpeech, speechRequests } from "../../../../../apps/video/scripts/tts/prepare";
import { speechChunkKey } from "../../../../../apps/video/scripts/tts/chunk-cache";
import { writePcmWav } from "../../../../../apps/video/scripts/tts/wav";
import { createSpeechVideoProject } from "../../../../../apps/video/scripts/video/authoring";
import { publishVideoDirectory } from "../../../../../apps/video/scripts/video/publication";

test("one clock preserves legacy 1.6 seconds and distinguishes extra silence, explicit zero and ending hold", () => {
  const line = { id: "a", speaker: "player:1" as const, durationFrames: 30 };
  expect(
    scheduleSpeechScene({ fps: 30, policy: LEGACY_SPEECH_TIMING, lines: [line] }).durationFrames,
  ).toBe(48);
  const policy = { playerGapMs: 600, lineGapMs: 250, endingHoldMs: 3000 };
  expect(
    scheduleSpeechScene({ fps: 30, policy, lines: [line], nextSpeaker: "player:2" }).durationFrames,
  ).toBe(48);
  expect(
    scheduleSpeechScene({
      fps: 30,
      policy,
      lines: [{ ...line, pauseAfterMs: 0 }],
      nextSpeaker: "player:2",
    }).durationFrames,
  ).toBe(30);
  expect(
    scheduleSpeechScene({ fps: 30, policy, lines: [line], boundary: "ending" }).durationFrames,
  ).toBe(120);
});
test("an anchored nine-frame flash stays short beside an explicitly stretched layer", () => {
  const shot = {
    durationFrames: 100,
    camera: [{ frame: 0, target: "table" }],
    layers: [
      { id: "flash", kind: "flash", from: 0, durationFrames: 9, clock: { anchor: "result" } },
      {
        id: "wash",
        kind: "flash",
        from: 10,
        durationFrames: 10,
        clock: { position: "stretch", duration: "stretch" },
      },
    ],
  } as VideoShot;
  const result = retimeSpeechVisuals(shot, 1000, { start: 0, result: 600 });
  expect(result.layers.map((layer) => [layer.from, layer.durationFrames])).toEqual([
    [600, 9],
    [100, 100],
  ]);
  expect(() => retimeSpeechVisuals(shot, 1000, { start: 0 })).toThrow(
    "speech_visual_clock_invalid",
  );
});
test("voice display edits reuse binding while a local chunk edit and gap edit reuse unchanged synthesis", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "awa-chunk-edit-"));
  let calls = 0;
  const project: SpeechProject = {
    casting: { god: { provider: "tencent", voiceId: 402002, name: "原名", tier: "ultra-natural" } },
    lines: [
      {
        id: "a",
        speaker: "god",
        text: "第一句。第二句。",
        synthesisChunks: ["第一句。", "第二句。"],
      },
    ],
  };
  const options = {
    directory,
    project,
    manifestPath: path.join(directory, "speech.ts"),
    provider: {
      async synthesize() {
        calls++;
        return { audio: writePcmWav(Buffer.alloc(48000), 24000) };
      },
    },
  };
  try {
    const manifest = await prepareSpeech(options);
    project.casting.god = { ...project.casting.god!, name: "新名字", sampleRate: 24000 };
    expect(preparedSpeech(project, manifest, "a", 30).durationFrames).toBe(65);
    expect(speechRequests(project)[0]!.key).toBe(manifest.a!.key);
    project.lines[0]!.synthesisChunks = ["第一句。第二句。"];
    expect(() => preparedSpeech(project, manifest, "a", 30)).toThrow("speech_stale:a");
    project.lines[0]!.synthesisChunks = ["第一句。", "第二句。"];
    await rm(path.join(directory, "chunks"), { recursive: true });
    for (const index of [0, 1])
      await writeFile(
        path.join(directory, `${manifest.a!.key}.${index}.wav`),
        writePcmWav(Buffer.alloc(48000), 24000),
      );
    await prepareSpeech(options);
    expect(calls).toBe(2);
    project.lines[0]!.text = "第一句。第三句。";
    project.lines[0]!.synthesisChunks![1] = "第三句。";
    await prepareSpeech(options);
    expect(calls).toBe(3);
    project.chunkGapMs = 600;
    const assembled = await prepareSpeech(options);
    expect(calls).toBe(3);
    expect(assembled.a!.samples).toBe(62400);
    expect((await readFile(options.manifestPath, "utf8")).length).toBeLessThan(1000);
    const key = speechChunkKey("第一句。", project.casting.god!, "1");
    await rm(path.join(directory, "chunks", key, "audio.wav"));
    project.chunkGapMs = 700;
    await expect(prepareSpeech(options)).rejects.toThrow("tts_chunk_cache_corrupt");
    expect(calls).toBe(3);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
test("declarative project creation never reads a missing replay, and failed candidate validation publishes nothing", async () => {
  const source = { sessionId: "local", fingerprint: "locked" };
  const definition = createSpeechVideoProject(
    { input: "missing.json", script: { source } },
    {
      header: { type: "script", version: 1, source, chunkGapMs: 0 },
      scenes: [],
    },
  );
  expect(definition.speech?.document.header.source).toEqual(source);
  const directory = await mkdtemp(path.join(os.tmpdir(), "awa-publication-test-"));
  try {
    await expect(
      publishVideoDirectory(directory, async (candidate) => {
        await writeFile(path.join(candidate, "voice.wav"), "candidate");
        throw new Error("invalid_subtitle");
      }),
    ).rejects.toThrow("invalid_subtitle");
    expect(await readdir(directory)).toEqual([]);
    const build = async (candidate: string) => {
      await writeFile(path.join(candidate, "report.json"), "complete");
      return { name: "v1", value: "published" };
    };
    expect(await publishVideoDirectory(directory, build)).toBe("published");
    expect(await publishVideoDirectory(directory, build)).toBe("published");
    await expect(
      publishVideoDirectory(directory, async (candidate) => {
        await writeFile(path.join(candidate, "report.json"), "different");
        return { name: "v1", value: "conflict" };
      }),
    ).rejects.toThrow("video_version_conflict");
    expect(await readFile(path.join(directory, "v1/report.json"), "utf8")).toBe("complete");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
