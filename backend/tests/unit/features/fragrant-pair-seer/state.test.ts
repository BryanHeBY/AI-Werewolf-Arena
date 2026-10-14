/**
 * 单元测试验证寻香魅影与原成对查验的独立纯状态规则，输入原内存状态与显式非法变体。
 * 原字面历史、引用与错误／拒绝断言是预期；不从新槽 owner 生成答案或推进完整对局。
 * 本次仅迁真实声明来源及中文说明，原 fixture、case 名称、数据接受政策和 assertions 保持。
 */
import { expect, test } from "bun:test";
import {
  freshFragrantState,
  readFragrantState,
  commitKnownWolf,
  chooseFragrantPair,
  expireFragrantAtNightOpen,
  triggerFragrantPair,
} from "../../../../src/game/mechanisms/roles/fragrant_pair_seer/fragrant-state-slot";
import { freshPairSeerState, readPairSeerState, appendPairCheck, normalizePair } from "../../../../src/game/mechanisms/roles/fragrant_pair_seer/state";
const ready = () => commitKnownWolf(freshFragrantState(), 10);
test("pair history is one atomic normalized boolean with no single identity", () => {
  const before = freshPairSeerState(),
    a = appendPairCheck(before, 1, [7, 2], true),
    b = appendPairCheck(a, 2, [2, 7], true);
  expect(before.history).toEqual([]);
  expect(a.history).toEqual([{ day: 1, targetIds: [2, 7], containsWerewolf: true }]);
  expect(b.history).toEqual([
    { day: 1, targetIds: [2, 7], containsWerewolf: true },
    { day: 2, targetIds: [2, 7], containsWerewolf: true },
  ]);
  expect(appendPairCheck(b, 3, [3, 6], false).history.at(-1)).toEqual({
    day: 3,
    targetIds: [3, 6],
    containsWerewolf: false,
  });
  expect(() => appendPairCheck(a, 2, [2, 7], false)).toThrow(
    "fragrant_pair_check_result_inconsistent",
  );
  expect(() => appendPairCheck(a, 1, [2, 7], false)).toThrow();
  expect(() => appendPairCheck(a, 2, [2, 2], true)).toThrow();
  expect(() => appendPairCheck(a, 2, [2], true)).toThrow();
  expect(readPairSeerState({ ...b, result: { camp: "wolf" } })).toBeNull();
  expect(
    readPairSeerState({
      ...b,
      history: [{ day: 1, targetIds: [2, 7], containsWerewolf: true, count: 1 }],
    }),
  ).toBeNull();
});
test("knowledge assignment is once only and does not consume a future binding", () => {
  const before = freshFragrantState(),
    after = commitKnownWolf(before, 10);
  expect(before.knownWolfId).toBeNull();
  expect(after.knownWolfId).toBe(10);
  expect(after.trigger).toBeNull();
  expect(() => commitKnownWolf(after, 11)).toThrow();
  expect(() => chooseFragrantPair(before, 1, [6, 7])).toThrow();
});
test("unused paid relation expires at next night, pass does not extend it", () => {
  const a = chooseFragrantPair(ready(), 1, [7, 6]);
  expect(() => chooseFragrantPair(a, 2, [6, 8])).toThrow();
  const opened = expireFragrantAtNightOpen(a, 2),
    passed = chooseFragrantPair(opened, 2, null),
    next = chooseFragrantPair(expireFragrantAtNightOpen(passed, 3), 3, [8, 6]);
  expect(a.bindings[0]!.status).toEqual({ kind: "pending" });
  expect(passed.lastChoice).toEqual({ day: 2, pairIds: null });
  expect(passed.bindings).toEqual([
    {
      id: "fragrant:night:1",
      createdNight: 1,
      expiresNight: 2,
      pairIds: [6, 7],
      status: { kind: "expired", day: 2 },
    },
  ]);
  expect(next.bindings[1]).toEqual({
    id: "fragrant:night:3",
    createdNight: 3,
    expiresNight: 4,
    pairIds: [6, 8],
    status: { kind: "pending" },
  });
  expect(next.trigger).toBeNull();
  expect(readFragrantState(next)).not.toBeNull();
});
test("trigger is once, distinguishes same-wave independent death and survives in a receipt", () => {
  const a = chooseFragrantPair(ready(), 1, [6, 7]),
    b = triggerFragrantPair(a, 1, 6, 7),
    same = triggerFragrantPair(a, 1, 7, null);
  expect(a.trigger).toBeNull();
  expect(b.trigger).toEqual({ bindingId: "fragrant:night:1", day: 1, rootId: 6, addedTargetId: 7 });
  expect(same.trigger).toEqual({
    bindingId: "fragrant:night:1",
    day: 1,
    rootId: 7,
    addedTargetId: null,
  });
  expect(() => triggerFragrantPair(b, 1, 7, 6)).toThrow();
  expect(() => chooseFragrantPair(expireFragrantAtNightOpen(b, 2), 2, [6, 8])).toThrow();
  expect(() => triggerFragrantPair(a, 2, 6, 7)).toThrow();
  expect(() => triggerFragrantPair(a, 1, 6, 6)).toThrow();
  expect(readFragrantState(b)).not.toBeNull();
  expect(readFragrantState({ ...b, lastChoice: { day: 1, pairIds: null } })).toBeNull();
  expect(
    readFragrantState({
      ...expireFragrantAtNightOpen(a, 2),
      lastChoice: { day: 1, pairIds: null },
    }),
  ).toBeNull();
});
test("readers reject inconsistent or extra receipts without invoking getters", () => {
  const a = chooseFragrantPair(ready(), 1, [6, 7]);
  for (const changed of [
    { ...a, knowledgeNight: null },
    { ...a, lastChoice: { day: 2, pairIds: null } },
    { ...a, bindings: [...a.bindings, ...a.bindings] },
  ])
    expect(readFragrantState(changed)).toBeNull();
  let reads = 0;
  const getter = {
    ...a,
    get trigger() {
      reads++;
      throw Error("must not invoke");
    },
  };
  expect(readFragrantState(getter)).toBeNull();
  expect(reads).toBe(0);
  expect(readFragrantState(new Proxy(a, {}))).toBeNull();
  const body = [6, 7];
  Object.defineProperty(body, "1", {
    get() {
      reads++;
      return 7;
    },
  });
  expect(() => normalizePair(body)).toThrow();
  expect(reads).toBe(0);
});
