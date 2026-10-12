/**
 * Package unit contract for Awakened's complete event-branch reader.
 * Independent literal rows cover all eight branches, ID order, original day,
 * role/self and nullable checks. Unused values are ignored and never exported.
 * These descriptions never awaken a role, install abilities or authorize action;
 * the inert browser reflection boundary does not replace Node Proxy ingress.
 */
import { expect, test } from "bun:test";
import {
  AWAKENED_EVENT_TYPES,
  readAwakenedEventFact,
} from "@ai-werewolf-arena/game-contract/facts/awakened";

test("eight original ordered IDs stay unfrozen and each branch returns its selected fields", () => {
  expect(AWAKENED_EVENT_TYPES).toEqual([
    "awakened_inherited",
    "awakened_mimicked",
    "awakened_mimic_skipped",
    "awakened_ready",
    "awakened_skill_skipped",
    "awakened_poison_used",
    "awakened_guard_chosen",
    "awakened_attack_chosen",
  ]);
  expect(Object.isFrozen(AWAKENED_EVENT_TYPES)).toBe(false);
  const rows: Array<[string, Record<string, unknown>]> = [
    ["awakened_inherited", { actorId: 2, day: 2, firstKnifeNight: 3 }],
    ["awakened_mimicked", { actorId: 2, day: 1, targetId: 3, role: "seer" }],
    ["awakened_mimic_skipped", { actorId: 2, day: 1 }],
    ["awakened_ready", { actorId: 2, activationNight: 1, activeFromNight: 2, role: "seer" }],
    ["awakened_skill_skipped", { actorId: 2, day: 1 }],
    ["awakened_poison_used", { actorId: 2, day: 1, targetId: 2 }],
    ["awakened_guard_chosen", { actorId: 2, day: 1, targetId: null }],
    ["awakened_attack_chosen", { actorId: 2, day: 1, targetId: 2 }],
  ];
  for (const [type, row] of rows)
    expect<unknown>(readAwakenedEventFact(type, row)).toEqual({ type, ...row });
});
test("ready has no day requirement while only mimic rejects self and validates raw role IDs", () => {
  const ready = {
    actorId: 2,
    activationNight: 1,
    activeFromNight: 2,
    role: "awakened_wolf_king",
    day: () => true,
  };
  expect(readAwakenedEventFact("awakened_ready", ready)).toEqual({
    type: "awakened_ready",
    actorId: 2,
    activationNight: 1,
    activeFromNight: 2,
    role: "awakened_wolf_king",
  });
  expect(readAwakenedEventFact("awakened_ready", { ...ready, activeFromNight: 3 })).toBeNull();
  expect(
    readAwakenedEventFact("awakened_mimicked", { actorId: 2, day: 1, targetId: 2, role: "seer" }),
  ).toBeNull();
  expect(
    readAwakenedEventFact("awakened_mimicked", {
      actorId: 2,
      day: 1,
      targetId: 3,
      role: "invented_role",
    }),
  ).toBeNull();
  expect(readAwakenedEventFact("awakened_mimic_skipped", { actorId: 2 })).toBeNull();
  expect(
    readAwakenedEventFact("awakened_attack_chosen", {
      actorId: Number.MAX_SAFE_INTEGER,
      day: Number.MAX_SAFE_INTEGER,
      targetId: null,
    }),
  ).not.toBeNull();
});
test("unused deep/function/symbol fields are not inspected or copied and accessors are not executed", () => {
  let gets = 0;
  const row = {
    actorId: 2,
    day: 1,
    unused: () => true,
    nested: new Date(),
    [Symbol("unused")]: true,
  };
  const fact = readAwakenedEventFact("awakened_skill_skipped", row)!;
  expect(fact).toEqual({ type: "awakened_skill_skipped", actorId: 2, day: 1 });
  expect(Object.isFrozen(fact)).toBe(false);
  expect(
    readAwakenedEventFact("awakened_skill_skipped", {
      actorId: 2,
      get day() {
        gets++;
        return 1;
      },
    }),
  ).toBeNull();
  expect(gets).toBe(0);
  const proxy = new Proxy(
    {},
    {
      getPrototypeOf: () => Date.prototype,
      ownKeys() {
        throw Error("descriptors-first");
      },
    },
  );
  expect(() => readAwakenedEventFact("awakened_skill_skipped", proxy)).toThrow("descriptors-first");
});
