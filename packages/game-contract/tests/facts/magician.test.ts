/**
 * Package unit contract for Magician full/own exchange and missed-shot facts.
 * Literal inputs independently verify privacy-shape separation, sorted nullable
 * pairs, exact fields and ID bounds. Descriptive readers never map targets or
 * mark deaths; no engine, production role state or rule oracle is loaded.
 */
import { expect, test } from "bun:test";
import {
  MAGICIAN_EVENT_TYPE,
  readDeathShotMissFact,
  readMagicianExchangeFact,
  readMagicianOwnExchangeFact,
} from "@ai-werewolf-arena/game-contract/facts/magician";

test("full and own variants retain separate exact shapes and null passes", () => {
  expect(MAGICIAN_EVENT_TYPE).toBe("magician_exchange_committed");
  const full = { actorId: 4, day: 1, pair: [2, 3] as [number, number] };
  const own = { day: 1, pair: [2, 3] as [number, number] };
  const fact = readMagicianExchangeFact(MAGICIAN_EVENT_TYPE, full)!;
  expect(fact).toEqual(full);
  expect(fact).not.toBe(full);
  expect(fact.pair).not.toBe(full.pair);
  expect(Object.getPrototypeOf(fact)).toBeNull();
  expect(readMagicianOwnExchangeFact(MAGICIAN_EVENT_TYPE, own)).toEqual(own);
  expect(readMagicianOwnExchangeFact(MAGICIAN_EVENT_TYPE, full)).toBeNull();
  expect(readMagicianExchangeFact(MAGICIAN_EVENT_TYPE, own)).toBeNull();
  expect(readMagicianOwnExchangeFact(MAGICIAN_EVENT_TYPE, { day: 1, pair: null })).toEqual({
    day: 1,
    pair: null,
  });
  expect(readMagicianExchangeFact(MAGICIAN_EVENT_TYPE, { actorId: 4, day: 1, pair: null })).toEqual(
    { actorId: 4, day: 1, pair: null },
  );
});

test("malformed pairs and own-shape tails reject without half projections", () => {
  const sparse = [2, 3];
  delete sparse[1];
  for (const pair of [[3, 2], [2, 2], [1, 2, 3], sparse, undefined, { 0: 2, 1: 3 }]) {
    expect(readMagicianExchangeFact(MAGICIAN_EVENT_TYPE, { actorId: 4, day: 1, pair })).toBeNull();
    expect(readMagicianOwnExchangeFact(MAGICIAN_EVENT_TYPE, { day: 1, pair })).toBeNull();
  }
  expect(
    readMagicianOwnExchangeFact(MAGICIAN_EVENT_TYPE, { day: 1, pair: null, actorId: 4 }),
  ).toBeNull();
  expect(
    readMagicianExchangeFact(MAGICIAN_EVENT_TYPE, { actorId: 4, day: 1, pair: null, extra: true }),
  ).toBeNull();
});

test("safe integer upper boundary remains exclusive for all IDs and day", () => {
  for (const id of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER]) {
    expect(
      readMagicianExchangeFact(MAGICIAN_EVENT_TYPE, { actorId: id, day: 1, pair: null }),
    ).toBeNull();
    expect(readMagicianOwnExchangeFact(MAGICIAN_EVENT_TYPE, { day: id, pair: null })).toBeNull();
    expect(
      readDeathShotMissFact("death_shot_missed", { actorId: id, reason: "no_effect" }),
    ).toBeNull();
  }
  expect(
    readMagicianOwnExchangeFact(MAGICIAN_EVENT_TYPE, {
      day: Number.MAX_SAFE_INTEGER - 1,
      pair: null,
    }),
  ).not.toBeNull();
});

test("missed shot retains its descriptive reason and forbids invented targets", () => {
  expect(readDeathShotMissFact("death_shot_missed", { actorId: 4, reason: "no_effect" })).toEqual({
    actorId: 4,
    reason: "no_effect",
  });
  expect(
    readDeathShotMissFact("death_shot_missed", { actorId: 4, reason: "night_protection" }),
  ).toBeNull();
  expect(
    readDeathShotMissFact("death_shot_missed", { actorId: 4, reason: "no_effect", targetId: 2 }),
  ).toBeNull();
  expect(readDeathShotMissFact("unrelated", { actorId: 4, reason: "no_effect" })).toBeNull();
});

test("unknown events and accessor payloads never read accessor values", () => {
  let reads = 0;
  const input = {
    day: 1,
    get pair() {
      reads++;
      return [2, 3];
    },
  };
  expect(readMagicianOwnExchangeFact("unrelated", input)).toBeNull();
  expect(readMagicianOwnExchangeFact(MAGICIAN_EVENT_TYPE, input)).toBeNull();
  expect(reads).toBe(0);
});
