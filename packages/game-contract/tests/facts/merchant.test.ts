/**
 * 包级单元测试验证奇迹商人的完整选择与部分结算前缀。
 * 独立字面预期保留自身目标、跳过分支忽略字段及独立第二阶段 outcome 校验；未知已用 outcome 可按原引用返回。
 * 部分结果不宣称严格归档有效或已授权；本文件不调用技能展示器、库存写入或效果结算器。
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
