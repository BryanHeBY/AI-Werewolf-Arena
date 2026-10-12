/**
 * Responsibility: verify unit data-copy boundaries for shared fact payloads.
 * Literal shapes and original error codes are the oracle, independent of World
 * and feature settlement. Checks preserve depth/array limits, descriptor rejection,
 * plain-record output and the explicit inert-only browser Proxy precondition.
 */
import { expect, test } from "bun:test";
import { copyEventData } from "@ai-werewolf-arena/game-contract";

test("inert payload copies have detached dense arrays and null-prototype records", () => {
  const original = { pair: [1, 2], stock: 0, flags: { paid: false }, raw: "原文 {target}" };
  const copy = copyEventData(original) as typeof original;
  expect(copy).toEqual(original);
  expect(copy).not.toBe(original);
  expect(copy.pair).not.toBe(original.pair);
  expect(Object.getPrototypeOf(copy)).toBeNull();
  expect(Object.getPrototypeOf(copy.flags)).toBeNull();
  original.pair[0] = 3;
  expect(copy.pair).toEqual([1, 2]);
});

test("original depth and configurable array limits remain exact", () => {
  expect(() => copyEventData({ a: { b: { c: { d: {} } } } })).toThrow("event_fact_not_data");
  expect(copyEventData(Array(128).fill(1))).toHaveLength(128);
  expect(() => copyEventData(Array(129).fill(1))).toThrow("event_fact_array");
  expect(copyEventData(Array(129).fill(1), 129)).toHaveLength(129);
  expect(() => copyEventData([, 1])).toThrow("event_fact_array");
  expect(() => copyEventData(NaN)).toThrow("event_fact_not_data");
  expect(() => copyEventData({ value: undefined })).toThrow("event_fact_not_data");
});

test("accessors and non-data prototypes reject without evaluating getters", () => {
  let getters = 0;
  const accessor = Object.defineProperty({}, "target", {
    enumerable: true,
    get() {
      getters++;
      return 1;
    },
  });
  expect(() => copyEventData(accessor)).toThrow("event_fact_accessor");
  expect(getters).toBe(0);
  expect(() => copyEventData(new Date())).toThrow("event_fact_not_plain");
  expect(() => copyEventData({ [Symbol("field")]: 1 })).toThrow("event_fact_not_plain");
});

test("shared data copier does not claim Node zero-trap protection for arbitrary proxies", () => {
  let traps = 0;
  const value = new Proxy(
    { actorId: 1 },
    {
      getPrototypeOf(target) {
        traps++;
        return Reflect.getPrototypeOf(target);
      },
    },
  );
  expect(copyEventData(value)).toEqual({ actorId: 1 });
  expect(traps).toBeGreaterThan(0);
});
