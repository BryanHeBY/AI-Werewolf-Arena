/**
 * 单元测试验证赤月使徒封夜、延期和到期事实。输入为手写字段、两语标签及畸形／外来成员／错误包络；
 * 输出以独立翻牌／死亡效果与拒绝预期核对接受面，到期须匹配原夜间日期，不执行生命周期或生成 golden。
 */
import { expect, test } from "bun:test";
import type { ReplayEvent } from "@ai-werewolf-arena/replay-contract";
import { readReplayEvent } from "../../../../src/replay/replay-event-reader";
import { eventLabel } from "../../../../src/replay/event-labels";
function event(
  type: string,
  payload: Record<string, unknown>,
  day = 1,
  phase = "voting",
): ReplayEvent {
  return { seq: 1, timestamp: new Date(0).toISOString(), day, phase, type, payload } as ReplayEvent;
}
for (const type of ["red_moon_night_sealed", "red_moon_exile_delayed"])
  test(type + ": reveals identity without premature death", () => {
    const e = event(type, { actorId: 4, day: 1, night: 2 });
    const fact = readReplayEvent(e, [1, 2, 3, 4, 5])!;
    expect(fact.relatedPlayerIds).toEqual([4]);
    expect(fact.effects).toEqual([
      { kind: "role_revealed", playerId: 4, role: "red_moon_apostle" },
    ]);
    expect(eventLabel(e)).toContain("4");
    expect(eventLabel(e)).not.toBe(type);
  });
test("Expiry has a death effect only with the matching night envelope", () => {
  const e = event("red_moon_delay_expired", { actorId: 4, day: 2 }, 2, "night");
  expect(readReplayEvent(e, [4])?.effects).toEqual([{ kind: "deaths", playerIds: [4] }]);
  expect(readReplayEvent({ ...e, phase: "day" } as ReplayEvent)).toBeNull();
  expect(readReplayEvent({ ...e, day: 3 })).toBeNull();
});
test("Red Moon replay rejects malformed facts, foreign players and wrong phases", () => {
  for (const payload of [
    { actorId: 4, day: 1, night: 3 },
    { actorId: 4, day: 1, night: 2, secret: true },
  ])
    expect(readReplayEvent(event("red_moon_exile_delayed", payload))).toBeNull();
  expect(
    readReplayEvent(event("red_moon_exile_delayed", { actorId: 4, day: 1, night: 2 }, 1, "night")),
  ).toBeNull();
  expect(
    readReplayEvent(event("red_moon_night_sealed", { actorId: 4, day: 1, night: 2 }), [1, 2]),
  ).toBeNull();
  expect(
    readReplayEvent(event("red_moon_night_sealed", { actorId: 4, day: 1, night: 2 }, 2)),
  ).toBeNull();
});
