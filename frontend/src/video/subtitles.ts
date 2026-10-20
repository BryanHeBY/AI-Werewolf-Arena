/** 负责独立字幕轨道的编译、查询与SRT序列化。输入为配音局部毫秒及镜头帧，输出全局字幕；不改变舞台正文或按读速补造时间。 */
import { validateSpeechTimings } from "../speech-timing";
import type {
  PlannedSubtitleCue,
  VideoPlan,
  VideoShot,
  VideoSubtitleDisplayOptions,
} from "./types";

export function compileVideoSubtitles(
  shots: VideoShot[],
  fps: number,
  options: VideoSubtitleDisplayOptions = {},
): PlannedSubtitleCue[] {
  if (!Number.isSafeInteger(fps) || fps < 1) throw new Error("video_subtitle_fps_invalid");
  const lingerMs = options.lingerMs ?? 0;
  if (!Number.isSafeInteger(lingerMs) || lingerMs < 0)
    throw new Error("video_subtitle_linger_invalid");
  const result: PlannedSubtitleCue[] = [];
  for (const shot of shots)
    for (const [index, speech] of shot.speech.entries()) {
      if (!speech.subtitles) continue;
      validateSpeechTimings(speech.subtitles, (speech.durationFrames * 1000) / fps);
      const first = result.length;
      for (const [cueIndex, cue] of speech.subtitles.entries()) {
        // 真实极短段也保留一帧；同一发言内落到同帧的文字合并，不丢字或跨说话者借时间。
        const from = Math.min(Math.ceil((cue.startMs * fps) / 1000), speech.durationFrames - 1);
        const end = Math.min(
          speech.durationFrames,
          Math.max(from + 1, Math.ceil((cue.endMs * fps) / 1000)),
        );
        const previous = result.at(-1);
        const globalFrom = shot.from + speech.from + from;
        if (result.length > first && previous!.from + previous!.durationFrames > globalFrom) {
          previous!.text += cue.text;
          previous!.durationFrames =
            Math.max(previous!.from + previous!.durationFrames, shot.from + speech.from + end) -
            previous!.from;
          continue;
        }
        result.push({
          id: `subtitle:${shot.id}:${index}:${cueIndex}`,
          speaker: speech.speaker,
          text: cue.text,
          from: globalFrom,
          durationFrames: end - from,
        });
      }
    }
  result.sort((a, b) => a.from - b.from);
  for (let index = 1; index < result.length; index++)
    if (result[index]!.from < result[index - 1]!.from + result[index - 1]!.durationFrames)
      throw new Error("video_subtitle_overlap");
  const lingerFrames = Math.round((lingerMs * fps) / 1000);
  if (!lingerFrames) return result;
  const duration = Math.max(0, ...shots.map((shot) => shot.from + shot.durationFrames));
  return result.map((cue, index) => ({
    ...cue,
    durationFrames:
      Math.min(
        cue.from + cue.durationFrames + lingerFrames,
        result[index + 1]?.from ?? duration,
        duration,
      ) - cue.from,
  }));
}
export function videoSubtitleAt(plan: Pick<VideoPlan, "subtitles">, frame: number) {
  const cues = plan.subtitles ?? [];
  let lo = 0,
    hi = cues.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (cues[mid]!.from <= frame) lo = mid + 1;
    else hi = mid;
  }
  const cue = cues[lo - 1];
  return cue && frame < cue.from + cue.durationFrames ? cue : undefined;
}
export function videoSubtitlesSrt(plan: Pick<VideoPlan, "subtitles" | "fps">): string {
  const timestamp = (frame: number) => {
    const ms = Math.round((frame * 1000) / plan.fps);
    const pad = (value: number, width = 2) => String(value).padStart(width, "0");
    return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)},${pad(ms % 1000, 3)}`;
  };
  return (plan.subtitles ?? [])
    .map(
      (cue, index) =>
        `${index + 1}\n${timestamp(cue.from)} --> ${timestamp(cue.from + cue.durationFrames)}\n${cue.text}\n`,
    )
    .join("\n");
}
