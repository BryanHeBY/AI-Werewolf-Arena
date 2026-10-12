/**
 * Unit contract regression for Scholar/Mentor facts consumed by replay clients.
 * Original literal payloads, invalid matrices and handwritten expectations are
 * the independent oracle. The public pure reader owns validation; no frontend
 * projection, engine state, model, Node proxy guard or fixture is substituted.
 * Case titles and test bodies remain the existing baseline discovery contract.
 */
import { test, expect } from "bun:test";
import {
  readModifierChoiceFact as choice,
  readModifierSkipFact as skip,
  readModifierConflictFact as conflict,
  readModifierBonusFact as bonus,
} from "@ai-werewolf-arena/game-contract/facts/scholar-mentor";
const rows = [
  [choice, "modifier_choice_committed", { actorId: 1, day: 2, mode: "enhance", targetId: 2 }],
  [skip, "modifier_choice_skipped", { actorId: 1, day: 1, reason: "first_night" }],
  [conflict, "modifier_conflict_resolved", { day: 2, kind: "same_good", targetId: 2 }],
  [
    bonus,
    "modifier_bonus_resolved",
    { actorId: 1, day: 2, kind: "check", targetId: 2, abstain: false, isWerewolf: true },
  ],
] as const;
for (const [read, type, value] of rows) {
  test(type + " round trip and defensive copy", () => {
    const actual = read(type, value);
    expect(actual).toEqual(value);
    expect(actual).not.toBe(value);
    expect(read("unknown", value)).toBeNull();
  });
  test(type + " rejects extra keys and invalid day", () => {
    expect(read(type, { ...value, extra: true })).toBeNull();
    for (const day of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER, "2", null])
      expect(read(type, { ...value, day })).toBeNull();
  });
  test(type + " rejects accessors without reading", () => {
    let reads = 0;
    const bad = { ...value };
    Object.defineProperty(bad, "day", {
      enumerable: true,
      get() {
        reads++;
        return 2;
      },
    });
    expect(read(type, bad)).toBeNull();
    expect(reads).toBe(0);
  });
}
test("choice null pair and first-night rejection", () => {
  expect(choice(rows[0][1], { actorId: 1, day: 2, mode: null, targetId: null })).not.toBeNull();
  for (const [mode, targetId] of [
    [null, 2],
    ["enhance", null],
    ["bad", 2],
  ])
    expect(choice(rows[0][1], { actorId: 1, day: 2, mode, targetId })).toBeNull();
  expect(choice(rows[0][1], { ...rows[0][2], day: 1 })).toBeNull();
});
test("bonus requires inspection result only for real check", () => {
  const base = { actorId: 1, day: 2, kind: "check", targetId: 2, abstain: false };
  expect(bonus(rows[3][1], base)).toBeNull();
  expect(bonus(rows[3][1], { ...base, isWerewolf: false })).not.toBeNull();
  for (const kind of ["guard", "poison", "kill"]) {
    expect(bonus(rows[3][1], { ...base, kind })).not.toBeNull();
    expect(bonus(rows[3][1], { ...base, kind, isWerewolf: true })).toBeNull();
  }
});
test("bonus pass must not leak inspection result", () => {
  for (const kind of ["check", "guard", "poison", "kill"]) {
    const p = { actorId: 1, day: 2, kind, targetId: null, abstain: true };
    expect(bonus(rows[3][1], p)).not.toBeNull();
    expect(bonus(rows[3][1], { ...p, isWerewolf: false })).toBeNull();
    expect(bonus(rows[3][1], { ...p, targetId: 2 })).toBeNull();
  }
});
test("bonus rejects non-string kind without coercion", () => {
  for (const kind of [null, undefined, {}, [], 2, true])
    expect(bonus(rows[3][1], { ...rows[3][2], kind })).toBeNull();
});
test("skip first-night reason only on day one", () => {
  expect(skip(rows[1][1], { ...rows[1][2], day: 2 })).toBeNull();
  for (const reason of ["exhausted", "dead"])
    expect(skip(rows[1][1], { ...rows[1][2], day: 2, reason })).not.toBeNull();
});
