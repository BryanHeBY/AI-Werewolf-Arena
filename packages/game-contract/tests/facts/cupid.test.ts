/**
 * 包级单元测试验证丘比特配对、识别和关系的传输数据。
 * 独立未排序配对与阵营字面预期核对首日、精确字段、混合阵营关联和可空拒绝；保留输入配对顺序。
 * 测试不创建恋人关系、胜利政策或玩家状态，读取通过不表示绑定许可。
 */
import { expect, test } from "bun:test";
import {
  CUPID_EVENT_TYPES,
  readCupidEventFact,
} from "@ai-werewolf-arena/game-contract/facts/cupid";
test("unsorted distinct pair and recognition are detached original shapes", () => {
  expect<unknown>(CUPID_EVENT_TYPES).toEqual([
    "cupid_lovers_chosen",
    "lover_recognized",
    "cupid_relation_resolved",
    "lovers_death",
  ]);
  const input = { actorId: 1, day: 1, pairIds: [3, 2] },
    fact = readCupidEventFact("cupid_lovers_chosen", input)!;
  expect<unknown>(fact).toEqual(input);
  expect(fact).not.toBe(input);
  expect(fact.pairIds).not.toBe(input.pairIds);
  expect(Object.getPrototypeOf(fact)).toBeNull();
  expect(
    readCupidEventFact("lover_recognized", { actorId: Number.MAX_SAFE_INTEGER, partnerId: 2 }),
  ).not.toBeNull();
  expect(readCupidEventFact("lover_recognized", { actorId: 2, partnerId: 2 })).toBeNull();
});
test("relation camps require the original mixed flag and exact policy/group fields", () => {
  const value = {
    actorId: 1,
    day: 1,
    policy: "netease_2017_cupid_follows_lovers_v1",
    pairIds: [3, 2],
    pairCamps: ["wolf", "good"],
    groupId: "cupid_lovers",
    mixed: true,
  };
  expect<unknown>(readCupidEventFact("cupid_relation_resolved", value)).toEqual(value);
  for (const delta of [
    { mixed: false },
    { groupId: "other" },
    { policy: "other" },
    { pairIds: [2, 2] },
    { day: 2 },
  ])
    expect(readCupidEventFact("cupid_relation_resolved", { ...value, ...delta })).toBeNull();
});
test("unknown and accessor payloads reject without running getter values", () => {
  let reads = 0;
  const value = {
    actorId: 1,
    day: 1,
    get pairIds() {
      reads++;
      return [2, 3];
    },
  };
  expect(readCupidEventFact("unknown", value)).toBeNull();
  expect(readCupidEventFact("cupid_lovers_chosen", value)).toBeNull();
  expect(reads).toBe(0);
  expect(
    readCupidEventFact("lovers_death", { actorId: 1, targetId: 2, source: "extra" }),
  ).toBeNull();
});
