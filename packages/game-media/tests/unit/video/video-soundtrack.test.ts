/** 单元测试验证配乐锚点与离线叠加。输入为本地合成音，预期为原语音不移位、恒定音乐和限定节点音效；不访问素材站或TTS。 */
import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { SpeechTimeline } from "../../../src/speech-script";
import {
  mixVideoSoundtrack,
  soundtrackAnchorSample,
  soundtrackLoop,
} from "../../../../../apps/video/scripts/video/soundtrack";
import { writePcmWav } from "../../../../../apps/video/scripts/tts/wav";

const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
function timeline(): SpeechTimeline {
  return {
    version: 1,
    source: { sessionId: "local", fingerprint: "test" },
    timing: "audio",
    fps: 30,
    durationFrames: 120,
    scenes: [
      {
        id: "opening",
        from: 0,
        durationFrames: 120,
        lines: [
          {
            id: "result",
            speaker: "god",
            text: "结果",
            from: 30,
            durationFrames: 30,
            pauseFrames: 0,
          },
        ],
      },
    ],
  };
}
test("sound cues follow actual line offsets and reject missing or out-of-film anchors", () => {
  const input = timeline(),
    before = JSON.stringify(input);
  expect(
    soundtrackAnchorSample(input, { sceneId: "opening", lineId: "result", offsetMs: 400 }, 24000),
  ).toBe(33600);
  expect(() => soundtrackAnchorSample(input, { sceneId: "absent" }, 24000)).toThrow(
    "soundtrack_scene_missing",
  );
  expect(() =>
    soundtrackAnchorSample(input, { sceneId: "opening", lineId: "absent" }, 24000),
  ).toThrow("soundtrack_line_missing");
  expect(() => soundtrackAnchorSample(input, { sceneId: "opening", offsetMs: -1 }, 24000)).toThrow(
    "soundtrack_anchor_out_of_range",
  );
  expect(JSON.stringify(input)).toBe(before);
});
test("crossfaded loops keep stereo channels and bridge the loop boundary without a jump", () => {
  const source = new Float32Array(400);
  for (let frame = 0; frame < 200; frame++) {
    source[frame * 2] = frame / 200;
    source[frame * 2 + 1] = -frame / 200;
  }
  const loop = soundtrackLoop(source, 100, 0.2);
  expect(loop.length).toBe(360);
  expect(Math.abs(loop[0]! - loop[loop.length - 2]!)).toBeLessThan(0.006);
  for (let frame = 0; frame < loop.length / 2; frame++)
    expect(loop[frame * 2 + 1]).toBe(-loop[frame * 2]!);
  expect(source[398]).toBeCloseTo(0.995);
});
test("local mix preserves voice timing, leaves the music independent of speech and places only the selected effect", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "awa-soundtrack-"));
  const rate = 8000;
  const sine = (seconds: number, frequency: number, volume: number, quietTail = false) => {
    const pcm = Buffer.alloc(seconds * rate * 2);
    for (let i = 0; i < seconds * rate; i++) {
      const active = !quietTail || (i < rate * 3.5 && (i < rate || i >= rate * 2));
      pcm.writeInt16LE(
        active ? Math.round(Math.sin((2 * Math.PI * frequency * i) / rate) * volume * 32767) : 0,
        i * 2,
      );
    }
    return writePcmWav(pcm, rate);
  };
  try {
    const voice = sine(4, 500, 0.2, true),
      music = sine(2, 100, 0.2),
      effect = sine(0.25, 1500, 0.2);
    const voiceFile = path.join(directory, "voice.wav"),
      timelineFile = path.join(directory, "timeline.json"),
      libraryFile = path.join(directory, "library.json");
    await writeFile(voiceFile, voice);
    await writeFile(path.join(directory, "music.wav"), music);
    await writeFile(path.join(directory, "effect.wav"), effect);
    await writeFile(
      timelineFile,
      JSON.stringify({
        ...timeline(),
        audio: { file: voiceFile, sha256: sha(voice), sampleRate: rate, samples: rate * 4 },
      }),
    );
    await writeFile(
      libraryFile,
      JSON.stringify({
        assets: [
          ["music", music],
          ["effect", effect],
        ].map(([id, bytes]) => ({
          id,
          kind: id === "music" ? "music" : "sfx",
          file: `${id}.wav`,
          sha256: sha(bytes as Uint8Array),
          title: id,
          author: "Local fixture",
          sourceUrl: "local:test",
          license: "Local",
          licenseUrl: "local:license",
          modifications: "Source excerpt trimmed for the fixture.",
        })),
      }),
    );
    const soundtrack = {
      library: libraryFile,
      musicTransition: { mode: "sequential" as const, gapMs: 200 },
      music: [
        { id: "bed", assetId: "music", from: { sceneId: "opening" }, rmsDb: -39, fadeMs: 20 },
        {
          id: "next-bed",
          assetId: "music",
          from: { sceneId: "opening", lineId: "result" },
          rmsDb: -39,
          fadeMs: 20,
        },
      ],
      effects: [
        { id: "hit", assetId: "effect", at: { sceneId: "opening", lineId: "result" }, peakDb: -23 },
      ],
      endingFadeMs: 100,
      endingSilenceMs: 200,
    };
    const report = await mixVideoSoundtrack({
      timeline: timelineFile,
      soundtrack,
      directory: path.join(directory, "versions"),
    });
    expect(report.ducking).toBe(false);
    expect(report.samples).toBe(rate * 4);
    expect(report.masterGain).toBe(1);
    const credits = await readFile(path.join(report.directory, "credits.txt"), "utf8");
    expect(credits).toContain("Source excerpt trimmed for the fixture.");
    expect(credits).toContain("Volume adjusted, faded and mixed into the video.");
    expect(report.music[0]!.to).toBe(7200);
    expect(report.music[1]!.from).toBe(8800);
    const crossfade = await mixVideoSoundtrack({
      timeline: timelineFile,
      soundtrack: { ...soundtrack, musicTransition: undefined },
      directory: path.join(directory, "versions"),
    });
    expect(crossfade.music[0]!.to).toBe(8080);
    expect(crossfade.music[1]!.from).toBe(7920);
    expect(report.effects[0]!.from).toBe(rate);
    const [mixed, bed, sfx] = await Promise.all(
      [report.master, report.stems.music, report.stems.effects].map((file) => readFile(file)),
    );
    // FFmpeg的WAV包含附加块，找到data块而不假定44字节头。
    const data = (bytes: Buffer) => {
      let offset = 12;
      while (bytes.toString("ascii", offset, offset + 4) !== "data")
        offset += 8 + bytes.readUInt32LE(offset + 4) + (bytes.readUInt32LE(offset + 4) % 2);
      return bytes.subarray(offset + 8, offset + 8 + bytes.readUInt32LE(offset + 4));
    };
    const output = data(mixed),
      musicPcm = data(bed),
      effectPcm = data(sfx),
      voicePcm = data(voice);
    expect(output.length).toBe(rate * 4 * 4);
    let maxError = 0,
      misplacedEffectPeak = 0,
      tailPeak = 0,
      transitionPeak = 0;
    for (let frame = 0; frame < rate * 4; frame++) {
      for (let channel = 0; channel < 2; channel++) {
        const pos = (frame * 2 + channel) * 2;
        const expected =
          voicePcm.readInt16LE(frame * 2) + musicPcm.readInt16LE(pos) + effectPcm.readInt16LE(pos);
        maxError = Math.max(maxError, Math.abs(output.readInt16LE(pos) - expected));
        if (frame < rate || frame >= rate * 1.25)
          misplacedEffectPeak = Math.max(misplacedEffectPeak, Math.abs(effectPcm.readInt16LE(pos)));
        if (frame >= rate * 3.8) tailPeak = Math.max(tailPeak, Math.abs(output.readInt16LE(pos)));
        if (frame >= 7200 && frame < 8800)
          transitionPeak = Math.max(transitionPeak, Math.abs(musicPcm.readInt16LE(pos)));
      }
    }
    expect(maxError).toBeLessThanOrEqual(2);
    expect(misplacedEffectPeak).toBe(0);
    expect(tailPeak).toBe(0);
    expect(transitionPeak).toBe(0);
    const rms = (from: number) => {
      let sum = 0;
      for (let frame = from; frame < from + rate / 2; frame++)
        sum += musicPcm.readInt16LE(frame * 4) ** 2;
      return Math.sqrt(sum / (rate / 2));
    };
    expect(rms(rate * 1.25) / rms(rate * 2.25)).toBeCloseTo(1, 1);
    expect(sha(await readFile(voiceFile))).toBe(sha(voice));
    await writeFile(path.join(directory, "music.wav"), effect);
    await expect(
      mixVideoSoundtrack({
        timeline: timelineFile,
        soundtrack,
        directory: path.join(directory, "versions"),
      }),
    ).rejects.toThrow("soundtrack_asset_digest_mismatch");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
