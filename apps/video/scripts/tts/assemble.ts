/**
 * 负责离线连续人声轨拼接。输入为真实采样清单和增量时间报告，输出内容寻址WAV，不访问网络或重新合成。
 * 每段只补足视频帧边界与作者显式停顿，避免额外秒级等待；损坏、采样率不一致或估时报告直接拒绝。
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { SpeechTimeline } from "@ai-werewolf-arena/game-media/speech-script";
import type { SpeechManifest } from "@ai-werewolf-arena/game-media/speech";
import { readPcmWav, writePcmWav } from "./wav";

export async function assembleSpeechAudio(options: {
  timeline: SpeechTimeline;
  manifest: SpeechManifest;
  manifestDirectory: string;
  directory: string;
}) {
  const { timeline, manifest } = options;
  if (timeline.timing !== "audio") throw new Error("speech_assembly_requires_audio");
  const chunks: Buffer[] = [];
  let sampleRate = 0,
    cursor = 0;
  const padTo = (sample: number) => {
    if (sample < cursor) throw new Error("speech_assembly_overlap");
    if (sample > cursor) chunks.push(Buffer.alloc((sample - cursor) * 2));
    cursor = sample;
  };
  for (const scene of timeline.scenes)
    for (const line of scene.lines) {
      const entry = manifest[line.id];
      if (!entry || /^(?:https?:|data:)/i.test(entry.src))
        throw new Error("speech_assembly_media_invalid");
      const source = entry.src.startsWith("file:")
        ? fileURLToPath(entry.src)
        : path.resolve(options.manifestDirectory, entry.src);
      const bytes = await readFile(source);
      if (createHash("sha256").update(bytes).digest("hex") !== entry.sha256)
        throw new Error("speech_assembly_digest_mismatch");
      const wav = readPcmWav(bytes);
      if (wav.samples !== entry.samples || wav.sampleRate !== entry.sampleRate)
        throw new Error("speech_assembly_samples_mismatch");
      if (sampleRate && sampleRate !== wav.sampleRate)
        throw new Error("speech_assembly_sample_rate_mismatch");
      sampleRate = wav.sampleRate;
      padTo(Math.round(((scene.from + line.from) * sampleRate) / timeline.fps));
      chunks.push(wav.pcm);
      cursor += wav.samples;
    }
  padTo(Math.ceil((timeline.durationFrames * sampleRate) / timeline.fps));
  const bytes = writePcmWav(Buffer.concat(chunks), sampleRate);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const file = path.resolve(options.directory, `voice-${sha256}.wav`);
  await mkdir(options.directory, { recursive: true });
  try {
    await writeFile(file, bytes, { flag: "wx" });
  } catch (error) {
    if (
      (error as NodeJS.ErrnoException).code !== "EEXIST" ||
      createHash("sha256")
        .update(await readFile(file))
        .digest("hex") !== sha256
    )
      throw error;
  }
  return { file, sha256, samples: cursor, sampleRate };
}
