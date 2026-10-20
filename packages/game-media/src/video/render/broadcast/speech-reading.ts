/**
 * 负责将真实语音对齐映射到正文UTF16区间。输入为全文、镜头局部配音及FPS，输出单调的跟读锚点。
 * 只忽略标点、空白和兼容字形；重复文字沿原文前进，少量漏读可跳过，大幅改写不冒充精确对齐。
 */
import type { SpeechCue } from "../../types";

export interface SpeechReadingCue {
  start: number;
  end: number;
  frame: number;
}

const normalize = (value: string) =>
  value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\p{Mark}]/gu, "");

export function speechReadingCues(
  text: string,
  speech: readonly SpeechCue[],
  fps: number,
): SpeechReadingCue[] | undefined {
  const offsets: Array<{ start: number; end: number }> = [];
  let normalized = "",
    cursor = 0;
  for (const glyph of text) {
    const value = normalize(glyph);
    normalized += value;
    for (let index = 0; index < value.length; index++)
      offsets.push({ start: cursor, end: cursor + glyph.length });
    cursor += glyph.length;
  }
  if (!normalized) return undefined;
  const result: SpeechReadingCue[] = [];
  let position = 0,
    matched = 0;
  for (const cue of speech) {
    const spans = cue.alignment?.spans ?? cue.subtitles;
    if (!spans?.length) return undefined;
    for (const span of spans) {
      const value = normalize(span.text);
      if (!value) continue;
      const start = normalized.indexOf(value, position);
      if (start < 0) return undefined;
      position = start + value.length;
      matched += value.length;
      result.push({
        start: offsets[start]!.start,
        end: offsets[position - 1]!.end,
        frame: (cue.from ?? 0) + (span.startMs * fps) / 1000,
      });
    }
  }
  return matched >= normalized.length * 0.9 ? result : undefined;
}
