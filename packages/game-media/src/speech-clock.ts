/**
 * 负责配音的增量时间安排。输入为已知或估算的帧长、显式停顿和节奏策略，输出局部起点与镜头总长。
 * 不读取音频或改写对齐；语音自带静音仍属于原音频，策略中的留白是额外添加的时间。
 */
import type { SpeakerId } from "./video/types";

export interface SpeechTimingPolicy {
  lineGapMs?: number;
  speakerGapMs?: number;
  playerGapMs?: number;
  sceneGapMs?: number;
  phaseGapMs?: number;
  resultGapMs?: number;
  tailMs?: number;
  endingHoldMs?: number;
}
export const LEGACY_SPEECH_TIMING: SpeechTimingPolicy = { lineGapMs: 200, tailMs: 400 };
export const CONTINUOUS_SPEECH_TIMING: SpeechTimingPolicy = { lineGapMs: 0 };
export interface SpeechClockLine {
  id: string;
  speaker: SpeakerId;
  durationFrames: number;
  pauseAfterMs?: number;
}
export function validateSpeechTimingPolicy(policy: SpeechTimingPolicy): void {
  const keys = [
    "lineGapMs",
    "speakerGapMs",
    "playerGapMs",
    "sceneGapMs",
    "phaseGapMs",
    "resultGapMs",
    "tailMs",
    "endingHoldMs",
  ];
  if (
    !policy ||
    typeof policy !== "object" ||
    Array.isArray(policy) ||
    Object.entries(policy).some(
      ([key, value]) =>
        !keys.includes(key) || !Number.isSafeInteger(value) || value < 0 || value > 10000,
    )
  )
    throw new Error("speech_timing_policy_invalid");
}
export function scheduleSpeechScene(options: {
  fps: number;
  policy: SpeechTimingPolicy;
  lines: SpeechClockLine[];
  startFrame?: number;
  minimumFrames?: number;
  nextSpeaker?: SpeakerId;
  boundary?: "scene" | "phase" | "result" | "ending";
}) {
  const { policy, fps } = options;
  validateSpeechTimingPolicy(policy);
  if (!Number.isSafeInteger(fps) || fps < 1) throw new Error("speech_fps_invalid");
  let cursor = options.startFrame ?? 0;
  const lines = options.lines.map((line, index) => {
    if (
      !Number.isSafeInteger(line.durationFrames) ||
      line.durationFrames < 1 ||
      (line.pauseAfterMs !== undefined &&
        (!Number.isSafeInteger(line.pauseAfterMs) ||
          line.pauseAfterMs < 0 ||
          line.pauseAfterMs > 10000))
    )
      throw new Error("speech_clock_line_invalid");
    const last = index === options.lines.length - 1;
    const next = options.lines[index + 1]?.speaker ?? options.nextSpeaker;
    let gap = policy.lineGapMs ?? 0;
    if (last) gap = policy.sceneGapMs ?? gap;
    if (next && next !== line.speaker) gap = policy.speakerGapMs ?? gap;
    if (next && line.speaker.startsWith("player:") && next !== line.speaker)
      gap = policy.playerGapMs ?? gap;
    if (last && options.boundary === "phase") gap = policy.phaseGapMs ?? gap;
    if (last && options.boundary === "result") gap = policy.resultGapMs ?? gap;
    if (last && options.boundary === "ending") gap = policy.endingHoldMs ?? gap;
    const pauseFrames = Math.round(((line.pauseAfterMs ?? gap) * fps) / 1000);
    const result = { id: line.id, from: cursor, durationFrames: line.durationFrames, pauseFrames };
    cursor += line.durationFrames + pauseFrames;
    return result;
  });
  return {
    lines,
    durationFrames: Math.max(
      1,
      options.minimumFrames ?? 0,
      cursor + Math.round(((policy.tailMs ?? 0) * fps) / 1000),
    ),
  };
}
