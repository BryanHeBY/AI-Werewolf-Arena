/**
 * 包级单元测试验证狼术师交换和跳过事实读取。
 * 独立字面配对与畸形 payload 核对原排序／空值含义和普通数据复制；预期不由座位映射或游戏引擎生成。
 * 接受正整数 ID 不代表 roster 成员或实际夜间行动资格。
 */
import { expect, test } from "bun:test";
import {
  readWolfSorcererExchangeFact,
  readWolfSorcererSkipFact,
  type WolfSorcererExchangeFact,
  type WolfSorcererSkipFact,
} from "@ai-werewolf-arena/game-contract/facts/wolf-sorcerer";

test("exchange returns a detached canonical pair and explicit pass stays null", () => {
  const input: WolfSorcererExchangeFact = { actorId: 1, day: 2, pair: [2, 3] };
  const fact = readWolfSorcererExchangeFact("wolf_sorcerer_exchange_committed", input)!;
  expect(fact).toEqual({ actorId: 1, day: 2, pair: [2, 3] });
  expect(fact).not.toBe(input);
  expect(fact.pair).not.toBe(input.pair);
  input.pair![0] = 1;
  expect(fact.pair).toEqual([2, 3]);
  expect(Object.getPrototypeOf(fact)).toBeNull();
  expect(
    readWolfSorcererExchangeFact("wolf_sorcerer_exchange_committed", {
      actorId: 1,
      day: 2,
      pair: null,
    }),
  ).toEqual({ actorId: 1, day: 2, pair: null });
});

test("positive structural day/IDs preserve the boundary separate from roster and N2 eligibility", () => {
  expect(
    readWolfSorcererExchangeFact("wolf_sorcerer_exchange_committed", {
      actorId: 99,
      day: 1,
      pair: [999, 1000],
    }),
  ).toEqual({ actorId: 99, day: 1, pair: [999, 1000] });
});

test("exchange rejects reversed, duplicate, sparse, overlong and invalid pair members", () => {
  for (const pair of [
    [3, 2],
    [2, 2],
    [2],
    [2, 3, 4],
    [, 3],
    [0, 3],
    [2, NaN],
    [2, Number.MAX_SAFE_INTEGER],
    ["2", 3],
    {},
  ])
    expect(
      readWolfSorcererExchangeFact("wolf_sorcerer_exchange_committed", {
        actorId: 1,
        day: 2,
        pair,
      }),
    ).toBeNull();
});

test("missing/extra fields, wrong type and numeric identity errors reject the full choice", () => {
  const input = { actorId: 1, day: 2, pair: [2, 3] };
  expect(readWolfSorcererExchangeFact("unrecognized_type", input)).toBeNull();
  for (const delta of [{ actorId: 0 }, { day: 0 }, { day: 2.5 }, { secret: "leak" }])
    expect(
      readWolfSorcererExchangeFact("wolf_sorcerer_exchange_committed", { ...input, ...delta }),
    ).toBeNull();
  expect(
    readWolfSorcererExchangeFact("wolf_sorcerer_exchange_committed", { actorId: 1, day: 2 }),
  ).toBeNull();
  for (const malformed of [null, undefined, [], true])
    expect(readWolfSorcererExchangeFact("wolf_sorcerer_exchange_committed", malformed)).toBeNull();
});

test("skip keeps dead/not_started/exhausted and rejects incompatible reasons or added pair data", () => {
  for (const reason of ["dead", "not_started", "exhausted"] as const) {
    const expected: WolfSorcererSkipFact = { actorId: 1, day: 2, reason };
    expect(readWolfSorcererSkipFact("wolf_sorcerer_exchange_skipped", expected)).toEqual(expected);
  }
  for (const payload of [
    { actorId: 1, day: 2, reason: "passed" },
    { actorId: 1, day: 2, reason: { toString: 3 } },
    { actorId: 1, day: 2, reason: "dead", pair: [2, 3] },
    { actorId: 0, day: 2, reason: "dead" },
  ])
    expect(readWolfSorcererSkipFact("wolf_sorcerer_exchange_skipped", payload)).toBeNull();
  expect(
    readWolfSorcererSkipFact("wolf_sorcerer_exchange_committed", {
      actorId: 1,
      day: 2,
      reason: "dead",
    }),
  ).toBeNull();
});

test("non-data pair descriptors reject before getters execute", () => {
  let reads = 0;
  const pair = [2, 3];
  Object.defineProperty(pair, "1", {
    enumerable: true,
    get() {
      reads++;
      return 3;
    },
  });
  expect(
    readWolfSorcererExchangeFact("wolf_sorcerer_exchange_committed", { actorId: 1, day: 2, pair }),
  ).toBeNull();
  expect(reads).toBe(0);
  expect(readWolfSorcererExchangeFact("wolf_sorcerer_exchange_committed", new Date())).toBeNull();
});
