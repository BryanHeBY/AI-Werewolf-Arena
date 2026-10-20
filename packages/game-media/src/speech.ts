/** 负责声明离线配音契约。输入为台词、选角与已备素材，输出媒体绑定；不持有凭据或网络客户端。 */
import { speechSynthesisIdentity } from "./speech-identity";
import { scheduleSpeechScene, LEGACY_SPEECH_TIMING, type SpeechTimingPolicy } from "./speech-clock";
import type {
  MediaAsset,
  SpeakerId,
  SpeechCue,
  VideoPlan,
  VideoScript,
  ShotOptions,
} from "./video/types";
import {
  segmentSpeechSubtitles,
  validateSpeechAlignment,
  validateSpeechTimings,
  type SpeechAlignment,
  type SpeechTextTiming,
  type SpeechSubtitleOptions,
} from "./speech-timing";

export interface TencentVoiceProfile {
  provider: "tencent";
  voiceId: number;
  name: string;
  tier: "premium" | "large-model" | "ultra-natural";
  sampleRate?: 8000 | 16000 | 24000;
  speed?: number;
  volume?: number;
}
export interface VolcengineVoiceProfile {
  provider: "volcengine";
  voiceId: string;
  name: string;
  resourceId: "seed-tts-2.0";
  sampleRate?: 8000 | 16000 | 22050 | 24000 | 32000 | 44100 | 48000;
  /** 豆包原生参数：0为正常语速，50为1.5倍，范围[-50,100]。 */
  speechRate?: number;
  loudnessRate?: number;
  contextTexts?: string[];
}
export type VoiceProfile = TencentVoiceProfile | VolcengineVoiceProfile;
export interface DialogueLine {
  id: string;
  speaker: SpeakerId;
  /** 屏幕文字独立于读音修正；玩家节选应在导演稿标明来源。 */
  text: string;
  spokenText?: string;
  /** 可选固定合成边界，逐段拼接必须完整等于spokenText；便于局部重录而不扰动后续分段。 */
  synthesisChunks?: string[];
  pauseAfterMs?: number;
  voice?: VoiceProfile;
  /** 改此值生成新 take，旧音频仍保留，便于试听后回退。 */
  take?: string;
  /** 相对于本段配音的字幕覆盖；只影响显示，false关闭这一段字幕。 */
  subtitles?: false | SpeechTextTiming[];
}
export interface SpeechProject {
  casting: Partial<Record<SpeakerId, VoiceProfile>>;
  timing?: SpeechTimingPolicy;
  lines: DialogueLine[];
  /** 只在长台词的句间拼接处插入静音，默认 160ms。 */
  chunkGapMs?: number;
  subtitles?: false | SpeechSubtitleOptions;
}
export interface PreparedSpeech {
  key: string;
  text: string;
  voice: VoiceProfile;
  take: string;
  gapMs: number;
  src: string;
  sha256: string;
  samples: number;
  sampleRate: number;
  /** 合成块的准确边界，非逐词对齐时间戳。 */
  chunks: Array<{ text: string; fromSample: number; samples: number }>;
  /** 只有全部合成块均具备对齐时才存在，包含拼接静音后的局部偏移。 */
  alignment?: SpeechAlignment;
}
export type SpeechManifest = Record<string, PreparedSpeech>;

export function defineSpeechProject(project: SpeechProject): SpeechProject {
  return project;
}

export function videoSpeechLineId(shotId: string, index: number): string {
  return `${shotId.replace(/[^a-zA-Z0-9_-]/g, "-")}-${index}`;
}
/** 输入完整原生计划与选角，输出全部配音台词；镜头的合段与原始发言归编译器所有。 */
export function speechProjectFromPlan(
  plan: VideoPlan,
  casting: SpeechProject["casting"],
): SpeechProject {
  return {
    casting,
    lines: plan.shots.flatMap((shot) =>
      shot.speech
        .filter((cue) => cue.text.trim())
        .map((cue, index) => ({
          id: videoSpeechLineId(shot.id, index),
          speaker: cue.speaker,
          text: cue.text,
        })),
    ),
  };
}

