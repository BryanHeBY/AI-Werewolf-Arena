/**
 * 单元测试验证学者／导师选择、跳过、冲突和奖励事实的两语展示。
 * 输入为手写 case 表及错误日期／阶段／额外字段／玩家引用；输出按独立标签和空效果预期核对接受／拒绝，不执行规则或生成 golden。
 */
import { test, expect } from "bun:test";
import type { ReplayEvent } from "@ai-werewolf-arena/replay-contract";
import { readReplayEvent } from "../../../../src/replay/replay-event-reader";
import { eventLabel } from "../../../../src/replay/event-labels";
const facts = [
  ["modifier_choice_committed", { actorId: 1, day: 2, mode: "enhance", targetId: 3 }],
  ["modifier_choice_skipped", { actorId: 1, day: 2, reason: "exhausted" }],
  ["modifier_conflict_resolved", { day: 2, kind: "same_good", targetId: 3 }],
  [
    "modifier_bonus_resolved",
    { actorId: 3, day: 2, kind: "check", targetId: 4, abstain: false, isWerewolf: true },
  ],
] as const;
for (const [type, payload] of facts)
  for (const locale of ["zh-CN", "en"] as const)
    test("Scholar Mentor replay fact/" + type + "/" + locale, () => {
      const event: ReplayEvent = {
        seq: 1,
        timestamp: "2026-10-11T00:00:00Z",
        phase: "night",
        day: 2,
        type,
        payload: { ...payload },
      };
      const read = readReplayEvent(event, [1, 2, 3, 4]);
      expect(read).not.toBeNull();
      expect(read!.effects).toEqual([]);
      expect(eventLabel(event, locale)).not.toContain(type);
      expect(readReplayEvent({ ...event, phase: "day" }, [1, 2, 3, 4])).toBeNull();
      expect(readReplayEvent({ ...event, day: 3 }, [1, 2, 3, 4])).toBeNull();
      expect(
        readReplayEvent({ ...event, payload: { ...payload, extra: true } }, [1, 2, 3, 4]),
      ).toBeNull();
    });
test("Scholar Mentor replay rejects unknown player references", () => {
  const event: ReplayEvent = {
    seq: 1,
    timestamp: "2026-10-11T00:00:00Z",
    phase: "night",
    day: 2,
    type: "modifier_conflict_resolved",
    payload: { day: 2, kind: "same_good", targetId: 9 },
  };
  expect(readReplayEvent(event, [1, 2, 3, 4])).toBeNull();
});
