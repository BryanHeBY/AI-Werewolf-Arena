/**
 * 单元测试负责逐行停顿、短推进、像素网格与旧计划兼容。输入为独立手写行位置和帧进度，输出字面位移。
 * 不从生产排版推预期，不启动浏览器；真实字体、缩放和可见末行由浏览器与实际导出另行核对。
 */
import { expect, test } from "bun:test";
import {
  readingLineStops,
  readingMotionOffset,
} from "../../../src/video/render/broadcast/reading-motion";

test("measured rows retain a final partial line without inventing word-based pagination", () => {
  expect(readingLineStops([2, 2, 42, 82, 122, 162], 95)).toEqual([0, 40, 80, 95]);
  expect(readingLineStops([2, 42], 0)).toEqual([0]);
  expect(readingLineStops([], 20)).toEqual([0, 20]);
});

test("each row holds still for reading and uses only a brief linear travel at its end", () => {
  const options = {
    motion: "line" as const,
    stops: [0, 40, 80, 95],
    scrollFrames: 300,
    transitionFrames: 5,
  };
  expect(
    [0, 20, 90, 96, 100, 150, 190, 199, 200, 300, 150].map((frame) =>
      readingMotionOffset(95, frame / 300, options),
    ),
  ).toEqual([0, 0, 0, 8, 40, 40, 40, 72, 80, 95, 40]);
  expect(readingMotionOffset(95, 0.32, { ...options, transitionFrames: 0 })).toBe(0);
  expect(readingMotionOffset(95, 1 / 3, { ...options, transitionFrames: 0 })).toBe(40);
});

test("short budgets cap travel to thirty percent so every cycle still has a stationary hold", () => {
  const options = {
    motion: "line" as const,
    stops: [0, 40],
    scrollFrames: 10,
    transitionFrames: 8,
  };
  expect(
    [0, 0.5, 0.7, 0.85, 1].map((progress) => readingMotionOffset(40, progress, options)),
  ).toEqual([0, 0, 0, 20, 40]);
});

test("preview scale and density snap to physical pixels while the final line remains fully reachable", () => {
  const options = {
    motion: "line" as const,
    stops: [0, 37.7, 75.4],
    scrollFrames: 300,
    transitionFrames: 5,
    pixelsPerUnit: 0.5,
  };
  expect(readingMotionOffset(75.4, 0.5, options)).toBe(38);
  expect(readingMotionOffset(75.4, 1, options)).toBe(76);
  for (const progress of [0, 0.1, 0.49, 0.5, 0.99, 1, 0.1]) {
    const offset = readingMotionOffset(75.4, progress, options);
    expect(offset * 0.5).toBe(Math.round(offset * 0.5));
    expect(
      readingMotionOffset(75.4, progress, { ...options, scrollFrames: 600, transitionFrames: 10 }),
    ).toBe(offset);
  }
});

test("static is explicit, new continuous snaps pixels, and archived readings preserve their original linear values", () => {
  expect(readingMotionOffset(75.4, 0.5)).toBe(37.7);
  expect(readingMotionOffset(75.4, 0.5, { motion: "continuous", pixelsPerUnit: 0.5 })).toBe(38);
  for (const progress of [0, 0.5, 1, 2])
    expect(readingMotionOffset(100, progress, { motion: "static" })).toBe(0);
  expect(readingMotionOffset(-1, 0.5, { motion: "line" })).toBe(0);
  expect(readingMotionOffset(100, NaN, { motion: "line" })).toBe(0);
});
