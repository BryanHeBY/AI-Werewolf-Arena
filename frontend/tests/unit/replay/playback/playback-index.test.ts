/**
 * 单元测试负责验证可变镜头的事件边界。输入为手写起点和采样帧，输出为独立预期的展示索引与端点断言。
 * 不把原归档 seq 当作帧偏移，不启动播放器、模型或游戏规则。
 */
import { expect, test } from "bun:test";
import { replayPlaybackIndex } from "../../../../src/replay/useReplayPlayback";

test("variable scene starts map hold frames and exact boundaries to presentation indexes", () => {
  const starts = [0, 90, 450, 630];
  for (const [frame, index] of [
    [0, 0],
    [89, 0],
    [90, 1],
    [449, 1],
    [450, 2],
    [629, 2],
    [630, 3],
    [900, 3],
  ])
    expect(replayPlaybackIndex(frame!, starts)).toBe(index!);
  expect(replayPlaybackIndex(0, [])).toBe(0);
});
