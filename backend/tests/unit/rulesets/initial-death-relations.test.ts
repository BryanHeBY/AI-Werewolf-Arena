/**
 * 单元测试验证初始关系组合的原方法 receiver、首失败前缀、Night 婚约公开策略和双生死因覆盖。
 * 输入为真实恋人生命绑定、真实双生已付关系，以及独立字面查询／事件故障；输出核对原容器、阶段与回执。
 * 测试不标死、不付款、不关闭死亡许可或运行整局；手写结果不由生产函数生成，双生准备回执在 finally 由原 owner 取消。
 */
import { expect, test } from "bun:test";
import { Camp, Phase, DeathCause, type DeathSources, type GameEvent } from "@ai-werewolf-arena/game-contract";
import { World } from "../../../src/core/domain/world";
import { COMPONENT } from "../../../src/core/domain/components/names";
import { createAliveComponent } from "../../../src/core/domain/components/alive";
import { captureNightLife } from "../../../src/core/domain/night_effects";
import { bindLovers } from "../../../src/game/mechanisms/roles/cupid/relation";
import { prepareInitialDeathRelations, type InitialDeathRelationRuntime, type InitialWeddingExpansion } from "../../../src/rulesets/initial-death-relations";
import { fragrantPairOwnerFixture } from "../../support/features/fragrant-pair-seer/builders/owner";
import { closeFragrantNight, cancelFragrantDeathWave, prepareFragrantDeathWave, fragrantAuthoritySnapshot } from "../../../src/game/mechanisms/roles/fragrant_pair_seer/authority";

function input() {
  return { pending: [1], sources: { 1: [DeathCause.WolfKill] } as DeathSources, seen: new Set([1]), nightOrigin: new Set<number>(), phases: {} as Record<number, Phase> };
}
function run(runtime: InitialDeathRelationRuntime, f: ReturnType<typeof input>) {
  return prepareInitialDeathRelations(runtime, f.pending, f.sources, f.seen, f.nightOrigin, f.phases);
}
function runtime(world: World, events: GameEvent[], wedding: InitialWeddingExpansion, phase = Phase.Day): InitialDeathRelationRuntime {
  return { world: () => world, events: () => events, wedding: () => wedding, phase: () => phase, resolutionDay: () => 1, ownsFragrant: () => false, dreams: () => undefined };
}

test("婚约方法 getter 首失败发生在其它查询之前，成功时保留原 receiver 和全部容器", () => {
  const f = input(), trace: string[] = [], world = new World(), failure = new Error("literal_wedding_callee_failure");
  let fail = true;
  const wedding: InitialWeddingExpansion = {
    get expand() {
      trace.push("expand");
      if (fail) throw failure;
      return function(this: unknown, pending: number[], sources: DeathSources, seen: ReadonlySet<number>, nightOrigin: Set<number>) {
        expect(this).toBe(wedding);
        expect([pending, sources, seen, nightOrigin]).toEqual([f.pending, f.sources, f.seen, f.nightOrigin]);
        expect(pending).toBe(f.pending); expect(sources).toBe(f.sources); expect(seen).toBe(f.seen); expect(nightOrigin).toBe(f.nightOrigin);
        trace.push("call");
        return [];
      };
    },
  };
  const queries: InitialDeathRelationRuntime = {
    wedding() { trace.push("wedding"); return wedding; },
    world() { trace.push("world"); return world; },
    events() { trace.push("events"); return []; },
    dreams() { trace.push("dreams"); return undefined; },
    ownsFragrant() { trace.push("owns"); return false; },
    phase() { trace.push("phase"); return Phase.Day; },
    resolutionDay() { throw new Error("unowned_day_must_not_read"); },
  };
  expect(() => run(queries, f)).toThrow(failure);
  expect(trace).toEqual(["wedding", "expand"]);
  expect(f.pending).toEqual([1]); expect(f.sources).toEqual({ 1: [DeathCause.WolfKill] });
  fail = false; trace.length = 0;
  const result = run(queries, f);
  expect(trace).toEqual(["wedding", "expand", "call", "world", "events", "dreams", "owns", "phase", "phase", "phase"]);
  expect(result.fragrantInitial).toBeNull();
  expect([...result.originPhases]).toEqual([[1, Phase.Day]]);
});

