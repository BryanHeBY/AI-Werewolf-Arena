/**
 * Package unit boundaries for the public Scholar/Mentor fact readers.
 * Literal wire payloads and malformed data are independent oracles for shape,
 * numeric limits, null/pass alternatives and inspection disclosure. Tests cover
 * the shared inert-data contract; Node hostile-Proxy ingress remains separately
 * owned and is never replaced with a claimed browser Proxy guarantee here.
 * No rule resolver, actor state, transport, language renderer or model executes.
 */
import { expect, test } from "bun:test";
import {
  readModifierChoiceFact,
  readModifierSkipFact,
  readModifierConflictFact,
  readModifierBonusFact,
  type ModifierBonusFact,
  type ModifierChoiceFact,
} from "@ai-werewolf-arena/game-contract/facts/scholar-mentor";

const rows = [
  {
    type: "modifier_choice_committed",
    read: readModifierChoiceFact,
    value: { actorId: 7, day: 2, mode: "enhance", targetId: 3 },
  },
  {
    type: "modifier_choice_skipped",
    read: readModifierSkipFact,
    value: { actorId: 7, day: 1, reason: "first_night" },
  },
  {
    type: "modifier_conflict_resolved",
    read: readModifierConflictFact,
    value: { day: 2, kind: "both_wolves", targetId: 3 },
  },
  {
    type: "modifier_bonus_resolved",
    read: readModifierBonusFact,
    value: { actorId: 7, day: 2, kind: "check", targetId: 3, abstain: false, isWerewolf: false },
  },
] as const;

for (const row of rows)
  test(`${row.type}: literal public payload is detached without adding freeze or fields`, () => {
    const value = JSON.parse(JSON.stringify(row.value));
    const result = row.read(row.type, value);
    expect(JSON.parse(JSON.stringify(result))).toEqual(row.value);
    expect(result).not.toBe(value);
    expect(Object.isFrozen(result)).toBe(false);
    expect(row.read("unknown_event", value)).toBeNull();
    value.day = 99;
    expect(result?.day).toBe(row.value.day);
  });

test("all four public readers reject missing/extra/descriptor/prototype input without a partial fact", () => {
  let reads = 0;
  for (const row of rows) {
    const { day: _day, ...missing } = row.value;
    expect(row.read(row.type, missing)).toBeNull();
    expect(row.read(row.type, { ...row.value, secret: "extra" })).toBeNull();
    const accessor = { ...row.value };
    Object.defineProperty(accessor, "day", {
      enumerable: true,
      get: () => {
        reads++;
        return 2;
      },
    });
    expect(row.read(row.type, accessor)).toBeNull();
    const hidden = { ...row.value };
    Object.defineProperty(hidden, "day", { enumerable: false, value: row.value.day });
    expect(row.read(row.type, hidden)).toBeNull();
    expect(
      row.read(row.type, Object.assign(Object.create({ inherited: true }), row.value)),
    ).toBeNull();
    expect(row.read(row.type, { ...row.value, [Symbol("hidden")]: 1 })).toBeNull();
    expect(row.read(row.type, [row.value])).toBeNull();
    expect(row.read(row.type, null)).toBeNull();
  }
  expect(reads).toBe(0);
});

test("original numeric upper edge excludes MAX_SAFE_INTEGER while its predecessor remains valid", () => {
  const max = Number.MAX_SAFE_INTEGER;
  const value = { actorId: max - 1, day: max - 1, mode: "weaken", targetId: max - 1 };
  expect(readModifierChoiceFact("modifier_choice_committed", value)).not.toBeNull();
  for (const field of ["actorId", "day", "targetId"])
    for (const bad of [max, 0, -1, 2.5, NaN, Infinity, "2", undefined])
      expect(
        readModifierChoiceFact("modifier_choice_committed", { ...value, [field]: bad }),
      ).toBeNull();
});

test("deliberate pass and first-night skip alternatives retain their original null and day contracts", () => {
  const pass: ModifierChoiceFact = { actorId: 7, day: 2, mode: null, targetId: null };
  expect(readModifierChoiceFact("modifier_choice_committed", pass)).toEqual(pass);
  expect(readModifierChoiceFact("modifier_choice_committed", { ...pass, day: 1 })).toBeNull();
  expect(readModifierChoiceFact("modifier_choice_committed", { ...pass, targetId: 3 })).toBeNull();
  expect(
    readModifierSkipFact("modifier_choice_skipped", { actorId: 7, day: 1, reason: "dead" }),
  ).not.toBeNull();
  expect(
    readModifierSkipFact("modifier_choice_skipped", { actorId: 7, day: 2, reason: "exhausted" }),
  ).not.toBeNull();
  expect(
    readModifierSkipFact("modifier_choice_skipped", { actorId: 7, day: 2, reason: "first_night" }),
  ).toBeNull();
});

test("inspection result is required only for a real check and forbidden on other bonus/pass shapes", () => {
  const checked: ModifierBonusFact = {
    actorId: 7,
    day: 2,
    kind: "check",
    targetId: 3,
    abstain: false,
    isWerewolf: true,
  };
  const { isWerewolf: _result, ...missing } = checked;
  expect(readModifierBonusFact("modifier_bonus_resolved", missing)).toBeNull();
  expect(readModifierBonusFact("modifier_bonus_resolved", checked)).toEqual(checked);
  for (const kind of ["guard", "poison", "kill"] as const) {
    const plain = { ...missing, kind };
    expect(readModifierBonusFact("modifier_bonus_resolved", plain)).toEqual(plain);
    expect(
      readModifierBonusFact("modifier_bonus_resolved", { ...plain, isWerewolf: false }),
    ).toBeNull();
  }
  for (const kind of ["check", "guard", "poison", "kill"] as const) {
    const passed = { actorId: 7, day: 2, kind, targetId: null, abstain: true };
    expect(readModifierBonusFact("modifier_bonus_resolved", passed)).toEqual(passed);
    expect(
      readModifierBonusFact("modifier_bonus_resolved", { ...passed, isWerewolf: true }),
    ).toBeNull();
    expect(readModifierBonusFact("modifier_bonus_resolved", { ...passed, targetId: 3 })).toBeNull();
  }
});

test("bonus kind rejects non-string objects without coercion", () => {
  let coercions = 0;
  const kind = {
    toString: () => {
      coercions++;
      return "check";
    },
  };
  expect(
    readModifierBonusFact("modifier_bonus_resolved", {
      actorId: 7,
      day: 2,
      kind,
      targetId: 3,
      abstain: false,
      isWerewolf: true,
    }),
  ).toBeNull();
  expect(coercions).toBe(0);
});
