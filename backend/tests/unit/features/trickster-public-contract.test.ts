/**
 * Unit tests: Trickster facts use canonical literal records and hostile descriptors; exact
 * fields, detached copies and getter rejection check the inert public data contract.
 * Inputs and expected outcomes remain the original literal or immutable-fixture oracle;
 * these module assertions invoke no model or complete-game driver.
 */
import { expect, test } from "bun:test";
import {
  readTricksterExchangeFact,
  readTricksterSkipFact,
  readExileMappingFact,
  tricksterEventLabel,
} from "@ai-werewolf-arena/game-text";
test("Trickster facts are exact, canonical and detached", () => {
  const source = { actorId: 1, day: 1, pair: [2, 3] as [number, number] };
  const fact = readTricksterExchangeFact("trickster_exchange_committed", source)!;
  expect(fact).toEqual(source);
  source.pair[0] = 99;
  expect(fact.pair).toEqual([2, 3]);
  for (const pair of [[3, 2], [2, 2], [2], [2, 3, 4], [0, 2], [2, Infinity], ["2", 3]]) {
    expect(
      readTricksterExchangeFact("trickster_exchange_committed", { actorId: 1, day: 1, pair }),
    ).toBeNull();
  }
  expect(
    readTricksterExchangeFact("trickster_exchange_committed", {
      actorId: 1,
      day: 1,
      pair: null,
      secret: "leak",
    }),
  ).toBeNull();
  expect(readTricksterExchangeFact("wrong", { actorId: 1, day: 1, pair: null })).toBeNull();
});
test("Trickster fact parsing rejects getters and safely copies proxy data descriptors", () => {
  let calls = 0;
  const source = {
    actorId: 1,
    day: 1,
    get pair() {
      calls++;
      return [2, 3];
    },
  };
  expect(readTricksterExchangeFact("trickster_exchange_committed", source)).toBeNull();
  expect(calls).toBe(0);
  const proxy = new Proxy(
    { actorId: 1, day: 1, pair: null },
    {
      get() {
        calls++;
        throw new Error("read");
      },
    },
  );
  expect(readTricksterExchangeFact("trickster_exchange_committed", proxy)).toEqual({
    actorId: 1,
    day: 1,
    pair: null,
  });
  expect(calls).toBe(0);
});
test("Trickster skipped and mapping facts reject ambiguity", () => {
  for (const reason of ["exhausted", "dead"] as const)
    expect(
      readTricksterSkipFact("trickster_exchange_skipped", { actorId: 1, day: 2, reason }),
    ).not.toBeNull();
  expect(
    readTricksterSkipFact("trickster_exchange_skipped", { actorId: 1, day: 2, reason: "pass" }),
  ).toBeNull();
  expect(
    readExileMappingFact("exile_target_mapped", { requestedId: 2, effectiveId: 3, missed: true }),
  ).not.toBeNull();
  expect(
    readExileMappingFact("exile_target_mapped", { requestedId: 2, effectiveId: 2, missed: true }),
  ).toBeNull();
  expect(
    readExileMappingFact("exile_target_mapped", {
      requestedId: 2,
      effectiveId: 3,
      missed: false,
      pair: [2, 3],
    }),
  ).toBeNull();
});
for (const locale of ["zh-CN", "en"] as const)
  test("Trickster bilingual labels/" + locale, () => {
    for (const [kind, payload] of [
      ["trickster_exchange_committed", { actorId: 1, day: 1, pair: [2, 3] }],
      ["trickster_exchange_committed", { actorId: 1, day: 1, pair: null }],
      ["trickster_exchange_skipped", { actorId: 1, day: 2, reason: "exhausted" }],
      ["exile_target_mapped", { requestedId: 2, effectiveId: 3, missed: false }],
      ["exile_target_mapped", { requestedId: 2, effectiveId: 3, missed: true }],
    ] as const) {
      const label = tricksterEventLabel(kind, payload, locale);
      expect(label).toBeString();
      expect(label).not.toContain("{");
      expect(label).not.toContain("event.");
    }
  });
