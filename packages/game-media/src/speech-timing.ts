/** 负责语音文字对齐与字幕分段。输入为音频局部毫秒时间，输出可微调字幕；不按字数猜测语音边界，不依赖服务商或渲染器。 */
export interface SpeechTextTiming {
  text: string;
  startMs: number;
  endMs: number;
}
export interface SpeechAlignment {
  source: "provider" | "aligned" | "manual";
  spans: SpeechTextTiming[];
}
export interface SpeechSubtitleOptions {
  maxCharacters?: number;
  maxGapMs?: number;
  /** 极短字幕只与邻近真实段合并，不扩写或估造时间。 */
  minDurationMs?: number;
  /** 缺少完整对齐时中止有声绑定，不用阅读时钟冒充字幕时间。 */
  requireTiming?: boolean;
}

export function validateSpeechTimings(cues: SpeechTextTiming[], durationMs = Infinity): void {
  if (!Array.isArray(cues)) throw new Error("speech_timings_invalid");
  let previous = 0;
  for (const cue of cues) {
    if (
      !cue ||
      typeof cue.text !== "string" ||
      !cue.text.trim() ||
      !Number.isFinite(cue.startMs) ||
      !Number.isFinite(cue.endMs) ||
      cue.startMs < previous - 1e-6 ||
      cue.endMs <= cue.startMs ||
      cue.endMs > durationMs + 1e-6
    )
      throw new Error("speech_timings_invalid");
    previous = cue.endMs;
  }
}
export function validateSpeechAlignment(alignment: SpeechAlignment, durationMs = Infinity): void {
  if (!alignment || !["provider", "aligned", "manual"].includes(alignment.source))
    throw new Error("speech_alignment_invalid");
  validateSpeechTimings(alignment.spans, durationMs);
  if (!alignment.spans.length) throw new Error("speech_alignment_empty");
}
export function segmentSpeechSubtitles(
  alignment: SpeechAlignment,
  options: SpeechSubtitleOptions = {},
): SpeechTextTiming[] {
  validateSpeechAlignment(alignment);
  const maxCharacters = options.maxCharacters ?? 24;
  const maxGapMs = options.maxGapMs ?? 450;
  const minDurationMs = options.minDurationMs ?? 0;
  if (
    !Number.isSafeInteger(maxCharacters) ||
    maxCharacters < 1 ||
    !Number.isFinite(maxGapMs) ||
    maxGapMs < 0 ||
    !Number.isFinite(minDurationMs) ||
    minDurationMs < 0
  )
    throw new Error("speech_subtitle_options_invalid");
  const cues: SpeechTextTiming[] = [];
  let current: SpeechTextTiming | undefined;
  const flush = () => {
    if (current) cues.push(current);
    current = undefined;
  };
  for (const span of alignment.spans) {
    if (
      current &&
      (span.startMs - current.endMs > maxGapMs ||
        Array.from(current.text + span.text).length > maxCharacters)
    )
      flush();
    current = current
      ? { text: current.text + span.text, startMs: current.startMs, endMs: span.endMs }
      : { ...span };
    if (/[，。！？；,.!?;\n][”’"']?\s*$/u.test(span.text)) flush();
  }
  flush();
  // 服务商偶尔把数字和逗号单独标成不足一帧；保留原文字和边界，优先接入后句。
  for (let index = 0; index < cues.length; index++) {
    const cue = cues[index]!;
    if (cue.endMs - cue.startMs >= minDurationMs) continue;
    const next = cues[index + 1];
    const previous = cues[index - 1];
    if (
      next &&
      next.startMs - cue.endMs <= maxGapMs &&
      Array.from(cue.text + next.text).length <= maxCharacters
    ) {
      cues.splice(index, 2, {
        text: cue.text + next.text,
        startMs: cue.startMs,
        endMs: next.endMs,
      });
      index--;
    } else if (
      previous &&
      cue.startMs - previous.endMs <= maxGapMs &&
      Array.from(previous.text + cue.text).length <= maxCharacters
    ) {
      cues.splice(index - 1, 2, {
        text: previous.text + cue.text,
        startMs: previous.startMs,
        endMs: cue.endMs,
      });
      index -= 2;
    }
  }
  return cues;
}
