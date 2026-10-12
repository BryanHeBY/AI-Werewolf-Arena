/**
 * Package unit contract for Order Prince choice and revote facts. Independent
 * literal rows verify exact keys, strict booleans, ID/day limits and detached
 * ordinary-object results. Readers never open windows, spend resources or alter
 * phases; no engine, voter list, production state or resolver is consulted.
 */
import { expect, test } from "bun:test";
import {
  readOrderPrinceChoiceFact,
  readOrderPrinceRevoteFact,
} from "@ai-werewolf-arena/game-contract/facts/order-prince";

test("both boolean choices and revote retain detached ordinary object outputs", () => {
  for (const activate of [false, true]) {
    const input = { actorId: 4, day: 1, activate };
    const fact = readOrderPrinceChoiceFact("order_prince_choice_committed", input)!;
    expect(fact).toEqual(input);
    expect(fact).not.toBe(input);
    expect(Object.getPrototypeOf(fact)).toBe(Object.prototype);
  }
  expect(readOrderPrinceRevoteFact("order_prince_revote_started", { actorId: 4 })).toEqual({
    actorId: 4,
  });
});

test("exact fields and booleans reject overexposure and coercible strings", () => {
  for (const input of [
    {},
    { actorId: 4, day: 1 },
    { actorId: 4, day: 1, activate: "false" },
    { actorId: 4, day: 1, activate: null },
    { actorId: 4, day: 1, activate: false, hidden: true },
    { actorId: 4, day: 1, activate: false, [Symbol("hidden")]: true },
    null,
    [],
  ])
    expect(readOrderPrinceChoiceFact("order_prince_choice_committed", input)).toBeNull();
  expect(
    readOrderPrinceRevoteFact("order_prince_revote_started", { actorId: 4, day: 1 }),
  ).toBeNull();
  expect(readOrderPrinceRevoteFact("order_prince_revote_started", { actorId: "4" })).toBeNull();
});

test("safe integer upper boundary stays exclusive for actor and day", () => {
  for (const id of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER]) {
    expect(readOrderPrinceRevoteFact("order_prince_revote_started", { actorId: id })).toBeNull();
    expect(
      readOrderPrinceChoiceFact("order_prince_choice_committed", {
        actorId: 4,
        day: id,
        activate: false,
      }),
    ).toBeNull();
  }
  expect(
    readOrderPrinceRevoteFact("order_prince_revote_started", {
      actorId: Number.MAX_SAFE_INTEGER - 1,
    }),
  ).not.toBeNull();
});

test("unknown type, accessor and exotic prototype reject without getter execution", () => {
  let reads = 0;
  const input = {
    get actorId() {
      reads++;
      return 4;
    },
  };
  expect(readOrderPrinceRevoteFact("unrelated", input)).toBeNull();
  expect(readOrderPrinceRevoteFact("order_prince_revote_started", input)).toBeNull();
  expect(reads).toBe(0);
  expect(
    readOrderPrinceRevoteFact(
      "order_prince_revote_started",
      Object.assign(Object.create({}), { actorId: 4 }),
    ),
  ).toBeNull();
});
