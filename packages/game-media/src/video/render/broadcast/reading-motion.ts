/**
 * 负责阅读窗的确定性位移与像素对齐。输入为已量得的实际行起点、溢出和编译帧进度，输出静态、逐行或连续位移。
 * 不估字宽、不改阅读时长或事实；同一帧正放、倒放和直接跳转得到相同位置，末次不足一行也完整推进。
 */
import type { VideoSpeechReadingOptions } from "../../types";
import type { SpeechReadingCue } from "./speech-reading";

const positive = (value: number) => (Number.isFinite(value) ? Math.max(0, value) : 0);
const progressAt = (value: number) => Math.min(1, positive(value));

export interface ReadingRow {
  start: number;
  top: number;
}
export interface SpeechReadingStop {
  frame: number;
  offset: number;
}

/** 当前行保持在窗口约六成处，下方留出预读行；行位置只在字体和尺寸稳定后计算。 */
export function speechReadingStops(
  rows: readonly ReadingRow[],
  cues: readonly SpeechReadingCue[],
  windowHeight: number,
  overflow: number,
): SpeechReadingStop[] {
  const result: SpeechReadingStop[] = [{ frame: 0, offset: 0 }];
  if (!overflow || !rows.length) return result;
  const rowHeight = rows.length > 1 ? rows[1]!.top - rows[0]!.top : windowHeight;
  const visible = Math.max(1, Math.floor(windowHeight / rowHeight));
  const anchor = Math.max(0, Math.floor((visible - 1) * 0.6));
  let row = 0;
  for (const cue of cues) {
    while (row + 1 < rows.length && rows[row + 1]!.start <= cue.start) row++;
    const offset = Math.min(overflow, Math.max(0, rows[Math.max(0, row - anchor)]!.top));
    if (offset > result.at(-1)!.offset) result.push({ frame: cue.frame, offset });
  }
  return result;
}

/** 推进在读到新行前完成，正放、倒放和直接seek使用同一短过渡，不累积滚动状态。 */
export function speechReadingOffset(
  stops: readonly SpeechReadingStop[],
  frame: number,
  transitionFrames: number,
  pixelsPerUnit = 1,
) {
  let low = 0,
    high = stops.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (stops[middle]!.frame <= frame) low = middle + 1;
    else high = middle;
  }
  const previous = stops[Math.max(0, low - 1)];
  if (!previous) return 0;
  const next = stops[low];
  const travel = next ? Math.min(positive(transitionFrames), next.frame - previous.frame) : 0;
  const fraction = next && travel > 0 ? progressAt((frame - next.frame + travel) / travel) : 0;
  const offset = previous.offset + (next ? next.offset - previous.offset : 0) * fraction;
  const pixels = positive(pixelsPerUnit) || 1;
  return !next ? Math.ceil(offset * pixels) / pixels : Math.round(offset * pixels) / pixels;
}

/** 保留旧计划的连续位移契约；没有新策略的已准备计划不改变像素位置。 */
export function readingOffset(overflow: number, progress: number) {
  return positive(overflow) * progressAt(progress);
}

export function readingLineStops(lineTops: readonly number[], overflow: number): number[] {
  const distance = positive(overflow);
  if (!distance) return [0];
  const tops = lineTops.filter(Number.isFinite).sort((a, b) => a - b);
  const origin = tops[0] ?? 0;
  const stops = [0];
  for (const top of tops) {
    const offset = top - origin;
    if (offset > stops.at(-1)! + 0.5 && offset < distance - 0.5) stops.push(offset);
  }
  stops.push(distance);
  return stops;
}

export function readingMotionOffset(
  overflow: number,
  progress: number,
  options: {
    motion?: VideoSpeechReadingOptions["motion"];
    transitionFrames?: number;
    scrollFrames?: number;
    stops?: readonly number[];
    pixelsPerUnit?: number;
  } = {},
) {
  if (!options.motion) return readingOffset(overflow, progress);
  if (options.motion === "static") return 0;
  const distance = positive(overflow);
  const time = progressAt(progress);
  let offset = distance * time;
  if (options.motion === "line") {
    const stops = options.stops ?? [0, distance];
    const steps = stops.length - 1;
    if (steps < 1 || !distance) return 0;
    if (time < 1) {
      const cycle = time * steps;
      const index = Math.min(steps - 1, Math.floor(cycle));
      const duration = Math.max(1, positive(options.scrollFrames ?? 1)) / steps;
      // 每次推进仅占本周期末尾最多30%，其余时间保持同一位置；0帧表示直接切换下一行。
      const travel = Math.min(0.3, positive(options.transitionFrames ?? 0) / duration);
      const fraction = travel > 0 ? Math.max(0, (cycle - index - (1 - travel)) / travel) : 0;
      offset = stops[index]! + (stops[index + 1]! - stops[index]!) * fraction;
    }
  }
  const pixels = positive(options.pixelsPerUnit ?? 1) || 1;
  // 预览缩放与设备像素密度同时入网格；尾帧向外取整至多一像素，避免末行被舍入裁掉。
  return time >= 1
    ? Math.ceil(distance * pixels) / pixels
    : Math.min(
        Math.ceil(distance * pixels) / pixels,
        Math.max(0, Math.round(offset * pixels) / pixels),
      );
}
