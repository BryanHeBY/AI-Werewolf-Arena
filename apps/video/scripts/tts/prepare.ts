/** 负责离线语音准备。输入为台词和选角，输出内容寻址缓存与TS素材清单；不参与渲染。 */
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import type {
  DialogueLine,
  PreparedSpeech,
  SpeechManifest,
  SpeechProject,
} from "@ai-werewolf-arena/game-media/speech";
import { isVideoSpeaker } from "@ai-werewolf-arena/game-media/video/speakers";
import {
  validateSpeechAlignment,
  type SpeechAlignment,
  type SpeechTextTiming,
} from "@ai-werewolf-arena/game-media/speech-timing";
import type { SpeechAligner, SpeechProvider } from "./provider";
import { speechSynthesisIdentity, validateVoiceProfile } from "./voices";
import { speechChunk } from "./chunk-cache";
import { readPcmWav, writePcmWav } from "./wav";

const digest = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
/** 每块最多140个Unicode字符，兼顾基础接口150汉字/500英文字符限制；保留全部标点和正文。 */
export function splitSpeechText(text: string): string[] {
  if (!text.trim() || /[<>]/.test(text)) throw new Error("tts_plain_text_required");
  const characters = Array.from(text);
  const chunks: string[] = [];
  let start = 0;
  while (start < characters.length) {
    let end = Math.min(start + 140, characters.length);
    if (end < characters.length) {
      for (let cursor = end - 1; cursor > start + 50; cursor--)
        if (/[。！？；\n.!?;]/.test(characters[cursor]!)) {
          end = cursor + 1;
          break;
        }
    }
    chunks.push(characters.slice(start, end).join(""));
    start = end;
  }
  return chunks;
}
export function speechRequests(project: SpeechProject) {
  const ids = new Set<string>();
  const gapMs = project.chunkGapMs ?? 160;
  if (!Number.isSafeInteger(gapMs) || gapMs < 0 || gapMs > 2000) throw new Error("tts_gap_invalid");
  return project.lines.map((line: DialogueLine) => {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(line.id) || ids.has(line.id))
      throw new Error("tts_line_id_invalid");
    ids.add(line.id);
    if (!isVideoSpeaker(line.speaker)) throw new Error("tts_speaker_invalid");
    const voice = line.voice ?? project.casting[line.speaker];
    if (!voice) throw new Error(`tts_voice_invalid:${line.id}`);
    validateVoiceProfile(voice);
    const text = line.spokenText ?? line.text;
    const chunks = line.synthesisChunks ?? splitSpeechText(text);
    if (
      !chunks.length ||
      chunks.join("") !== text ||
      chunks.some((chunk) => !chunk.trim() || Array.from(chunk).length > 140 || /[<>]/.test(chunk))
    )
      throw new Error("tts_chunks_invalid");
    const take = line.take ?? "1";
    if (typeof take !== "string" || !take.trim()) throw new Error("tts_take_invalid");
    // 固定字段顺序；人物显示名不影响有声内容缓存，API版本/分句策略明确参与版本。
    const key = digest(
      JSON.stringify({
        version: 1,
        ...speechSynthesisIdentity(voice),
        text,
        chunks,
        take,
        gapMs,
      }),
    );
    return { id: line.id, text, voice, take, gapMs, chunks, key };
  });
}
type Request = ReturnType<typeof speechRequests>[number];
async function readCached(
  directory: string,
  request: Request,
): Promise<PreparedSpeech | undefined> {
  let record: PreparedSpeech;
  try {
    record = JSON.parse(await readFile(path.join(directory, request.key, "record.json"), "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
  const audio = await readFile(path.join(directory, request.key, "audio.wav"));
  const wav = readPcmWav(audio);
  if (
    record.key !== request.key ||
    record.text !== request.text ||
    record.take !== request.take ||
    record.gapMs !== request.gapMs ||
    JSON.stringify(speechSynthesisIdentity(record.voice)) !==
      JSON.stringify(speechSynthesisIdentity(request.voice)) ||
    digest(audio) !== record.sha256 ||
    wav.samples !== record.samples ||
    wav.sampleRate !== record.sampleRate ||
    wav.sampleRate !== (request.voice.sampleRate ?? 24000)
  )
    throw new Error(`tts_cache_corrupt:${request.id}`);
  if (record.alignment)
    validateSpeechAlignment(record.alignment, (wav.samples * 1000) / wav.sampleRate);
  // 请求追踪只留在缓存审计中，不随复用结果进入声明为PreparedSpeech的素材清单。
  const { requestIds: _requestIds, ...prepared } = record as PreparedSpeech & {
    requestIds?: unknown;
  };
  return { ...prepared, voice: request.voice };
}
export async function inspectSpeech(project: SpeechProject, directory: string) {
  const requests = speechRequests(project);
  const entries = await Promise.all(
    requests.map(async (request) => ({ request, cached: await readCached(directory, request) })),
  );
  return {
    entries,
    characters: requests.reduce((sum, item) => sum + Array.from(item.text).length, 0),
    missingCharacters: entries
      .filter((item) => !item.cached)
      .reduce((sum, item) => sum + Array.from(item.request.text).length, 0),
  };
}
export async function prepareSpeech(options: {
  project: SpeechProject;
  directory: string;
  manifestPath: string;
  provider: SpeechProvider;
  /** 可选本地对齐后备；已缓存音频缺时间时也可补齐，不重发TTS。 */
  aligner?: SpeechAligner;
  only?: string[];
  check?: boolean;
  onProgress?: (value: { id: string; cached: boolean }) => void;
}): Promise<SpeechManifest> {
  const { entries } = await inspectSpeech(options.project, options.directory);
  if (options.only?.some((id) => !entries.some((item) => item.request.id === id)))
    throw new Error("tts_only_id_missing");
  const manifest: SpeechManifest = {};
  for (const { request, cached } of entries) {
    // 前一行可能使用相同内容摘要；同次准备也必须复用已提交音频。
    let record = cached ?? (await readCached(options.directory, request));
    const reused = Boolean(record);
    if (!record && (options.check || (options.only && !options.only.includes(request.id)))) {
      if (options.check) throw new Error(`tts_not_prepared:${request.id}`);
      continue;
    }
    if (!record) {
      await mkdir(options.directory, { recursive: true });
      const lock = path.join(options.directory, `${request.key}.lock`);
      try {
        await mkdir(lock);
      } catch {
        throw new Error(`tts_cache_locked:${request.id}`);
      }
      try {
        // 每块独立缓存；长台词中途失败后再次运行，已成功的付费块可以复用。
        const chunks = [];
        const pcm: Buffer[] = [];
        const requestIds: string[] = [];
        const spans: SpeechTextTiming[] = [];
        const timingSources = new Set<SpeechAlignment["source"]>();
        let fullyTimed = true;
        let samples = 0;
        const sampleRate = request.voice.sampleRate ?? 24000;
        for (const [index, text] of request.chunks.entries()) {
          const result = await speechChunk({
            directory: options.directory,
            text,
            voice: request.voice,
            take: request.take,
            legacyPath: path.join(options.directory, `${request.key}.${index}.wav`),
            provider: options.provider,
          });
          const { audio, alignment } = result!;
          if (result?.requestId) requestIds.push(result.requestId);
          const wav = readPcmWav(audio);
          if (index > 0) {
            const gap = Math.round((sampleRate * request.gapMs) / 1000);
            pcm.push(Buffer.alloc(gap * 2));
            samples += gap;
          }
          chunks.push({ text, fromSample: samples, samples: wav.samples });
          if (alignment) {
            timingSources.add(alignment.source);
            spans.push(
              ...alignment.spans.map((span) => ({
                ...span,
                startMs: span.startMs + (samples * 1000) / sampleRate,
                endMs: span.endMs + (samples * 1000) / sampleRate,
              })),
            );
          } else fullyTimed = false;
          pcm.push(wav.pcm);
          samples += wav.samples;
        }
        const audio = writePcmWav(Buffer.concat(pcm), sampleRate);
        record = {
          key: request.key,
          text: request.text,
          voice: request.voice,
          take: request.take,
          gapMs: request.gapMs,
          src: "audio.wav",
          sha256: digest(audio),
          samples,
          sampleRate,
          chunks,
          ...(fullyTimed && spans.length
            ? {
                alignment: {
                  source: timingSources.size === 1 ? [...timingSources][0]! : ("aligned" as const),
                  spans,
                },
              }
            : {}),
        };
        await writeFile(path.join(lock, "audio.wav"), audio, { mode: 0o600 });
        await writeFile(
          path.join(lock, "record.json"),
          JSON.stringify({ ...record, requestIds }, null, 2),
          { mode: 0o600 },
        );
        await rename(lock, path.join(options.directory, request.key));
      } finally {
        await rm(lock, { recursive: true, force: true });
      }
    }
    if (!options.check && reused) {
      const original = readPcmWav(
        await readFile(path.join(options.directory, request.key, "audio.wav")),
      );
      for (const [index, text] of request.chunks.entries()) {
        const segment = record.chunks[index];
        if (!segment || segment.text !== text) throw new Error(`tts_cache_corrupt:${request.id}`);
        await speechChunk({
          directory: options.directory,
          text,
          voice: request.voice,
          take: request.take,
          legacyPath: path.join(options.directory, `${request.key}.${index}.wav`),
          expectedPcm: original.pcm.subarray(
            segment.fromSample * 2,
            (segment.fromSample + segment.samples) * 2,
          ),
        });
      }
    }
    if (!options.check && !record.alignment && options.aligner) {
      const audio = await readFile(path.join(options.directory, request.key, "audio.wav"));
      const alignment = await options.aligner.align({ text: request.text, audio });
      validateSpeechAlignment(alignment, (record.samples * 1000) / record.sampleRate);
      // 独立补齐时间信息；不改变音频身份、采样数或原有合成请求记录。
      const file = path.join(options.directory, request.key, "record.json");
      const temp = `${file}.${process.pid}.tmp`;
      const original = JSON.parse(await readFile(file, "utf8"));
      await writeFile(temp, JSON.stringify({ ...original, alignment }, null, 2), { mode: 0o600 });
      await rename(temp, file);
      record = { ...record, alignment };
    }
    manifest[request.id] = {
      ...record,
      src: path
        .relative(
          path.dirname(options.manifestPath),
          path.join(options.directory, request.key, "audio.wav"),
        )
        .split(path.sep)
        .join("/"),
    };
    options.onProgress?.({ id: request.id, cached: reused });
  }
  // 选择性重做时仍输出所有已准备的行；完整构建由 preparedSpeech 拒绝缺失/过期行。
  if (!options.check) {
    await mkdir(path.dirname(options.manifestPath), { recursive: true });
    const temp = `${options.manifestPath}.${process.pid}.tmp`;
    const relative = path
      .relative(
        path.dirname(options.manifestPath),
        fileURLToPath(import.meta.resolve("@ai-werewolf-arena/game-media/speech")),
      )
      .split(path.sep)
      .join("/");
    const sidecarName = `${path.basename(options.manifestPath, path.extname(options.manifestPath))}.${digest(JSON.stringify(manifest)).slice(0, 12)}.json`;
    await writeFile(
      path.join(path.dirname(options.manifestPath), sidecarName),
      JSON.stringify(manifest, null, 2) + "\n",
    );
    await writeFile(
      temp,
      `/** 自动生成；口播归JSONL，声线归casting，对齐明细归内容寻址JSON。 */\nimport type { SpeechManifest } from ${JSON.stringify(relative.startsWith(".") ? relative : `./${relative}`)};\nimport manifest from ${JSON.stringify(`./${sidecarName}`)};\nexport const sourceHash = ${JSON.stringify(digest(JSON.stringify(manifest)))};\nexport const speechIds = ${JSON.stringify(Object.keys(manifest))} as const;\nexport default manifest as SpeechManifest;\n`,
    );
    await rename(temp, options.manifestPath);
  }
  return manifest;
}
