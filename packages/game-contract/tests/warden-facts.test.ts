/** 负责典狱长纯事实的单元测试；以手写真值输入及独立预期验收严格字段、递增日期、全局一次与未完成receipt前缀，不读取运行状态。 */
import { expect, test } from "bun:test";
import {
  readWardenStateData,
  readWardenFact,
  WARDEN_POLICY,
  WARDEN_FORCE_POLICY,
} from "../src/facts/warden";
const state = (history: unknown[]) => ({
  policy: WARDEN_POLICY,
  forcePolicy: WARDEN_FORCE_POLICY,
  history,
});
test("秘密历史允许真实未完成决定并脱离引用", () => {
  const original = state([
    { day: 2, pair: [2, 3], decisions: [{ playerId: 2, choice: "trade" }], resolved: false },
  ]);
  const copy = readWardenStateData(original)!;
  expect<unknown>(copy).toEqual(original);
  expect(copy).not.toBe(original);
  expect(copy.history[0]).not.toBe(original.history[0]);
});
test("一次参与覆盖自选与不同日期，不接受虚假完成或重复回执", () => {
  for (const history of [
    [{ day: 1, pair: null, decisions: [], resolved: true }],
    [{ day: 2, pair: [2, 2], decisions: [], resolved: false }],
    [{ day: 2, pair: [2, 3], decisions: [], resolved: true }],
    [
      {
        day: 2,
        pair: [2, 3],
        decisions: [
          { playerId: 2, choice: "trade" },
          { playerId: 2, choice: "betray" },
        ],
        resolved: true,
      },
    ],
    [
      { day: 2, pair: [2, 3], decisions: [], resolved: false },
      { day: 3, pair: [2, 4], decisions: [], resolved: false },
    ],
    [{ day: 2, pair: null, decisions: [{ playerId: 2, choice: "trade" }], resolved: true }],
  ])
    expect(readWardenStateData(state(history))).toBeNull();
});
test("读器拒绝历史和receipt访问器且不执行其正文", () => {
  let calls = 0;
  const r = { day: 2, pair: [2, 3], decisions: [], resolved: false };
  Object.defineProperty(r, "decisions", {
    enumerable: true,
    get() {
      calls++;
      return [];
    },
  });
  expect(readWardenStateData(state([r]))).toBeNull();
  const h: unknown[] = [];
  Object.defineProperty(h, "0", {
    enumerable: true,
    get() {
      calls++;
      return r;
    },
  });
  expect(readWardenStateData(state(h))).toBeNull();
  expect(calls).toBe(0);
});
test("只接受具名严格秘密事实，不把pair通知升级为角色或决定知识", () => {
  const p = { policy: WARDEN_POLICY, day: 2, actorId: 2, partnerId: 3 };
  expect(readWardenFact("warden_partner_notified", p)).toEqual({
    type: "warden_partner_notified",
    payload: p,
  });
  for (const extra of [
    { ...p, wardenId: 1 },
    { ...p, choice: "trade" },
    { ...p, partnerId: 2 },
    { ...p, day: 1 },
  ])
    expect(readWardenFact("warden_partner_notified", extra)).toBeNull();
  expect(readWardenFact("other", p)).toBeNull();
});
