/** 负责公共契约单元测试，用独立字面事实核对禁言公开／本人字段边界、动作原文和同日重复历史的拒绝，不执行游戏规则。 */
import { expect, test } from "bun:test";
import {
  SILENCE_ELDER_POLICY as policy,
  readSilenceElderFact,
  readSilenceElderStateData,
  silenceElderFactAudience,
} from "../src/facts/silence-elder";

const facts = [
  ["silence_chosen", { policy, day: 1, actorId: 4, targetId: 4, translatorId: 2 }, "actor"],
  ["silence_announced", { policy, day: 1, targetId: 4, translatorId: 2 }, "public"],
  [
    "silence_gesture",
    { policy, day: 1, actorId: 4, round: "day", description: ' （指向2号）\nExact {role} "动作" ' },
    "public",
  ],
  [
    "silence_translated",
    { policy, day: 1, actorId: 2, targetId: 4, round: "pk", text: "我的解读：请留意2号。" },
    "public",
  ],
  [
    "silence_translation_declined",
    { policy, day: 1, actorId: 2, targetId: 4, round: "pk" },
    "actor",
  ],
  ["silence_expired", { policy, day: 1, targetId: 4 }, "god"],
] as const;
for (const [type, payload, audience] of facts)
  test(`${type}: strict detached data and declared audience`, () => {
    const before = structuredClone(payload),
      fact = readSilenceElderFact(type, payload);
    // 元组循环保留运行时对应关系；逐字段断言避免把两个独立联合误当成合法辨别联合。
    expect(fact!.type).toBe(type);
    expect(fact!.payload).toEqual(payload);
    expect(fact!.payload).not.toBe(payload);
    expect(silenceElderFactAudience(type)).toBe(audience);
    expect(readSilenceElderFact(type, { ...payload, sourceCamp: "good" })).toBeNull();
    expect(readSilenceElderFact(type, { ...payload, day: 0 })).toBeNull();
    expect(payload).toEqual(before);
  });

test("public announcement cannot carry the hidden Elder identity; no speech is invented for a declined translation", () => {
  expect(readSilenceElderFact("silence_announced", { ...facts[1][1], actorId: 4 })).toBeNull();
  expect(readSilenceElderFact("silence_translated", { ...facts[3][1], text: null })).toBeNull();
  expect(
    readSilenceElderFact("silence_translation_declined", { ...facts[4][1], text: "invented" }),
  ).toBeNull();
  expect(
    readSilenceElderFact("silence_gesture", { ...facts[2][1], description: "   " }),
  ).toBeNull();
  expect(readSilenceElderFact("silence_announced", { ...facts[1][1], translatorId: 4 })).toBeNull();
  expect(
    readSilenceElderFact("silence_announced", { ...facts[1][1], translatorId: null }),
  ).not.toBeNull();
});

test("history accepts consecutive nights with the same target, rejects duplicate nights and returns detached rows", () => {
  const input = {
    policy,
    history: [
      { day: 1, targetId: 4, translatorId: null },
      { day: 2, targetId: 4, translatorId: 2 },
    ],
  };
  const state = readSilenceElderStateData(input);
  expect(state).toEqual(input);
  expect(state!.history[0]).not.toBe(input.history[0]);
  expect(
    readSilenceElderStateData({ policy, history: [input.history[0], input.history[0]] }),
  ).toBeNull();
  expect(readSilenceElderStateData({ ...input, activePermit: "fake" })).toBeNull();
});

test("unknown fact leaves arbitrary payload untouched", () => {
  let calls = 0;
  const value = new Proxy(
    {},
    {
      get() {
        calls++;
        throw Error("unexpected_read");
      },
      ownKeys() {
        calls++;
        throw Error("unexpected_read");
      },
    },
  );
  expect(readSilenceElderFact("unknown", value)).toBeNull();
  expect(calls).toBe(0);
});
