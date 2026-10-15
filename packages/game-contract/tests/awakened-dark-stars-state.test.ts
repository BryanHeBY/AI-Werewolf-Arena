/**
 * 负责暗夜星辰两角色纯库存的单元测试；以独立手写历史验证冷却、唯一付款与明确空过。
 * 仅核惰性数据契约，不把成功解析当原体许可、真实付款或实际死亡证据。
 */
import { expect, test } from "bun:test";
import { Phase } from "../src/identity";
import { DeathCause } from "../src/death-facts";
import { AWAKENED_BEAUTY_POLICY, readAwakenedBeautyStateData } from "../src/facts/awakened-beauty";
import { AWAKENED_PATROL_POLICY, readAwakenedPatrolStateData } from "../src/facts/awakened-patrol";
test("狼美人N1非空后N2连null也无请求，N3可再次同目标", () => {
  const source = {
    policy: AWAKENED_BEAUTY_POLICY,
    choices: [
      { day: 1, targetId: 5 },
      { day: 3, targetId: 5 },
    ],
    replacement: null,
  };
  const copied = readAwakenedBeautyStateData(source)!;
  expect(copied).toEqual(source);
  expect(copied.choices).not.toBe(source.choices);
  expect(
    readAwakenedBeautyStateData({
      ...source,
      choices: [
        { day: 1, targetId: 5 },
        { day: 2, targetId: null },
      ],
    }),
  ).toBeNull();
  expect(
    readAwakenedBeautyStateData({
      ...source,
      choices: [
        { day: 2, targetId: null },
        { day: 3, targetId: 5 },
      ],
    }),
  ).not.toBeNull();
});
test("替死receipt只能绑定本夜实际非空选择，完整原因与根阶段不省略", () => {
  const source = {
    policy: AWAKENED_BEAUTY_POLICY,
    choices: [{ day: 1, targetId: 5 }],
    replacement: {
      day: 1,
      phase: Phase.Day,
      rootPhase: Phase.Night,
      targetId: 5,
      preventedCauses: [DeathCause.WolfKill, DeathCause.Poison],
    },
  };
  expect(readAwakenedBeautyStateData(source)).toEqual(source);
  expect(
    readAwakenedBeautyStateData({ ...source, replacement: { ...source.replacement, day: 2 } }),
  ).toBeNull();
  expect(
    readAwakenedBeautyStateData({ ...source, replacement: { ...source.replacement, targetId: 6 } }),
  ).toBeNull();
  expect(
    readAwakenedBeautyStateData({
      ...source,
      replacement: { ...source.replacement, preventedCauses: [] },
    }),
  ).toBeNull();
});
test("巡猎null明确消费，方向不能携非法目标或额外选择字段", () => {
  const source = {
    policy: AWAKENED_PATROL_POLICY,
    payment: { day: 2, rootPhase: Phase.Voting, direction: null, targetId: null },
  };
  expect(readAwakenedPatrolStateData(source)).toEqual(source);
  expect(
    readAwakenedPatrolStateData({ ...source, payment: { ...source.payment, targetId: 5 } }),
  ).toBeNull();
  expect(
    readAwakenedPatrolStateData({
      ...source,
      payment: { ...source.payment, direction: "clockwise", targetId: 5 },
    }),
  ).not.toBeNull();
  expect(
    readAwakenedPatrolStateData({ ...source, payment: { ...source.payment, target_id: 5 } }),
  ).toBeNull();
});
test("两读器拒绝普通访问器且正文零执行", () => {
  let calls = 0;
  for (const [read, input] of [
    [
      readAwakenedBeautyStateData,
      {
        policy: AWAKENED_BEAUTY_POLICY,
        choices: [],
        get replacement() {
          calls++;
          return null;
        },
      },
    ],
    [
      readAwakenedPatrolStateData,
      {
        policy: AWAKENED_PATROL_POLICY,
        get payment() {
          calls++;
          return null;
        },
      },
    ],
  ] as const)
    expect(read(input)).toBeNull();
  expect(calls).toBe(0);
});
