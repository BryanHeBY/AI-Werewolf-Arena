/**
 * 包级单元测试验证机械狼十个完整浅层事实分支。
 * 独立字面预期保留日期例外、自身／较早就绪时间、可空目标以及守护／反射字段条件。
 * 原型拒绝先于描述符反射，特定顺序不承诺任意 Proxy 安全；解析不执行学习、变身、死亡或技能。
 */
import { expect, test } from "bun:test";
import {
  MECHANICAL_EVENT_TYPES,
  readMechanicalEventFact,
} from "@ai-werewolf-arena/game-contract/facts/mechanical";

test("ten original IDs and all complete branch shapes retain their literal values", () => {
  expect(MECHANICAL_EVENT_TYPES).toEqual([
    "mechanical_awakened",
    "mechanical_mode_selected",
    "mechanical_mimicked",
    "mechanical_mimic_skipped",
    "mechanical_skill_skipped",
    "mechanical_poison_used",
    "mechanical_guard_chosen",
    "mechanical_attack_chosen",
    "mechanical_poison_reflected",
    "mechanical_shot",
  ]);
  expect(Object.isFrozen(MECHANICAL_EVENT_TYPES)).toBe(false);
  const rows: Array<[string, Record<string, unknown>]> = [
    ["mechanical_awakened", { actorId: 2, day: 2, firstKnifeNight: 3 }],
    ["mechanical_mode_selected", { actorId: 2, day: 1, mode: "skill" }],
    ["mechanical_mimicked", { actorId: 2, day: 5, targetId: 2, role: "seer", readyOnNight: 1 }],
    ["mechanical_mimic_skipped", { actorId: 2, day: 1 }],
    ["mechanical_skill_skipped", { actorId: 2, day: 1 }],
    ["mechanical_poison_used", { actorId: 2, day: 1, targetId: 2 }],
    ["mechanical_guard_chosen", { actorId: 2, day: 1, targetId: null, failed: true }],
    ["mechanical_attack_chosen", { actorId: 2, day: 1, targetId: null }],
    ["mechanical_poison_reflected", { actorId: 2, day: 1, protectedTargetId: 3, casterId: 4 }],
    ["mechanical_shot", { actorId: 2, targetId: 3 }],
  ];
  for (const [type, row] of rows)
    expect<unknown>(readMechanicalEventFact(type, row)).toEqual({ type, ...row });
});
test("shot has no day requirement and each special predicate keeps its old boundary", () => {
  expect(
    readMechanicalEventFact("mechanical_shot", {
      actorId: Number.MAX_SAFE_INTEGER,
      targetId: Number.MAX_SAFE_INTEGER,
      day: () => true,
    }),
  ).toEqual({
    type: "mechanical_shot",
    actorId: Number.MAX_SAFE_INTEGER,
    targetId: Number.MAX_SAFE_INTEGER,
  });
  expect(
    readMechanicalEventFact("mechanical_mode_selected", { actorId: 2, day: 1, mode: "unknown" }),
  ).toBeNull();
  expect(
    readMechanicalEventFact("mechanical_guard_chosen", { actorId: 2, day: 1, targetId: null }),
  ).toBeNull();
  expect(
    readMechanicalEventFact("mechanical_guard_chosen", {
      actorId: 2,
      day: 1,
      targetId: 0,
      failed: false,
    }),
  ).toBeNull();
  expect(
    readMechanicalEventFact("mechanical_poison_reflected", {
      actorId: 2,
      day: 1,
      protectedTargetId: 3,
      casterId: 0,
    }),
  ).toBeNull();
  expect(readMechanicalEventFact("mechanical_mimic_skipped", { actorId: 2 })).toBeNull();
});
test("the original early prototype rejection avoids later descriptors and extras are ignored", () => {
  let descriptors = 0,
    gets = 0;
  const proxy = new Proxy(
    {},
    {
      getPrototypeOf: () => Date.prototype,
      ownKeys() {
        descriptors++;
        throw Error("late-descriptors");
      },
    },
  );
  expect(readMechanicalEventFact("mechanical_shot", proxy)).toBeNull();
  expect(descriptors).toBe(0);
  expect(
    readMechanicalEventFact("mechanical_shot", {
      actorId: 2,
      targetId: 3,
      ignored: () => true,
      [Symbol("unused")]: true,
    }),
  ).toEqual({ type: "mechanical_shot", actorId: 2, targetId: 3 });
  expect(
    readMechanicalEventFact("mechanical_shot", {
      actorId: 2,
      get targetId() {
        gets++;
        return 3;
      },
    }),
  ).toBeNull();
  expect(gets).toBe(0);
});
