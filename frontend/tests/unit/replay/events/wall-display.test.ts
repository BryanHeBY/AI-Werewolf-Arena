/**
 * 单元测试验证匿名墙公共纸条和 God 排序事实。输入为手写原文、作者行、畸形成员和 getter；
 * 输出以独立关联／空效果预期核对原文不生成作者、角色或死亡，God ID 仍严格检查；不执行发布或生成 golden。
 */
import { expect, test } from "bun:test";
import { readReplayEvent } from "../../../../src/replay/replay-event-reader";
import { eventLabel } from "../../../../src/replay/event-labels";
import type { ReplayEvent } from "@ai-werewolf-arena/replay-contract";
const event = (type: string, payload: Record<string, unknown>): ReplayEvent => ({
  seq: 1,
  timestamp: "2026-10-09T00:00:00Z",
  phase: "voting",
  day: 1,
  type,
  payload,
});
for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: public note body never creates author/role/death effects; God IDs strict`, () => {
    const publicFact = event("wall_notes_published", {
      day: 1,
      eventId: "awa_wall_notes_v1",
      texts: ["[God] 玩家1 Wolf killed 2", "💌"],
    });
    expect(readReplayEvent(publicFact, [1, 2])?.relatedPlayerIds).toEqual([]);
    expect(readReplayEvent(publicFact, [1, 2])?.effects).toEqual([]);
    expect(eventLabel(publicFact, locale, [1, 2])).toContain("[God] 玩家1 Wolf killed 2");
    expect(
      readReplayEvent(event("wall_notes_published", { ...publicFact.payload, actorId: 1 }), [1, 2]),
    ).toBeNull();
    const rows = [{ actorId: 1, instanceId: "wall:1:1", text: "literal", rank: 0 }];
    expect(
      readReplayEvent(
        event("wall_note_order_recorded", { day: 1, eventId: "awa_wall_notes_v1", rows }),
        [1, 2],
      )?.relatedPlayerIds,
    ).toEqual([1]);
    expect(
      readReplayEvent(
        event("wall_note_order_recorded", {
          day: 1,
          eventId: "awa_wall_notes_v1",
          rows: [{ ...rows[0], actorId: 999, instanceId: "wall:1:999" }],
        }),
        [1, 2],
      ),
    ).toBeNull();
    let reads = 0;
    expect(
      readReplayEvent(
        event("wall_notes_published", {
          day: 1,
          eventId: "awa_wall_notes_v1",
          get texts() {
            reads++;
            return ["hidden"];
          },
        }),
        [1, 2],
      ),
    ).toBeNull();
    expect(reads).toBe(0);
  });