/** 输入已备语音和无声计划，输出镜头局部覆盖；不修改事件锚点，不拆散原生票型与结算。 */
export function bindVideoSpeech(
  script: VideoScript,
  plan: VideoPlan,
  project: SpeechProject,
  manifest: SpeechManifest,
): VideoScript {
  const media = [...(script.media ?? [])];
  const shotEdits = new Map((script.shotEdits ?? []).map((edit) => [edit.id, edit]));
  for (const [shotIndex, shot] of plan.shots.entries()) {
    const speech: SpeechCue[] = [];
    const existing = shotEdits.get(shot.id);
    const cues = shot.speech.filter((item) => item.text.trim());
    if (!cues.length) continue;
    const bound = cues.map((_, index) =>
      preparedSpeech(project, manifest, videoSpeechLineId(shot.id, index), plan.fps),
    );
    const schedule = scheduleSpeechScene({
      fps: plan.fps,
      policy: project.timing ?? LEGACY_SPEECH_TIMING,
      startFrame: project.timing ? 0 : (shot.speech[0]?.from ?? 0),
      nextSpeaker: plan.shots[shotIndex + 1]?.speech[0]?.speaker,
      boundary: !plan.shots[shotIndex + 1]
        ? "ending"
        : shot.scene.resolution || shot.scene.kind === "settlement"
          ? "result"
          : shot.scene.kind === "phase" || plan.shots[shotIndex + 1]?.scene.kind === "phase"
            ? "phase"
            : "scene",
      minimumFrames: Math.max(
        existing?.durationFrames ?? 0,
        shot.kind === "hold" ? shot.durationFrames : 0,
      ),
      lines: bound.map((item, index) => ({
        id: String(index),
        speaker: item.cue.speaker,
        durationFrames: item.durationFrames,
        pauseAfterMs: project.lines.find((line) => line.id === videoSpeechLineId(shot.id, index))
          ?.pauseAfterMs,
      })),
    });
    for (const [index, item] of bound.entries()) {
      if (cues[index]!.speaker !== item.cue.speaker) throw new Error("speech_speaker_changed");
      media.push(item.media);
      speech.push({ ...item.cue, from: schedule.lines[index]!.from });
    }
    const resultFrom = shot.scene.resolution ? schedule.lines[1]?.from : undefined;
    const durationFrames = schedule.durationFrames;
    const options: ShotOptions & { id: string } = {
      ...existing,
      id: shot.id,
      durationFrames,
      speech,
      ...(plan.layout === "broadcast-v1" && shot.kind !== "hold"
        ? { readingClock: "flow" as const }
        : {}),
      // 绑定实际音轨后保留原计划的短动画，不能因显式时长退回旧的揭晓节拍。
      scene: {
        ...existing?.scene,
        cues: { ...shot.scene.cues, ...(resultFrom === undefined ? {} : { settled: resultFrom }) },
      },
    };
    shotEdits.set(shot.id, options);
  }
  return { ...script, media, shotEdits: [...shotEdits.values()] };
}

/** 生成之后才绑定镜头；文本/声线/take有变化时拒绝旧素材，防止画音悄悄错配。 */
export function preparedSpeech(
  project: SpeechProject,
  manifest: SpeechManifest,
  id: string,
  fps: number,
): { media: MediaAsset; cue: SpeechCue; durationFrames: number } {
  const line = project.lines.find((item) => item.id === id);
  const entry = manifest[id];
  if (!line || !entry) throw new Error(`speech_not_prepared:${id}`);
  const voice = line.voice ?? project.casting[line.speaker];
  if (
    !voice ||
    entry.text !== (line.spokenText ?? line.text) ||
    (line.synthesisChunks !== undefined &&
      JSON.stringify(line.synthesisChunks) !==
        JSON.stringify(entry.chunks.map((chunk) => chunk.text))) ||
    JSON.stringify(speechSynthesisIdentity(entry.voice)) !==
      JSON.stringify(speechSynthesisIdentity(voice)) ||
    entry.take !== (line.take ?? "1") ||
    entry.gapMs !== (project.chunkGapMs ?? 160)
  )
    throw new Error(`speech_stale:${id}`);
  if (!Number.isSafeInteger(fps) || fps < 1) throw new Error("speech_fps_invalid");
  const durationFrames = Math.ceil((entry.samples * fps) / entry.sampleRate);
  const durationMs = (entry.samples * 1000) / entry.sampleRate;
  if (entry.alignment) validateSpeechAlignment(entry.alignment, durationMs);
  const options = project.subtitles === false ? undefined : project.subtitles;
  const subtitles =
    project.subtitles === false || line.subtitles === false
      ? undefined
      : (line.subtitles ??
        (entry.alignment
          ? segmentSpeechSubtitles(entry.alignment, {
              ...options,
              minDurationMs: options?.minDurationMs ?? 1000 / fps,
            })
          : undefined));
  if (subtitles) validateSpeechTimings(subtitles, durationMs);
  if (options?.requireTiming && line.subtitles !== false && !subtitles?.length)
    throw new Error(`speech_timing_missing:${id}`);
  const assetId = `voice:${id}:${entry.key}`;
  return {
    media: { id: assetId, kind: "audio", src: entry.src, durationFrames },
    cue: {
      speaker: line.speaker,
      text: entry.text,
      assetId,
      durationFrames,
      ...(subtitles?.length ? { subtitles } : {}),
      ...(entry.alignment ? { alignment: entry.alignment } : {}),
    },
    durationFrames,
  };
}
