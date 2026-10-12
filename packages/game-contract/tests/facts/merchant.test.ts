/**
 * Package unit contract for Merchant's full choices and partial resolved prefix.
 * Independent literals preserve self targeting, ignored skipped/unused fields,
 * and outcome validation as a separate second stage. A partial result may hold
 * an unknown used outcome and never claims strict archival validity or authority.
 * No skill renderer, inventory writer, effect resolver or runtime engine executes.
 */
import { expect, test } from "bun:test";
import {
  readMerchantRenderableFact,
  readMerchantOutcome,
} from "@ai-werewolf-arena/game-contract/facts/merchant";

test("skipped and self-target committed choices return selected fields without inspecting extras", () => {
  expect(
    readMerchantRenderableFact("merchant_trade_skipped", {
      actorId: 2,
      day: 1,
      targetId: () => true,
      skill: {},
      outcome: null,
    }),
  ).toEqual({ type: "merchant_trade_skipped", actorId: 2, day: 1 });
  for (const skill of ["check", "poison", "guard"])
    expect<unknown>(
      readMerchantRenderableFact("merchant_trade_committed", {
        actorId: 2,
        day: 1,
        targetId: 2,
        skill,
        ignored: () => true,
        [Symbol("unused")]: true,
      }),
    ).toEqual({ type: "merchant_trade_committed", actorId: 2, day: 1, targetId: 2, skill });
  expect(
    readMerchantRenderableFact("merchant_trade_committed", {
      actorId: Number.MAX_SAFE_INTEGER,
      day: Number.MAX_SAFE_INTEGER,
      targetId: Number.MAX_SAFE_INTEGER,
      skill: "check",
    }),
  ).not.toBeNull();
});
test("resolved prefix is readable with unknown outcome and the second reader separately accepts only two outcomes", () => {
  const outcome = { original: true };
  const prefix = readMerchantRenderableFact("merchant_trade_resolved", {
    actorId: 2,
    day: 1,
    targetId: 3,
    skill: "check",
    outcome,
    ignored: () => true,
  });
  expect(prefix).toEqual({
    type: "merchant_trade_resolved",
    actorId: 2,
    day: 1,
    targetId: 3,
    skill: "check",
    outcome,
  });
  if (prefix?.type === "merchant_trade_resolved") expect(prefix.outcome).toBe(outcome);
  expect(readMerchantOutcome(outcome)).toBeNull();
  expect(readMerchantOutcome("granted")).toBe("granted");
  expect(readMerchantOutcome("backlash")).toBe("backlash");
  expect(readMerchantOutcome(undefined)).toBeNull();
  expect(readMerchantOutcome("invalid")).toBeNull();
});
test("prefix rejection and uncaught descriptor reflection stay separate from the late outcome", () => {
  let gets = 0;
  expect(
    readMerchantRenderableFact("merchant_trade_resolved", {
      actorId: 2,
      day: 1,
      targetId: 0,
      skill: "check",
      outcome: "granted",
    }),
  ).toBeNull();
  expect(
    readMerchantRenderableFact("merchant_trade_committed", {
      actorId: 2,
      day: 1,
      targetId: 3,
      skill: "gun",
    }),
  ).toBeNull();
  expect(
    readMerchantRenderableFact("merchant_trade_skipped", {
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
  expect(() => readMerchantRenderableFact("merchant_trade_skipped", proxy)).toThrow(
    "descriptors-first",
  );
  expect(readMerchantRenderableFact("future_event", proxy)).toBeNull();
});
