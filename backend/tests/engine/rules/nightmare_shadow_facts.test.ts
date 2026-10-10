import { expect, test } from "bun:test";
import {
  readNightmareFearFact,
  readNightmareOwnFearFact,
  nightmareEventLabel,
} from "@ai-werewolf-arena/game-text";
const type = "nightmare_fear_committed";
test("nightmare full and own facts have disjoint exact shapes", () => {
  expect(readNightmareFearFact(type, { actorId: 1, day: 1, targetId: 2 })).toEqual({
    actorId: 1,
    day: 1,
    targetId: 2,
  });
  expect(readNightmareFearFact(type, { actorId: 1, day: 1, targetId: null })).toEqual({
    actorId: 1,
    day: 1,
    targetId: null,
  });
  expect(readNightmareOwnFearFact(type, { day: 1, targetId: null })).toEqual({
    day: 1,
    targetId: null,
  });
  expect(readNightmareOwnFearFact(type, { actorId: 1, day: 1, targetId: 2 })).toBeNull();
  expect(readNightmareFearFact(type, { day: 1, targetId: 2 })).toBeNull();
});
for (const value of [0, -1, 1.5, NaN, Infinity, "1", null, undefined]) {
  test(`nightmare rejects invalid actor/day value ${String(value)}`, () => {
    expect(readNightmareFearFact(type, { actorId: value, day: 1, targetId: 2 })).toBeNull();
    expect(readNightmareFearFact(type, { actorId: 1, day: value, targetId: 2 })).toBeNull();
    expect(readNightmareOwnFearFact(type, { day: value, targetId: 2 })).toBeNull();
  });
}
test("nightmare rejects self target and additional disclosed outcome", () => {
  expect(readNightmareFearFact(type, { actorId: 1, day: 1, targetId: 1 })).toBeNull();
  expect(readNightmareFearFact(type, { actorId: 1, day: 1, targetId: 2, camp: "wolf" })).toBeNull();
  expect(readNightmareOwnFearFact(type, { day: 1, targetId: 2, wolfBlocked: true })).toBeNull();
  expect(readNightmareOwnFearFact("other", { day: 1, targetId: 2 })).toBeNull();
});
test("nightmare fact readers do not execute getters", () => {
  let reads = 0;
  const p = {
    day: 1,
    get targetId() {
      reads++;
      return 2;
    },
  };
  expect(readNightmareOwnFearFact(type, p)).toBeNull();
  expect(reads).toBe(0);
});
for (const locale of ["zh-CN", "en"] as const)
  test(`nightmare label renders explicit pass and rejects malformed data/${locale}`, () => {
    const label = nightmareEventLabel(type, { day: 1, targetId: null }, locale);
    expect(label).not.toBeNull();
    expect(label).toContain(locale === "en" ? "pass" : "弃用");
    expect(nightmareEventLabel(type, { day: 0, targetId: 2 }, locale)).toBeNull();
  });
