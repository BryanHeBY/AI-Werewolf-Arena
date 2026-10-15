/**
 * 单元测试验证噩梦之影完整／本人事实的接受与包络一致性。输入为手写 God／玩家 payload、畸形字段和昼夜／日期；
 * 输出按独立有效／拒绝预期核对规范读取，不保留部分效果。原 case 表不变，不执行游戏或重新生成 golden。
 */
import { expect, test } from "bun:test";
import type { ReplayEvent } from "@ai-werewolf-arena/replay-contract";
import { readReplayEvent } from "../../../../src/replay/replay-event-reader";
function event(payload: Record<string, unknown>, day = 1, phase = "night"): ReplayEvent {
  return {
    seq: 1,
    timestamp: new Date(0).toISOString(),
    day,
    phase,
    type: "nightmare_fear_committed",
    payload,
  } as ReplayEvent;
}
for (const payload of [
  { actorId: 1, day: 1, targetId: 2 },
  { actorId: 1, day: 1, targetId: null },
  { day: 1, targetId: 2 },
  { day: 1, targetId: null },
])
  test(`nightmare replay accepts canonical full or own fact ${JSON.stringify(payload)}`, () => {
    expect(readReplayEvent(event(payload))).not.toBeNull();
  });
for (const payload of [
  { actorId: 1, day: 1, targetId: 1 },
  { actorId: 0, day: 1, targetId: 2 },
  { day: 1, targetId: 2, wolfBlocked: true },
  { day: 0, targetId: 2 },
  { day: 1, targetId: -1 },
  { day: 1 },
])
  test(`nightmare replay rejects malformed fact ${JSON.stringify(payload)}`, () => {
    expect(readReplayEvent(event(payload))).toBeNull();
  });
test("nightmare replay requires matching night/day envelope", () => {
  expect(readReplayEvent(event({ day: 1, targetId: 2 }, 2))).toBeNull();
  expect(readReplayEvent(event({ day: 1, targetId: 2 }, 1, "voting"))).toBeNull();
});
