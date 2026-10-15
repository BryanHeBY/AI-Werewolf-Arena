/**
 * 单元测试验证猎魔人的全知／玩家事实精确字段与受众、getter 的失败关闭边界。输入为完整／本人字面量和字段变体，只构造投影所需的局部 World；预期为精确接受数据、null 拒绝、合法标签和零 getter 读取，不执行完整夜间或文件录制。
 */
import { expect, test } from "bun:test";
import { DEMON_HUNTER_POLICY, readDemonHunterEventFact, readDemonHunterPlayerFact } from "@ai-werewolf-arena/game-contract/facts/demon-hunter";
import { demonHunterEventLabel } from "@ai-werewolf-arena/game-presentation";
import { type GameEvent } from "../../../../src/domain";
import { demonHunterFixture } from "../../../support/features/demon-hunter/builders/candidate-world";
import { buildAgentVisibleEventFeed } from "../../../../src/agents/observation/event-feed";

const chosen = { policy: DEMON_HUNTER_POLICY, actorId: 6, day: 2, targetId: 1 },
  own = { policy: DEMON_HUNTER_POLICY, day: 2, targetId: 1 };

for (const [type, full] of [
  ["demon_hunter_chosen", chosen],
  ["demon_hunter_chosen", { ...chosen, targetId: null }],
  ["demon_hunter_cancelled", { ...chosen, reason: "authority_revoked", faultId: null }],
  ["demon_hunter_cancelled", { ...chosen, reason: "authority_revoked", faultId: "actual-fault-1" }],
  ["demon_hunter_poison_immune", { policy: DEMON_HUNTER_POLICY, actorId: 6, day: 1, witchId: 5 }],
] as const)
  test(`strict God fact ${type}/${JSON.stringify(full)}`, () => {
    expect(readDemonHunterEventFact(type, full)).toEqual(full);
    expect(readDemonHunterPlayerFact(type, full)).toBeNull();
    for (const locale of ["zh-CN", "en"] as const)
      expect(demonHunterEventLabel(type, full, locale)).not.toBeNull();
    for (const field of ["camp", "role", "immune", "casterId", "remaining", "damage", "winner"]) {
      expect(readDemonHunterEventFact(type, { ...full, [field]: "wolf" })).toBeNull();
      expect(demonHunterEventLabel(type, { ...full, [field]: "wolf" }, "en")).toBeNull();
    }
  });

test("own choice exact fields, no actor/source/outcome and malformed getters execute zero", () => {
  expect(readDemonHunterPlayerFact("demon_hunter_chosen", own)).toEqual(own);
  expect(readDemonHunterEventFact("demon_hunter_chosen", own)).toBeNull();
  for (const field of ["actorId", "witchId", "faultId", "reason", "camp", "immune"])
    expect(readDemonHunterPlayerFact("demon_hunter_chosen", { ...own, [field]: 6 })).toBeNull();
  let reads = 0;
  const malformed = Object.defineProperty({ ...chosen }, "targetId", {
    get() {
      reads++;
      return 1;
    },
    enumerable: true,
  });
  expect(readDemonHunterEventFact("demon_hunter_chosen", malformed)).toBeNull();
  expect(demonHunterEventLabel("demon_hunter_chosen", malformed, "en")).toBeNull();
  expect(reads).toBe(0);
});

test("forged audience never exposes cancellation/immunity; copied or malformed choice fails closed", () => {
  const f = demonHunterFixture();
  const facts: GameEvent[] = [
    {
      timestamp: 0,
      type: "demon_hunter_chosen",
      payload: { ...chosen, actorId: 5 },
      audience: [5],
    },
    {
      timestamp: 1,
      type: "demon_hunter_cancelled",
      payload: { ...chosen, targetId: 1, reason: "authority_revoked", faultId: null },
      audience: [6],
    },
    {
      timestamp: 2,
      type: "demon_hunter_poison_immune",
      payload: { policy: DEMON_HUNTER_POLICY, actorId: 6, day: 1, witchId: 5 },
      audience: [6],
    },
    { timestamp: 3, type: "demon_hunter_chosen", payload: chosen, audience: [5] },
    { timestamp: 4, type: "demon_hunter_chosen", payload: chosen, audience: [5, 6] },
    {
      timestamp: 5,
      type: "demon_hunter_chosen",
      payload: { ...chosen, camp: "wolf" } as any,
      audience: [6],
    },
  ];
  for (const id of f.world.entityIds())
    expect(buildAgentVisibleEventFeed(f.world, facts, id)).toEqual([]);
});
