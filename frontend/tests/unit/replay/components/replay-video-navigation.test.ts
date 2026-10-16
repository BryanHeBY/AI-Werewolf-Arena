/**
 * 单元测试负责原事件揭晓帧的前后导航边界。输入为独立字面帧表和当前／参考位置，输出严格前后位置。
 * 不编译视频或生成预期；聚合事件共享落点时不重复停留，独立事实区间可以回到最近源事件。
 */
import { expect, test } from "bun:test";
import { replayFrameNeighbours } from "../../../../src/replay/replay-video-navigation";

test("transport crosses unique event reveals rather than replaying an absorbed ballot frame", () => {
  const frames = [24, 114, 204];
  expect(replayFrameNeighbours(frames, 0, 0)).toEqual({ previous: null, next: 24 });
  expect(replayFrameNeighbours(frames, 114, 114)).toEqual({ previous: 24, next: 204 });
  expect(replayFrameNeighbours(frames, 140, 114)).toEqual({ previous: 24, next: 204 });
  expect(replayFrameNeighbours(frames, 200, 200)).toEqual({ previous: 114, next: 204 });
  expect(replayFrameNeighbours(frames, 250, 204)).toEqual({ previous: 114, next: null });
  expect(replayFrameNeighbours([], 0, 0)).toEqual({ previous: null, next: null });
});
