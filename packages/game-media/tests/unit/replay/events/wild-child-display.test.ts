/**
 * 单元测试验证野孩子事实接收、对应标签与事件前缀展示。输入为原字面量、畸形 payload、语言和用例表；手写字段、标签与效果预期作为独立 oracle，不执行真实游戏或重生成 golden。
 */
import { expect, test } from "bun:test";
import type { ReplayEvent } from "@ai-werewolf-arena/replay-contract";
import {
  readWildChildEventFact,
  readWildChildPlayerFact,
} from "@ai-werewolf-arena/game-contract/facts/wild-child";
import { wildChildEventLabel } from "@ai-werewolf-arena/game-presentation";
import { readReplayEvent } from "../../../../src/replay/replay-event-reader";
const fact = (type: string, payload: Record<string, unknown>): ReplayEvent => ({
  seq: 1,
  timestamp: "2026-10-09T00:00:00Z",
  phase: "voting",
  day: 1,
  type,
  payload,
});
test("Wild Child exact God and lean actor transformed facts share label/camp effects with no private cause projection", () => {
  const lean = { actorId: 1, day: 1, eligibleNight: 2, camp: "wolf" },
    god = { ...lean, deathCommit: "wild-model:1:2:1" };
  for (const p of [lean, god]) {
    expect(readReplayEvent(fact("wild_child_transformed", p), [1, 2])?.effects).toEqual([
      { kind: "camp_changed", playerId: 1, camp: "wolf" },
    ]);
    for (const locale of ["zh-CN", "en"] as const)
      expect(wildChildEventLabel("wild_child_transformed", p, locale)).toContain(
        locale === "en" ? "Wild Child" : "野孩子",
      );
  }
  expect(readWildChildPlayerFact("wild_child_transformed", god)).toBeNull();
  expect(readWildChildEventFact("wild_child_transformed", lean)).toBeNull();
  for (const bad of [
    { ...god, deathCommit: "wild-model:3:2:1" },
    { ...god, deathCommit: "wild-model:1:2:3" },
    { ...lean, extra: 1 },
    { ...lean, eligibleNight: 1 },
    { ...lean, actorId: 3 },
  ])
    expect(readReplayEvent(fact("wild_child_transformed", bad), [1, 2])).toBeNull();
});
test("Wild Child God death reader rejects unknown causes, extra IDs and accessors without executing them", () => {
  const p = {
    actorId: 1,
    targetId: 2,
    day: 1,
    phase: "voting",
    deathCommit: "wild-model:1:2:1",
    sources: ["exile"],
    deadIds: [2],
  };
  expect(readReplayEvent(fact("wild_child_model_eliminated", p), [1, 2])?.effects).toEqual([]);
  expect(readWildChildPlayerFact("wild_child_model_eliminated", p)).toBeNull();
  for (const bad of [
    { ...p, sources: ["not_a_cause"] },
    { ...p, deadIds: [2, 2] },
    { ...p, targetId: 1 },
    { ...p, deathCommit: "wild-model:1:3:1" },
  ])
    expect(readReplayEvent(fact("wild_child_model_eliminated", bad), [1, 2])).toBeNull();
  let reads = 0;
  expect(
    readReplayEvent(
      fact("wild_child_model_eliminated", {
        ...p,
        get sources() {
          reads++;
          return ["exile"];
        },
      }),
      [1, 2],
    ),
  ).toBeNull();
  expect(reads).toBe(0);
});
