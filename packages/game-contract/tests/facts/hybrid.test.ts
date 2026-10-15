/**
 * 包级单元测试验证混血儿两个完整浅层事实分支。
 * 独立字面行核对首日、自身目标、白名单与旧边界：多余字符串字段被拒绝，忽略的 symbol 不导出。
 * 反射失败仍可抛出；不运行展示器、归属写入或授权逻辑，Node Proxy 拒绝另归入口。
 */
import { expect, test } from "bun:test";
import { readHybridEventFact } from "@ai-werewolf-arena/game-contract/facts/hybrid";

test("chosen and both affiliation outcomes expose only their validated primitive fields", () => {
  const chosen = { actorId: 2, day: 1, targetId: 3 };
  expect<unknown>(readHybridEventFact("hybrid_exemplar_chosen", chosen)).toEqual({
    type: "hybrid_exemplar_chosen",
    ...chosen,
  });
  for (const faction of ["good", "wolf"])
    expect<unknown>(
      readHybridEventFact("hybrid_affiliation_resolved", { ...chosen, faction }),
    ).toEqual({ type: "hybrid_affiliation_resolved", ...chosen, faction });
  expect(readHybridEventFact("future_event", chosen)).toBeNull();
});
test("positive inclusive IDs, first day, self rejection and named string whitelist stay distinct", () => {
  const base = { actorId: 2, day: 1, targetId: 3 };
  expect(
    readHybridEventFact("hybrid_exemplar_chosen", { ...base, targetId: Number.MAX_SAFE_INTEGER }),
  ).not.toBeNull();
  for (const change of [
    { actorId: 0 },
    { targetId: 2 },
    { targetId: NaN },
    { day: 2 },
    { extra: undefined },
    { faction: "good" },
  ])
    expect(readHybridEventFact("hybrid_exemplar_chosen", { ...base, ...change })).toBeNull();
  expect(readHybridEventFact("hybrid_affiliation_resolved", base)).toBeNull();
  expect(
    readHybridEventFact("hybrid_affiliation_resolved", { ...base, faction: "neutral" }),
  ).toBeNull();
});
test("symbols are ignored, own accessors reject without invocation and reflection failures propagate", () => {
  let gets = 0;
  const base = { actorId: 2, day: 1, targetId: 3 };
  const symbol = Symbol("unused");
  const value = {
    ...base,
    get [symbol]() {
      gets++;
      return true;
    },
  };
  const fact = readHybridEventFact("hybrid_exemplar_chosen", value)!;
  expect(fact).not.toBe(base);
  expect(Object.getOwnPropertySymbols(fact)).toHaveLength(0);
  expect(gets).toBe(0);
  expect(
    readHybridEventFact("hybrid_exemplar_chosen", {
      ...base,
      get targetId() {
        gets++;
        return 3;
      },
    }),
  ).toBeNull();
  expect(gets).toBe(0);
  const hostile = new Proxy(
    {},
    {
      ownKeys() {
        throw Error("reflection-failure");
      },
    },
  );
  expect(() => readHybridEventFact("hybrid_exemplar_chosen", hostile)).toThrow(
    "reflection-failure",
  );
  expect(readHybridEventFact("future_event", hostile)).toBeNull();
});
