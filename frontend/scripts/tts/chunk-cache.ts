/** 负责独立合成段缓存。输入为台词、take和规范化声线，输出已校验音频及对齐；整条拼接不影响局部身份，旧分段只作本地迁移。 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, rename, rm, lstat } from "node:fs/promises";
import path from "node:path";
import { speechSynthesisIdentity } from "../../src/speech-identity";
import { validateSpeechAlignment, type SpeechAlignment } from "../../src/speech-timing";
import type { VoiceProfile } from "../../src/speech";
import type { SpeechProvider } from "./provider";
import { readPcmWav } from "./wav";

const digest = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
export const speechChunkKey = (text: string, voice: VoiceProfile, take: string) =>
  digest(JSON.stringify({ version: 1, ...speechSynthesisIdentity(voice), text, take }));

export async function speechChunk(options: {
  directory: string;
  text: string;
  voice: VoiceProfile;
  take: string;
  legacyPath?: string;
  expectedPcm?: Uint8Array;
  provider?: SpeechProvider;
}) {
  const key = speechChunkKey(options.text, options.voice, options.take);
  const directory = path.join(options.directory, "chunks", key);
  const read = async (file: string, canonical: boolean) => {
    let audio: Buffer;
    try {
      audio = await readFile(file);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        if (canonical) {
          try {
            await lstat(directory);
            throw new Error("tts_chunk_cache_corrupt");
          } catch (missing) {
            if ((missing as NodeJS.ErrnoException).code !== "ENOENT") throw missing;
          }
        }
        return undefined;
      }
      throw error;
    }
    const wav = readPcmWav(audio);
    if (!canonical && options.expectedPcm && digest(wav.pcm) !== digest(options.expectedPcm))
      throw new Error("tts_chunk_cache_corrupt");
    if (wav.sampleRate !== (options.voice.sampleRate ?? 24000))
      throw new Error("tts_sample_rate_mismatch");
    let metadata:
      { key?: string; sha256: string; alignment?: SpeechAlignment; requestId?: string } | undefined;
    try {
      metadata = JSON.parse(await readFile(`${file}.json`, "utf8"));
    } catch (error) {
      if (canonical || (error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    if ((canonical && metadata?.key !== key) || (metadata && metadata.sha256 !== digest(audio)))
      throw new Error("tts_chunk_cache_corrupt");
    if (metadata?.alignment)
      validateSpeechAlignment(metadata.alignment, (wav.samples * 1000) / wav.sampleRate);
    return { audio, alignment: metadata?.alignment, requestId: metadata?.requestId };
  };
  const cached = await read(path.join(directory, "audio.wav"), true);
  if (cached) return cached;
  const legacy = options.legacyPath ? await read(options.legacyPath, false) : undefined;
  if (!legacy && !options.provider) return undefined;
  await mkdir(path.dirname(directory), { recursive: true });
  const lock = `${directory}.lock`;
  try {
    await mkdir(lock);
  } catch {
    throw new Error("tts_chunk_cache_locked");
  }
  try {
    const result =
      legacy ?? (await options.provider!.synthesize({ text: options.text, voice: options.voice }));
    const wav = readPcmWav(result.audio);
    if (wav.sampleRate !== (options.voice.sampleRate ?? 24000))
      throw new Error("tts_sample_rate_mismatch");
    if (result.alignment)
      validateSpeechAlignment(result.alignment, (wav.samples * 1000) / wav.sampleRate);
    await writeFile(path.join(lock, "audio.wav"), result.audio, { mode: 0o600 });
    await writeFile(
      path.join(lock, "audio.wav.json"),
      JSON.stringify({
        key,
        sha256: digest(result.audio),
        alignment: result.alignment,
        requestId: result.requestId,
      }),
      { mode: 0o600 },
    );
    await rename(lock, directory);
    return result;
  } finally {
    await rm(lock, { recursive: true, force: true });
  }
}
