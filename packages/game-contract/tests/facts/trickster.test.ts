/**
 * Package unit contract for descriptive Trickster facts. Literal JSON rows are
 * independent oracles for sorted pairs, nullable pass, exact fields, ID bounds
 * and exile mapping semantics. No engine, voter list, role state or resolver is
 * consulted; validating a fact does not authorize or apply its described effect.
 */
import { expect, test } from "bun:test";
import {
  readExileMappingFact,
  readTricksterExchangeFact,
  readTricksterSkipFact,
} from "@ai-werewolf-arena/game-contract/facts/trickster";

test("exchange accepts sorted pair and explicit null pass without aliasing input", () => {
  const input = { actorId: 4, day: 1, pair: [2, 3] as [number, number] };
  const fact = readTricksterExchangeFact("trickster_exchange_committed", input)!;
  expect(fact).toEqual(input);
  expect(fact).not.toBe(input);
  expect(fact.pair).not.toBe(input.pair);
  expect(Object.getPrototypeOf(fact)).toBeNull();
  expect(
    readTricksterExchangeFact("trickster_exchange_committed", { actorId: 4, day: 2, pair: null }),
  ).toEqual({ actorId: 4, day: 2, pair: null });
  input.pair[0] = 1;
  expect(fact.pair).toEqual([2, 3]);
});

test("exchange rejects reversed, repeated, sparse, oversized and malformed rows", () => {
  const sparse = [2, 3];
  delete sparse[1];
  for (const input of [
    { actorId: 4, day: 1, pair: [3, 2] },
    { actorId: 4, day: 1, pair: [2, 2] },
    { actorId: 4, day: 1, pair: sparse },
    { actorId: 4, day: 1, pair: [1, 2, 3] },
    { actorId: 4, day: 1 },
    { actorId: 4, day: 1, pair: undefined },
    { actorId: 4, day: 1, pair: null, extra: "hidden" },
    { actorId: 4, day: 1, pair: null, [Symbol("hidden")]: true },
    null,
    [],
  ])
    expect(readTricksterExchangeFact("trickster_exchange_committed", input)).toBeNull();
});

test("all identifiers preserve the exclusive safe-integer upper boundary", () => {
  for (const id of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER]) {
    expect(
      readTricksterExchangeFact("trickster_exchange_committed", {
        actorId: id,
        day: 1,
        pair: null,
      }),
    ).toBeNull();
    expect(
      readTricksterExchangeFact("trickster_exchange_committed", {
        actorId: 4,
        day: id,
        pair: null,
      }),
    ).toBeNull();
    expect(
      readExileMappingFact("exile_target_mapped", {
        requestedId: 2,
        effectiveId: id,
        missed: false,
      }),
    ).toBeNull();
  }
  expect(
    readTricksterExchangeFact("trickster_exchange_committed", {
      actorId: Number.MAX_SAFE_INTEGER - 1,
      day: 1,
      pair: null,
    }),
  ).not.toBeNull();
});

test("skip reasons and mapping miss relationship retain their literal contracts", () => {
  for (const reason of ["exhausted", "dead"] as const)
    expect(
      readTricksterSkipFact("trickster_exchange_skipped", { actorId: 4, day: 1, reason }),
    ).toEqual({ actorId: 4, day: 1, reason });
  expect(
    readTricksterSkipFact("trickster_exchange_skipped", {
      actorId: 4,
      day: 1,
      reason: "first_night",
    }),
  ).toBeNull();
  expect(
    readExileMappingFact("exile_target_mapped", { requestedId: 2, effectiveId: 2, missed: false }),
  ).toEqual({ requestedId: 2, effectiveId: 2, missed: false });
  expect(
    readExileMappingFact("exile_target_mapped", { requestedId: 2, effectiveId: 3, missed: true }),
  ).toEqual({ requestedId: 2, effectiveId: 3, missed: true });
  expect(
    readExileMappingFact("exile_target_mapped", { requestedId: 2, effectiveId: 2, missed: true }),
  ).toBeNull();
  expect(
    readExileMappingFact("exile_target_mapped", {
      requestedId: 2,
      effectiveId: 3,
      missed: "false",
    }),
  ).toBeNull();
  expect(
    readExileMappingFact("exile_target_mapped", {
      requestedId: 2,
      effectiveId: 3,
      missed: false,
      targetId: 3,
    }),
  ).toBeNull();
});

test("unknown event and accessor payloads reject without reading the getter", () => {
  let reads = 0;
  const input = {
    actorId: 4,
    day: 1,
    get pair() {
      reads++;
      return [2, 3];
    },
  };
  expect(readTricksterExchangeFact("unrelated", input)).toBeNull();
  expect(readTricksterExchangeFact("trickster_exchange_committed", input)).toBeNull();
  expect(reads).toBe(0);
});
