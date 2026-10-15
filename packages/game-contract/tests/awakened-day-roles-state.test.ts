/**
 * 单元测试负责觉醒守卫／骑士纯历史的独立字面验证。输入为手写周期和尝试，不运行生产付款求预期。
 * 保护相邻单位、整局目标唯一、同链误中结束和严格未知字段均由合同检查，JSON不创造运行许可。
 */
import { expect, test } from "bun:test";
import {
  readAwakenedGuardStateData,
  AWAKENED_GUARD_POLICY,
  type AwakenedGuardState,
} from "../src/facts/awakened-guard";
import {
  readAwakenedKnightStateData,
  AWAKENED_DUEL_POLICY,
  type AwakenedKnightState,
} from "../src/facts/awakened-duel";
test("Guard history is detached; a whole empty cycle breaks consecutive protection", () => {
  const input = {
    policy: AWAKENED_GUARD_POLICY,
    cycles: [
      { day: 1, status: "protected", targetId: 5, timing: "night" },
      { day: 2, status: "passed" },
      { day: 3, status: "protected", targetId: 5, timing: "day" },
    ],
  } satisfies AwakenedGuardState;
  const read = readAwakenedGuardStateData(input)!;
  expect(read).toEqual(input);
  input.cycles[0]!.targetId = 6;
  expect(read.cycles[0]).toEqual({ day: 1, status: "protected", targetId: 5, timing: "night" });
  expect(
    readAwakenedGuardStateData({
      policy: AWAKENED_GUARD_POLICY,
      cycles: [
        { day: 1, status: "protected", targetId: 5, timing: "night" },
        { day: 2, status: "protected", targetId: 5, timing: "day" },
      ],
    }),
  ).toBeNull();
});
test.each(
  [
    [
      { day: 1, status: "open" },
      { day: 2, status: "unused" },
    ],
    [{ day: 2, status: "open" }],
    [{ day: 1, status: "passed", targetId: null }],
    [{ day: 1, status: "protected", targetId: 5, timing: "voting" }],
  ].map((cycles) => ({ cycles })),
)("Guard rejects invalid cycle records", ({ cycles }) =>
  expect(readAwakenedGuardStateData({ policy: AWAKENED_GUARD_POLICY, cycles })).toBeNull(),
);
test("Knight history records distinct targets and complete same-day wolf chains", () => {
  const input = {
    policy: AWAKENED_DUEL_POLICY,
    attempts: [
      { day: 1, chain: 1, targetId: 4, branch: "wolf" },
      { day: 1, chain: 1, targetId: 8, branch: "wolf" },
      { day: 2, chain: 2, targetId: 5, branch: "good" },
    ],
  } satisfies AwakenedKnightState;
  const read = readAwakenedKnightStateData(input)!;
  expect(read).toEqual(input);
  input.attempts[0]!.targetId = 7;
  expect(read.attempts[0]!.targetId).toBe(4);
});
test.each(
  [
    [
      { day: 1, chain: 1, targetId: 4, branch: "wolf" },
      { day: 2, chain: 2, targetId: 4, branch: "good" },
    ],
    [
      { day: 1, chain: 1, targetId: 4, branch: "good" },
      { day: 1, chain: 1, targetId: 8, branch: "wolf" },
    ],
    [
      { day: 1, chain: 1, targetId: 4, branch: "wolf" },
      { day: 2, chain: 1, targetId: 8, branch: "wolf" },
    ],
    [{ day: 1, chain: 2, targetId: 4, branch: "wolf" }],
  ].map((attempts) => ({ attempts })),
)("Knight rejects duplicate targets, continued misses and forged chain numbers", ({ attempts }) =>
  expect(readAwakenedKnightStateData({ policy: AWAKENED_DUEL_POLICY, attempts })).toBeNull(),
);
test("Both readers refuse undefined and data accessors without executing them", () => {
  let reads = 0;
  const v = {
    get policy() {
      reads++;
      return AWAKENED_GUARD_POLICY;
    },
    cycles: [],
  };
  expect(readAwakenedGuardStateData(v)).toBeNull();
  expect(readAwakenedGuardStateData(undefined)).toBeNull();
  expect(readAwakenedKnightStateData(undefined)).toBeNull();
  expect(reads).toBe(0);
});
