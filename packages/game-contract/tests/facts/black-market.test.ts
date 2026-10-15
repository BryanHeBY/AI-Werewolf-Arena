/**
 * 包级单元测试验证黑市商人的选择事实与结算部分前缀。
 * 独立字面样本核对异目标、技能条件，以及技能展示之后独立校验 outcome 的两段读取；部分结果可保留未知 outcome 引用。
 * 这不承诺严格归档 DTO，也不授物、反噬、写库存或批准购买；反射异常仍按原路径传播。
 */
import { expect, test } from "bun:test";
import {
  readBlackMarketRenderableFact,
  readBlackMarketOutcome,
} from "@ai-werewolf-arena/game-contract/facts/black-market";

test("skipped ignores later fields while three committed skill choices require distinct targets", () => {
  expect(
    readBlackMarketRenderableFact("black_market_trade_skipped", {
      actorId: 2,
      day: 1,
      targetId: 2,
      skill: {},
      outcome: () => true,
    }),
  ).toEqual({ type: "black_market_trade_skipped", actorId: 2, day: 1 });
  for (const skill of ["check", "poison", "gun"])
    expect<unknown>(
      readBlackMarketRenderableFact("black_market_trade_committed", {
        actorId: 2,
        day: 1,
        targetId: 3,
        skill,
        ignored: () => true,
        [Symbol("unused")]: true,
      }),
    ).toEqual({ type: "black_market_trade_committed", actorId: 2, day: 1, targetId: 3, skill });
  expect(
    readBlackMarketRenderableFact("black_market_trade_committed", {
      actorId: 2,
      day: 1,
      targetId: 2,
      skill: "check",
    }),
  ).toBeNull();
});
test("resolved prefix leaves outcome unvalidated until the second pure reader", () => {
  const value = {
    actorId: Number.MAX_SAFE_INTEGER,
    day: Number.MAX_SAFE_INTEGER,
    targetId: 3,
    skill: "gun",
    outcome: "invalid",
  };
  expect<unknown>(readBlackMarketRenderableFact("black_market_trade_resolved", value)).toEqual({
    type: "black_market_trade_resolved",
    ...value,
  });
  expect(readBlackMarketOutcome("invalid")).toBeNull();
  expect(readBlackMarketOutcome("granted")).toBe("granted");
  expect(readBlackMarketOutcome("backlash")).toBe("backlash");
  expect(readBlackMarketOutcome({})).toBeNull();
  expect(readBlackMarketOutcome(undefined)).toBeNull();
});
test("malformed prefixes and own accessors reject while original descriptor errors propagate", () => {
  let gets = 0;
  expect(
    readBlackMarketRenderableFact("black_market_trade_resolved", {
      actorId: 2,
      day: 1,
      targetId: 3,
      skill: "guard",
      outcome: "granted",
    }),
  ).toBeNull();
  expect(
    readBlackMarketRenderableFact("black_market_trade_skipped", {
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
  expect(() => readBlackMarketRenderableFact("black_market_trade_skipped", proxy)).toThrow(
    "descriptors-first",
  );
  expect(readBlackMarketRenderableFact("future_event", proxy)).toBeNull();
});
