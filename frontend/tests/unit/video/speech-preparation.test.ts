/** 离线语音测试负责验证分句、时长与缓存。输入为本地PCM，预期为独立采样数和请求次数；不访问云服务。 */
import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { preparedSpeech, type SpeechProject } from "../../../src/speech";
import { prepareSpeech, speechRequests, splitSpeechText } from "../../../scripts/tts/prepare";
import { readPcmWav, writePcmWav } from "../../../scripts/tts/wav";

function project(): SpeechProject {
  return {
    casting: {
      god: {
        provider: "tencent",
        voiceId: 402002,
        name: "云大围",
        tier: "ultra-natural",
        sampleRate: 24000,
      },
    },
    lines: [{ id: "opening", speaker: "god", text: "这是开场。" }],
  };
}
test("long speech retains all Unicode text and splits at sentence boundaries within the basic API limit", () => {
  const text = "这是原文，不应丢字。".repeat(35) + "最后一句🐺。";
  const chunks = splitSpeechText(text);
  expect(chunks.join("")).toBe(text);
  expect(chunks.every((chunk) => Array.from(chunk).length <= 140)).toBe(true);
  expect(chunks.slice(0, -1).every((chunk) => chunk.endsWith("。"))).toBe(true);
  expect(() => splitSpeechText("<speak>SSML</speak>")).toThrow("tts_plain_text_required");
});
test("preparation measures PCM samples, reuses cache offline and rejects altered text or voice", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "awa-speech-test-"));
  let calls = 0;
  const provider = {
    async synthesize() {
      calls++;
      return { audio: writePcmWav(Buffer.alloc(24000 * 2 + 2), 24000), requestId: "local-request" };
    },
  };
  const speech = project();
  const options = {
    project: speech,
    directory: path.join(directory, "cache"),
    manifestPath: path.join(directory, "speech.ts"),
    provider,
  };
  try {
    const manifest = await prepareSpeech(options);
    expect(calls).toBe(1);
    expect(manifest.opening!.samples).toBe(24001);
    expect(preparedSpeech(speech, manifest, "opening", 30).durationFrames).toBe(31);
    const cached = await prepareSpeech({ ...options, check: true });
    expect(cached.opening).not.toHaveProperty("requestIds");
    expect(
      JSON.parse(
        await readFile(path.join(options.directory, manifest.opening!.key, "record.json"), "utf8"),
      ).requestIds,
    ).toEqual(["local-request"]);
    await prepareSpeech(options);
    expect(calls).toBe(1);
    speech.lines[0]!.text = "修改开场。";
    expect(() => preparedSpeech(speech, manifest, "opening", 30)).toThrow("speech_stale:opening");
    await prepareSpeech(options);
    expect(calls).toBe(2);
    speech.casting.god!.voiceId = 403002;
    expect(() => preparedSpeech(speech, manifest, "opening", 30)).toThrow("speech_stale:opening");
    expect(await readFile(options.manifestPath, "utf8")).not.toContain("SECRET");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
test("a failed long line resumes successful chunks and cache corruption never causes a paid retry", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "awa-speech-resume-"));
  const speech = project();
  speech.lines[0]!.text = "一段很长的发言。".repeat(30);
  let calls = 0;
  const audio = writePcmWav(Buffer.alloc(24000 * 2), 24000);
  const options = {
    project: speech,
    directory: path.join(directory, "cache"),
    manifestPath: path.join(directory, "speech.ts"),
    provider: {
      async synthesize() {
        if (++calls === 2) throw new Error("synthetic_failure");
        return { audio };
      },
    },
  };
  try {
    await expect(prepareSpeech(options)).rejects.toThrow("synthetic_failure");
    const manifest = await prepareSpeech(options);
    expect(calls).toBe(3);
    expect(manifest.opening!.samples).toBe(48000 + 3840);
    const corrupt = path.join(options.directory, speechRequests(speech)[0]!.key, "audio.wav");
    await writeFile(corrupt, writePcmWav(Buffer.alloc(8000), 24000));
    await expect(prepareSpeech(options)).rejects.toThrow("tts_cache_corrupt:opening");
    expect(calls).toBe(3);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
test("WAV parsing rejects truncated chunks and unsupported sample formats", () => {
  const wav = writePcmWav(Buffer.alloc(48000), 24000);
  expect(readPcmWav(wav).samples).toBe(24000);
  expect(() => readPcmWav(wav.subarray(0, 50))).toThrow("tts_wav_truncated");
  wav.writeUInt16LE(2, 22);
  expect(() => readPcmWav(wav)).toThrow("tts_wav_format_unsupported");
});
test("identical content under two line IDs shares one synthesis and one committed audio cache", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "awa-speech-identical-"));
  const speech = project();
  speech.lines.push({ ...speech.lines[0]!, id: "repeated-opening" });
  let calls = 0;
  try {
    const manifest = await prepareSpeech({
      project: speech,
      directory,
      manifestPath: path.join(directory, "speech.ts"),
      provider: {
        async synthesize() {
          calls++;
          return { audio: writePcmWav(Buffer.alloc(48000), 24000) };
        },
      },
    });
    expect(calls).toBe(1);
    expect(manifest.opening!.key).toBe(manifest["repeated-opening"]!.key);
    expect(manifest.opening!.src).toBe(manifest["repeated-opening"]!.src);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
