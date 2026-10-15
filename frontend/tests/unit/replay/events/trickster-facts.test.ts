/**
 * 单元测试验证诡术师放逐映射和私有选择的两语事实。输入为手写目标／配对、missed 及错误阶段／额外字段；
 * 输出以独立关联、标签和空效果预期核对描述事实不自行杀人，原 case 表不变，不执行映射或生成 golden。
 */
import { expect, test } from "bun:test";
import type { ReplayEvent } from "@ai-werewolf-arena/replay-contract";
import { readReplayEvent } from "../../../../src/replay/replay-event-reader";
import { eventLabel } from "../../../../src/replay/event-labels";
function event(type: string, payload: Record<string, unknown>, phase = "voting"): ReplayEvent {
  return {
    seq: 1,
    timestamp: new Date(0).toISOString(),
    day: 1,
    phase,
    type,
    payload,
  } as ReplayEvent;
}
for (const locale of ["zh-CN", "en"] as const) {
  test("Trickster mapping describes outcome without creating a death/" + locale, () => {
    for (const missed of [false, true]) {
      const e = event("exile_target_mapped", { requestedId: 2, effectiveId: 3, missed });
      const f = readReplayEvent(e, [1, 2, 3])!;
      expect(f.relatedPlayerIds).toEqual([2, 3]);
      expect(f.effects).toEqual([]);
      expect(eventLabel(e, locale, [1, 2, 3])).toContain("2");
      expect(eventLabel(e, locale, [1, 2, 3])).toContain("3");
    }
  });
  test("Trickster private choices remain descriptive facts/" + locale, () => {
    const e = event("trickster_exchange_committed", { actorId: 1, day: 1, pair: [2, 3] }, "night");
    const f = readReplayEvent(e, [1, 2, 3])!;
    expect(f.effects).toEqual([]);
    expect(f.relatedPlayerIds).toEqual([1, 2, 3]);
    expect(eventLabel(e, locale, [1, 2, 3])).not.toContain("event.");
  });
}
test("Trickster rejects malformed, foreign, extra and wrong-phase replay facts", () => {
  for (const payload of [
    { requestedId: 2, effectiveId: 99, missed: false },
    { requestedId: 2, effectiveId: 2, missed: true },
    { requestedId: 2, effectiveId: 3, missed: "false" },
    { requestedId: 2, effectiveId: 3, missed: false, pair: [2, 3] },
  ])
    expect(readReplayEvent(event("exile_target_mapped", payload), [1, 2, 3])).toBeNull();
  expect(
    readReplayEvent(
      event("exile_target_mapped", { requestedId: 2, effectiveId: 3, missed: false }, "night"),
      [1, 2, 3],
    ),
  ).toBeNull();
  for (const payload of [
    { actorId: 1, day: 2, pair: [2, 3] },
    { actorId: 1, day: 1, pair: [3, 2] },
    { actorId: 1, day: 1, pair: [2, 99] },
    { actorId: 1, day: 1, pair: null, secret: "leak" },
  ])
    expect(
      readReplayEvent(event("trickster_exchange_committed", payload, "night"), [1, 2, 3]),
    ).toBeNull();
});