test("恋人和婚约阶段原地登记，Night 婚约不公开且公开事件失败保留关系前缀", () => {
  for (const failPublic of [false, true]) {
    const world = new World(), f = input(), events: GameEvent[] = [], failure = new Error("literal_public_additional_failure");
    for (let i = 0; i < 3; i++) world.addComponent(world.createEntity(), COMPONENT.Alive, createAliveComponent());
    bindLovers(world, { actorId: 3, day: 1, policy: "lui_meme_lovers_only_v1", pairIds: [1, 2], pairCamps: [Camp.Good, Camp.Wolf], groupId: "cupid_lovers", mixed: true }, [captureNightLife(world, 1)!, captureNightLife(world, 2)!]);
    f.nightOrigin.add(1);
    const wedding: InitialWeddingExpansion = { expand(pending, sources) { pending.push(3); sources[3] = [DeathCause.Exile]; return [3]; } };
    if (failPublic) {
      const push = events.push;
      events.push = function(...items) {
        expect(this).toBe(events);
        if (items[0]?.type === "additional_deaths") throw failure;
        return push.apply(this, items);
      };
      expect(() => run(runtime(world, events, wedding, Phase.Night), f)).toThrow(failure);
    } else {
      const result = run(runtime(world, events, wedding, Phase.Night), f);
      expect([...result.originPhases]).toEqual([[1, Phase.Night], [3, Phase.Night], [2, Phase.Night]]);
      expect(events.filter(e => e.type === "additional_deaths").map(e => e.payload)).toEqual([{ deaths: [2] }]);
    }
    expect(f.pending).toEqual([1, 3, 2]);
    expect(f.sources).toEqual({ 1: [DeathCause.WolfKill], 2: [DeathCause.Lovers], 3: [DeathCause.Exile] });
    expect([...f.seen]).toEqual([1, 2, 3]);
    expect(f.phases).toEqual({ 2: Phase.Night, 3: Phase.Night });
    expect(events.filter(e => e.type === "lovers_death").map(e => e.payload)).toEqual([{ actorId: 1, targetId: 2 }]);
    expect(world.getAliveEntityIds()).toEqual([1, 2, 3]);
  }
});

test("双生追加目标保持原覆盖死因而不消费准备回执或标死", () => {
  const game = fragrantPairOwnerFixture();
  game.open(); game.choices([9, 10]); closeFragrantNight(game.world, 1, "normal");
  const f = { pending: [9], sources: { 9: [DeathCause.WolfKill], 10: [DeathCause.Poison] } as DeathSources, seen: new Set([9]), nightOrigin: new Set([9]), phases: { 9: Phase.Night } as Record<number, Phase> };
  const eventCount = game.events.length, before = JSON.stringify(game.role(1).privateState);
  const result = run({ ...runtime(game.world, game.events, { expand: () => [] }), ownsFragrant: () => true }, f);
  try {
    expect(result.fragrantInitial).toEqual({ day: 1, rootId: 9, addedTargetId: 10, pairIds: [9, 10] });
    expect(f.pending).toEqual([9, 10]);
    expect(f.sources).toEqual({ 9: [DeathCause.WolfKill], 10: [DeathCause.FragrantLink] });
    expect([...result.originPhases]).toEqual([[9, Phase.Night], [10, Phase.Night]]);
    expect([...f.nightOrigin]).toEqual([9, 10]);
    expect(game.events.length).toBe(eventCount);
    expect(JSON.stringify(game.role(1).privateState)).toBe(before);
    expect(fragrantAuthoritySnapshot(game.world).fragrant.trigger).toBeNull();
    expect(game.world.getComponent(9, COMPONENT.Alive)!.alive).toBe(true);
    expect(game.world.getComponent(10, COMPONENT.Alive)!.alive).toBe(true);
    expect(() => prepareFragrantDeathWave(game.world, 1, [9])).toThrow("fragrant_death_wave_pending");
  } finally {
    cancelFragrantDeathWave(game.world, result.fragrantInitial!);
  }
});
