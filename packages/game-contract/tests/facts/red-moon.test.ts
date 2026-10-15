/**
 * 包级单元测试验证赤月使徒的下一夜与到期事实。
 * 独立字面预期核对事件 ID、严格相邻的日夜、精确字段、空值拒绝与原安全整数包含边界。
 * 读取描述已提交数据，不创建夜封、支付延迟资源、推进时钟或标记死亡；不调用引擎或生产规则预期。
 */
import { expect, test } from "bun:test";
import {
  RED_MOON_BLAST_EVENT,
  RED_MOON_EXILE_EVENT,
  RED_MOON_EXPIRY_EVENT,
  readRedMoonNextNightFact,
  readRedMoonExpiryFact,
} from "@ai-werewolf-arena/game-contract/facts/red-moon";

test("the two next-night events share the literal adjacent-night contract", () => {
  expect([RED_MOON_BLAST_EVENT, RED_MOON_EXILE_EVENT, RED_MOON_EXPIRY_EVENT]).toEqual([
    "red_moon_night_sealed",
    "red_moon_exile_delayed",
    "red_moon_delay_expired",
  ]);
  for (const type of [RED_MOON_BLAST_EVENT, RED_MOON_EXILE_EVENT]) {
    const input = { actorId: 4, day: 2, night: 3 },
      fact = readRedMoonNextNightFact(type, input)!;
    expect(fact).toEqual(input);
    expect(fact).not.toBe(input);
    expect(Object.getPrototypeOf(fact)).toBeNull();
    input.night = 4;
    expect(fact.night).toBe(3);
    for (const night of [2, 4, null, "3"])
      expect(readRedMoonNextNightFact(type, { actorId: 4, day: 2, night })).toBeNull();
  }
});

test("inclusive integer IDs remain separate from the exact day plus one limit", () => {
  const max = Number.MAX_SAFE_INTEGER;
  expect(readRedMoonExpiryFact(RED_MOON_EXPIRY_EVENT, { actorId: max, day: max })).not.toBeNull();
  expect(
    readRedMoonNextNightFact(RED_MOON_BLAST_EVENT, { actorId: max, day: max - 1, night: max }),
  ).not.toBeNull();
  expect(
    readRedMoonNextNightFact(RED_MOON_BLAST_EVENT, { actorId: 4, day: max, night: max + 1 }),
  ).toBeNull();
  for (const id of [0, -1, 1.5, NaN, Infinity, max + 1])
    expect(readRedMoonExpiryFact(RED_MOON_EXPIRY_EVENT, { actorId: id, day: 1 })).toBeNull();
});

test("expiry rejects cross-event, next-night tails and malformed inert data", () => {
  const input = { actorId: 4, day: 2 };
  expect(readRedMoonExpiryFact(RED_MOON_EXPIRY_EVENT, input)).toEqual(input);
  expect(readRedMoonExpiryFact(RED_MOON_EXILE_EVENT, input)).toBeNull();
  for (const payload of [
    { ...input, night: 3 },
    { day: 2 },
    { ...input, [Symbol("hidden")]: true },
    null,
    [],
  ])
    expect(readRedMoonExpiryFact(RED_MOON_EXPIRY_EVENT, payload)).toBeNull();
});

test("accessors reject without reading and no ordinary invalid input escapes as an error", () => {
  let reads = 0;
  const payload = {
    actorId: 4,
    get day() {
      reads++;
      return 2;
    },
  };
  expect(readRedMoonExpiryFact(RED_MOON_EXPIRY_EVENT, payload)).toBeNull();
  const next = { actorId: 4, day: 2 };
  Object.defineProperty(next, "night", {
    enumerable: true,
    get: () => {
      reads++;
      return 3;
    },
  });
  expect(readRedMoonNextNightFact(RED_MOON_BLAST_EVENT, next)).toBeNull();
  expect(reads).toBe(0);
});
