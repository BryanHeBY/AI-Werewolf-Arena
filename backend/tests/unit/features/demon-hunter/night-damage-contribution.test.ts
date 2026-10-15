/**
 * 单元测试验证猎魔来源边界的晚 getter、原方法 receiver 和失败前缀；输入为手写来源及故障查询。
 * 预期是独立字面读序、原数组／字典身份与已写事件，不调用生产折叠函数来生成断言。
 * 不运行整局、消耗库存或伪造授权；这里的已封存形状只用于检验同步组合边界。
 */
import { expect, test } from "bun:test";
import { DeathCause, type DeathSources, type GameEvent } from "@ai-werewolf-arena/game-contract";
import { DEMON_HUNTER_POLICY } from "@ai-werewolf-arena/game-contract/facts/demon-hunter";
import {
  appendDemonNightDamageSources,
  publishDemonNightDamageSources,
  type DemonKnifeProtection,
  type DemonNightDamageQueries,
} from "../../../../src/features/demon-hunter/ports";
import type { DeliveredDemonNightSources } from "../../../../src/features/demon-hunter/native-potion-controller";

function delivered(): Readonly<DeliveredDemonNightSources> {
  return {
    hunt: { choice: null, damage: null, cancelled: null },
    poisonImmunities: [], poisonOverrides: [], healOverrides: [],
  };
}

test("knife reads and late optional source preserve receivers and skip absent target", () => {
  for (const present of [false, true]) {
    const trace: string[] = [], sources: DeathSources = { 9: [DeathCause.WolfKill] };
    const guards: Array<{ targetId: number; guard: boolean }> = [];
    const knife: DemonKnifeProtection = {
      get targetId() { trace.push("target"); return 9; }, wolf: true, guard: false, heal: false,
      get guardCurrent() {
        trace.push("guard-get");
        return function(this: DemonKnifeProtection) { expect(this).toBe(knife); trace.push("guard-call"); return false; };
      },
    };
    const night = {
      get demonWolfSourceCurrent() {
        trace.push("wolf-get");
        return present ? function(this: unknown, target: number) {
          expect(this).toBe(night); expect(target).toBe(9); trace.push("wolf-call"); return true;
        } : undefined;
      },
    };
    const queries: DemonNightDamageQueries = {
      get knifeProtection() { trace.push("knife"); return knife; },
      get healMarkPresent() {
        trace.push("heal-method");
        return function(this: DemonNightDamageQueries, target: () => number) {
          expect(this).toBe(queries); trace.push("heal-call"); expect(target()).toBe(9); return false;
        };
      },
      get wolfSourceCurrent() {
        trace.push("wolf-method");
        return function(this: DemonNightDamageQueries, target: () => number) {
          expect(this).toBe(queries); return night.demonWolfSourceCurrent?.(target());
        };
      },
    };
    appendDemonNightDamageSources(queries, delivered(), sources, guards);
    expect(trace).toEqual(present
      ? ["knife", "knife", "guard-get", "guard-call", "target", "heal-method", "heal-call", "target", "target", "wolf-method", "wolf-get", "target", "wolf-call", "target"]
      : ["knife", "knife", "guard-get", "guard-call", "target", "heal-method", "heal-call", "target", "target", "wolf-method", "wolf-get", "target"]);
    expect(guards).toEqual([{ targetId: 9, guard: false }]);
    expect(sources).toEqual({ 9: present ? [DeathCause.WolfKill] : [] });
  }
});

test("heal lookup failure retains earlier poison rewrite and guard entry", () => {
  const failure = new Error("heal_lookup_failed"), demon = delivered();
  const healOverrides = Object.defineProperty([], "find", { get() { throw failure; } });
  const sources: DeathSources = { 7: [DeathCause.Poison, DeathCause.WolfKill], 9: [DeathCause.WolfKill] };
  const guards: Array<{ targetId: number; guard: boolean }> = [];
  const queries: DemonNightDamageQueries = {
    knifeProtection: { targetId: 9, wolf: true, guard: true, heal: false },
    healMarkPresent() { throw new Error("mark_must_not_read"); },
    wolfSourceCurrent() { throw new Error("source_must_not_read"); },
  };
  expect(() => appendDemonNightDamageSources(queries, {
    ...demon, poisonOverrides: [{ targetId: 7, poison: false }], healOverrides,
  }, sources, guards)).toThrow(failure);
  expect(sources).toEqual({ 7: [DeathCause.WolfKill], 9: [DeathCause.WolfKill] });
  expect(guards).toEqual([{ targetId: 9, guard: true }]);
});

test("second immunity publication failure retains first event and skips diagnostic fields", () => {
  const failure = new Error("second_event_failed"), trace: string[] = [], events: GameEvent[] = [];
  const push = events.push;
  events.push = function(...items) {
    expect(this).toBe(events); trace.push("push");
    if (events.length === 1) throw failure;
    return push.apply(this, items);
  };
  const facts = [
    { policy: DEMON_HUNTER_POLICY, actorId: 7, day: 1, witchId: 6 },
    { policy: DEMON_HUNTER_POLICY, actorId: 8, day: 1, witchId: 6 },
  ];
  const demon: Readonly<DeliveredDemonNightSources> = {
    ...delivered(), poisonImmunities: facts,
    get poisonOverrides(): DeliveredDemonNightSources["poisonOverrides"] { throw new Error("diagnostic_must_not_start"); },
  };
  const sources: DeathSources = {}, guards: Array<{ targetId: number; guard: boolean }> = [], deaths: number[] = [];
  expect(() => publishDemonNightDamageSources({ get events() { trace.push("events"); return events; } }, demon, 1, guards, deaths, sources)).toThrow(failure);
  expect(trace).toEqual(["events", "push", "events", "push"]);
  expect(events.length).toBe(1);
  expect(events[0]?.type).toBe("demon_hunter_poison_immune");
  expect(events[0]?.payload).toEqual(facts[0]);
  expect(events[0]?.payload).not.toBe(facts[0]);
  expect((events[0] as Extract<GameEvent, { type: "demon_hunter_poison_immune" }>)?.audience).toEqual([]);
  expect(Object.isFrozen((events[0] as Extract<GameEvent, { type: "demon_hunter_poison_immune" }>)?.audience)).toBe(true);
  expect(sources).toEqual({}); expect(guards).toEqual([]); expect(deaths).toEqual([]);
});
