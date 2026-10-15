/**
 * 单元测试负责验证时序妃锁定事实及复盘文案；输入与独立字段／标签预期均来自原用例表，畸形记录应按原 reader 拒绝，不执行真实对局或模型。
 */
import { expect, test } from "bun:test";
import type { ReplayEvent } from "@ai-werewolf-arena/replay-contract";
import { readReplayEvent } from "../../../../src/replay/replay-event-reader";
import { eventLabel } from "../../../../src/replay/event-labels";
import { readTimeConsortReflectionFact } from "@ai-werewolf-arena/game-contract/facts/time-wolf-consort";
function event(type: string, payload: Record<string, unknown>, phase = "night"): ReplayEvent {
  return {
    seq: 1,
    timestamp: new Date(0).toISOString(),
    day: 2,
    phase,
    type,
    payload,
  } as ReplayEvent;
}
for (const locale of ["zh-CN", "en"] as const) {
  test("Consort lock remains descriptive/" + locale, () => {
    for (const targetId of [2, null]) {
      const e = event("time_consort_lock_committed", { actorId: 1, day: 2, targetId }),
        f = readReplayEvent(e, [1, 2, 3])!;
      expect(f.effects).toEqual([]);
      expect(f.relatedPlayerIds).toEqual(targetId ? [1, 2] : [1]);
      expect(eventLabel(e, locale, [1, 2, 3])).not.toContain("event.");
    }
  });
  test("Consort skips preserve public state/" + locale, () => {
    for (const reason of ["dead", "exhausted"]) {
      const e = event("time_consort_lock_skipped", { actorId: 1, day: 2, reason }),
        f = readReplayEvent(e, [1, 2, 3])!;
      expect(f.effects).toEqual([]);
      expect(f.relatedPlayerIds).toEqual([1]);
      expect(eventLabel(e, locale, [1, 2, 3])).not.toContain("event.");
    }
  });
  test("Consort reflections are not immediate deaths/" + locale, () => {
    for (const kind of ["check", "guard", "poison"]) {
      const e = event("time_consort_reflected", {
          actorId: 1,
          day: 2,
          sourceId: 2,
          requestedId: 3,
          effectiveId: 2,
          kind,
        }),
        f = readReplayEvent(e, [1, 2, 3])!;
      expect(f.effects).toEqual([]);
      expect(f.relatedPlayerIds).toEqual([1, 2, 3]);
      expect(eventLabel(e, locale, [1, 2, 3])).not.toContain("event.");
    }
  });
}
test("Consort reader rejects invalid day, scope, target and extra fields", () => {
  for (const payload of [
    { actorId: 1, day: 1, targetId: 2 },
    { actorId: 1, day: 2, targetId: 99 },
    { actorId: 1, day: 2, targetId: 2, extra: true },
  ]) {
    expect(readReplayEvent(event("time_consort_lock_committed", payload), [1, 2, 3])).toBeNull();
  }
  expect(
    readReplayEvent(
      event("time_consort_lock_committed", { actorId: 1, day: 2, targetId: 2 }, "voting"),
      [1, 2, 3],
    ),
  ).toBeNull();
  for (const delta of [
    { kind: "heal" },
    { kind: { toString: 3 } },
    { effectiveId: 3 },
    { sourceId: 99 },
    { extra: true },
    { day: 1 },
  ]) {
    const p = {
      actorId: 1,
      day: 2,
      sourceId: 2,
      requestedId: 3,
      effectiveId: 2,
      kind: "poison",
      ...delta,
    };
    expect(readReplayEvent(event("time_consort_reflected", p), [1, 2, 3])).toBeNull();
    if ("kind" in delta)
      expect(readTimeConsortReflectionFact("time_consort_reflected", p)).toBeNull();
  }
});
