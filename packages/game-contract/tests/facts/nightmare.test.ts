/**
 * Package unit contract for descriptive Nightmare full and player-own facts.
 * Literal payloads independently verify exact privacy shapes, nullable pass,
 * inclusive safe-integer edge, self-target rejection and detached results.
 * Readers receive inert data; Node Proxy rejection remains an outer boundary.
 * No fear state, suppressed ability, source authority or engine is exercised.
 */
import { expect, test } from "bun:test";
import {
  NIGHTMARE_EVENT_TYPE,
  readNightmareFearFact,
  readNightmareOwnFearFact,
} from "@ai-werewolf-arena/game-contract/facts/nightmare";

test("full and own payloads keep separate exact shapes and null passes", () => {
  expect(NIGHTMARE_EVENT_TYPE).toBe("nightmare_fear_committed");
  const full = { actorId: 4, day: 1, targetId: 2 },
    own = { day: 1, targetId: 2 };
  const fact = readNightmareFearFact(NIGHTMARE_EVENT_TYPE, full)!;
  expect(fact).toEqual(full);
  expect(fact).not.toBe(full);
  expect(Object.getPrototypeOf(fact)).toBeNull();
  expect(readNightmareOwnFearFact(NIGHTMARE_EVENT_TYPE, own)).toEqual(own);
  expect(readNightmareOwnFearFact(NIGHTMARE_EVENT_TYPE, full)).toBeNull();
  expect(readNightmareFearFact(NIGHTMARE_EVENT_TYPE, own)).toBeNull();
  expect(readNightmareFearFact(NIGHTMARE_EVENT_TYPE, { ...full, targetId: null })).toEqual({
    ...full,
    targetId: null,
  });
  expect(readNightmareOwnFearFact(NIGHTMARE_EVENT_TYPE, { ...own, targetId: null })).toEqual({
    ...own,
    targetId: null,
  });
  full.targetId = 3;
  expect(fact.targetId).toBe(2);
});

test("the original inclusive MAX_SAFE_INTEGER edge is retained without a roster-size rule", () => {
  const max = Number.MAX_SAFE_INTEGER;
  expect(
    readNightmareFearFact(NIGHTMARE_EVENT_TYPE, { actorId: max, day: max, targetId: 2 }),
  ).not.toBeNull();
  expect(
    readNightmareOwnFearFact(NIGHTMARE_EVENT_TYPE, { day: max, targetId: max }),
  ).not.toBeNull();
  for (const id of [0, -1, 1.5, NaN, Infinity, max + 1, "2"])
    expect(
      readNightmareFearFact(NIGHTMARE_EVENT_TYPE, { actorId: id, day: 1, targetId: null }),
    ).toBeNull();
  expect(
    readNightmareFearFact(NIGHTMARE_EVENT_TYPE, { actorId: 4, day: 1, targetId: 4 }),
  ).toBeNull();
});

test("unknown names, missing keys, extra fields and non-data values return null", () => {
  const valid = { actorId: 4, day: 1, targetId: 2 };
  expect(readNightmareFearFact("future_event", valid)).toBeNull();
  for (const payload of [
    { actorId: 4, day: 1 },
    { ...valid, extra: true },
    { ...valid, targetId: undefined },
    null,
    [],
  ])
    expect(readNightmareFearFact(NIGHTMARE_EVENT_TYPE, payload)).toBeNull();
  expect(
    readNightmareFearFact(NIGHTMARE_EVENT_TYPE, Object.assign(Object.create({}), valid)),
  ).toBeNull();
});

test("accessor values are never executed in either reader", () => {
  let reads = 0;
  const payload = {
    day: 1,
    get targetId() {
      reads++;
      return 2;
    },
  };
  expect(readNightmareOwnFearFact(NIGHTMARE_EVENT_TYPE, payload)).toBeNull();
  const full = { actorId: 4, day: 1 };
  Object.defineProperty(full, "targetId", {
    enumerable: true,
    get: () => {
      reads++;
      return 2;
    },
  });
  expect(readNightmareFearFact(NIGHTMARE_EVENT_TYPE, full)).toBeNull();
  expect(reads).toBe(0);
});
