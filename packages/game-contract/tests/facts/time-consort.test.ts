/**
 * Package unit reader contract for Time Wolf Consort facts. Literal payloads,
 * original malformed fields and detached identity checks are the oracle.
 * Inputs are inert data; no World, board-support predicate or engine resolver
 * participates. Roster membership, phase and actual-night eligibility belong to
 * consumers and are deliberately not inferred by these structural readers.
 */
import { expect, test } from "bun:test";
import {
  readTimeConsortChoiceFact,
  readTimeConsortSkipFact,
  readTimeConsortReflectionFact,
  type TimeConsortChoiceFact,
  type TimeConsortSkipFact,
  type TimeConsortReflectionFact,
} from "@ai-werewolf-arena/game-contract/facts/time-consort";

test("choice target and explicit pass retain the exact detached payload", () => {
  for (const targetId of [2, null]) {
    const input: TimeConsortChoiceFact = { actorId: 1, day: 2, targetId };
    const fact = readTimeConsortChoiceFact("time_consort_lock_committed", input)!;
    expect(fact).toEqual({ actorId: 1, day: 2, targetId });
    expect(fact).not.toBe(input);
    expect(Object.getPrototypeOf(fact)).toBeNull();
    input.targetId = 3;
    expect(fact.targetId).toBe(targetId);
  }
});

test("structural day and IDs do not silently add roster or real-night rules", () => {
  expect(
    readTimeConsortChoiceFact("time_consort_lock_committed", {
      actorId: 99,
      day: 1,
      targetId: 999,
    }),
  ).toEqual({ actorId: 99, day: 1, targetId: 999 });
  expect(
    readTimeConsortReflectionFact("time_consort_reflected", {
      actorId: 99,
      day: 1,
      sourceId: 999,
      requestedId: 999,
      effectiveId: 999,
      kind: "check",
    }),
  ).toEqual({
    actorId: 99,
    day: 1,
    sourceId: 999,
    requestedId: 999,
    effectiveId: 999,
    kind: "check",
  });
});

test("choice rejects wrong type, missing or extra fields and invalid numeric IDs", () => {
  const input = { actorId: 1, day: 2, targetId: 3 };
  expect(readTimeConsortChoiceFact("unrecognized_type", input)).toBeNull();
  for (const delta of [
    { actorId: 0 },
    { actorId: Number.MAX_SAFE_INTEGER },
    { day: 0 },
    { day: 2.5 },
    { targetId: -1 },
    { targetId: "3" },
    { targetId: NaN },
    { extra: true },
  ])
    expect(
      readTimeConsortChoiceFact("time_consort_lock_committed", { ...input, ...delta }),
    ).toBeNull();
  expect(
    readTimeConsortChoiceFact("time_consort_lock_committed", { actorId: 1, day: 2 }),
  ).toBeNull();
  for (const malformed of [null, undefined, [], true])
    expect(readTimeConsortChoiceFact("time_consort_lock_committed", malformed)).toBeNull();
});

test("skip preserves dead/exhausted reasons and rejects foreign alternatives", () => {
  for (const reason of ["dead", "exhausted"] as const) {
    const expected: TimeConsortSkipFact = { actorId: 1, day: 2, reason };
    expect(readTimeConsortSkipFact("time_consort_lock_skipped", expected)).toEqual(expected);
  }
  for (const reason of ["not_started", "passed", null, { toString: 3 }])
    expect(
      readTimeConsortSkipFact("time_consort_lock_skipped", { actorId: 1, day: 2, reason }),
    ).toBeNull();
  expect(
    readTimeConsortSkipFact("time_consort_reflected", { actorId: 1, day: 2, reason: "dead" }),
  ).toBeNull();
  expect(
    readTimeConsortSkipFact("time_consort_lock_skipped", {
      actorId: 1,
      day: 2,
      reason: "dead",
      extra: true,
    }),
  ).toBeNull();
});

test("reflection retains check/guard/poison and the original source/effective relation", () => {
  const base = { actorId: 1, day: 2, sourceId: 2, requestedId: 3, effectiveId: 2 };
  for (const kind of ["check", "guard", "poison"] as const) {
    const expected: TimeConsortReflectionFact = { ...base, kind };
    expect(readTimeConsortReflectionFact("time_consort_reflected", expected)).toEqual(expected);
  }
  for (const delta of [
    { kind: "heal" },
    { kind: { toString: 3 } },
    { effectiveId: 3 },
    { sourceId: 99 },
    { extra: true },
    { day: 0 },
    { requestedId: Number.MAX_SAFE_INTEGER },
  ])
    expect(
      readTimeConsortReflectionFact("time_consort_reflected", {
        ...base,
        kind: "poison",
        ...delta,
      }),
    ).toBeNull();
  expect(
    readTimeConsortReflectionFact("time_consort_lock_committed", { ...base, kind: "poison" }),
  ).toBeNull();
});

test("accessor fields and non-data prototypes return null without executing getters", () => {
  let reads = 0;
  const payload = Object.defineProperty({ actorId: 1, day: 2 }, "targetId", {
    enumerable: true,
    get() {
      reads++;
      return 3;
    },
  });
  expect(readTimeConsortChoiceFact("time_consort_lock_committed", payload)).toBeNull();
  expect(reads).toBe(0);
  expect(readTimeConsortChoiceFact("time_consort_lock_committed", new Date())).toBeNull();
});
