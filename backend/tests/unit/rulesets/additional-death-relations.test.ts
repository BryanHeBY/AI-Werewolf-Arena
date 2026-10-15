/**
 * 单元测试验证追加关系准备的原读取／receiver顺序、首失败前缀和真实恋人／双生关系。
 * 输入为同一可写波次容器、原生命绑定及字面梦查询／阶段故障；预期由手写名单、死因、事件与引用给出。
 * 双生准备只预约、不付款或标死；测试在 finally 用原 owner 取消，阶段查询不伪造死亡提交或行动许可。
 * 不运行完整对局、模型、复现或通用效果模拟器，也不从第二份生产结果推导 oracle。
 */
import { expect, test } from "bun:test";
import {
  Camp,
  Phase,
  DeathCause,
  type DeathSources,
  type EntityId,
  type GameEvent,
} from "@ai-werewolf-arena/game-contract";
import { World } from "../../../src/domain/world";
import { COMPONENT } from "../../../src/domain/components/names";
import { createAliveComponent } from "../../../src/domain/components/alive";
import { captureNightLife } from "../../../src/domain/night-effects";
import type { DreamNightEffects, DreamLifeQueries } from "../../../src/domain/dream-night-effects";
import { bindLovers } from "../../../src/features/cupid/relation";
import {
  prepareAdditionalDeathRelations,
  type AdditionalDeathRelationRuntime,
  type AdditionalDeathRelationWave,
} from "../../../src/rulesets/additional-death-relations";
import { fragrantPairOwnerFixture } from "../../support/features/fragrant-pair-seer/builders/owner";
import {
  closeFragrantNight,
  cancelFragrantDeathWave,
  prepareFragrantDeathWave,
  fragrantAuthoritySnapshot,
} from "../../../src/features/fragrant-pair-seer/authority";

function wave(): AdditionalDeathRelationWave {
  return {
    proposed: [1],
    proposedSources: { 1: [DeathCause.Shot] },
    nightTargets: [1],
    allSources: { 1: [DeathCause.WolfKill] },
    next: new Set(),
    seen: new Set(),
    nightOrigin: new Set(),
    linked: new Set(),
    ownsFragrant: false,
    resolutionDay: 1,
    sourcePhase: Phase.Night,
  };
}
function effects(linkedDeaths: DreamNightEffects["linkedDeaths"]): DreamNightEffects {
  return {
    protectedTargets: () => [],
    immuneNightTargets: () => [],
    blocksNightShot: () => false,
    blocksNightCharm: () => false,
    consecutiveDeaths: () => [],
    linkedDeaths,
    expandInitialDamage: () => {},
    recordDeaths: () => {},
  };
}

test("夜梦方法在婚约前读取且保原receiver，婚约首失败保留已展开的夜梦前缀", () => {
  const w = wave(),
    world = new World(),
    trace: string[] = [],
    failure = new Error("literal_additional_wedding_failure");
  const dreams = effects(() => []);
  Object.defineProperty(dreams, "linkedDeaths", {
    get() {
      trace.push("linked-callee");
      return function (
        this: unknown,
        current: DreamLifeQueries,
        ids: readonly EntityId[],
        eligible?: ReadonlySet<EntityId>,
      ) {
        trace.push("linked-call");
        expect(this).toBe(dreams);
        // 扩展只收布尔原体比较query，不取得World或由引擎返回的可写生命组件。
        expect(Object.keys(current)).toEqual(["matchesAlive"]);
        expect(current.matchesAlive(1, () => createAliveComponent())).toBe(false);
        expect(ids).toBe(w.nightTargets);
        expect([...eligible!]).toEqual([1]);
        return [2];
      };
    },
  });
  const wedding = {
    get expand(): never {
      trace.push("expand");
      throw failure;
    },
  };
  const runtime: AdditionalDeathRelationRuntime = {
    dreams() {
      trace.push("dreams");
      return dreams;
    },
    world() {
      trace.push("world");
      return world;
    },
    wedding() {
      trace.push("wedding");
      return wedding;
    },
    events() {
      throw new Error("literal_events_must_not_read");
    },
    isSettledLife() {
      throw new Error("literal_settled_must_not_read");
    },
    phase() {
      throw new Error("literal_phase_must_not_read");
    },
  };
  expect(() => prepareAdditionalDeathRelations(runtime, w)).toThrow(failure);
  expect(trace).toEqual([
    "dreams",
    "dreams",
    "linked-callee",
    "world",
    "linked-call",
    "wedding",
    "expand",
  ]);
  expect(w.proposed).toEqual([1, 2]);
  expect(w.proposedSources).toEqual({ 1: [DeathCause.Shot], 2: [DeathCause.Dream] });
  expect([...w.nightOrigin]).toEqual([1, 2]);
  expect([...w.linked]).toEqual([2]);
  expect([...w.seen]).toEqual([]);
  expect([...w.next]).toEqual([]);
});

test("独立夜梦、婚约和真实恋人按原顺序扩张同一容器而不标死或提前读阶段", () => {
  const w = wave(),
    world = new World(),
    events: GameEvent[] = [],
    trace: string[] = [];
  for (let i = 0; i < 4; i++)
    world.addComponent(world.createEntity(), COMPONENT.Alive, createAliveComponent());
  bindLovers(
    world,
    {
      actorId: 4,
      day: 1,
      policy: "lui_meme_lovers_only_v1",
      pairIds: [1, 2],
      pairCamps: [Camp.Good, Camp.Wolf],
      groupId: "cupid_lovers",
      mixed: true,
    },
    [captureNightLife(world, 1)!, captureNightLife(world, 2)!],
  );
  const dreams = effects((current, ids, eligible) => {
    expect(Object.keys(current)).toEqual(["matchesAlive"]);
    expect(current.matchesAlive(1, () => world.getComponent(1, COMPONENT.Alive)!)).toBe(true);
    trace.push("dream:" + ids.join(","));
    return ids.includes(1) && !eligible?.has(3) ? [3] : [];
  });
  const wedding = {
    expand(
      ids: EntityId[],
      sources: DeathSources,
      seen: ReadonlySet<EntityId>,
      nightOrigin: Set<EntityId>,
    ) {
      trace.push("wedding");
      expect(ids).toBe(w.proposed);
      expect(sources).toBe(w.proposedSources);
      expect(seen).toBe(w.seen);
      expect(nightOrigin).toBe(w.nightOrigin);
      ids.push(4);
      sources[4] = [DeathCause.Ability];
      nightOrigin.add(4);
      return [4];
    },
  };
  const result = prepareAdditionalDeathRelations(
    {
      world: () => world,
      events: () => events,
      dreams: () => dreams,
      wedding: () => wedding,
      isSettledLife() {
        throw new Error("literal_unowned_settled");
      },
      phase() {
        throw new Error("literal_unowned_phase");
      },
    },
    w,
  );
  expect(trace).toEqual(["dream:1", "wedding", "dream:1,3,4,2", "dream:1,3,4,2"]);
  expect(w.proposed).toEqual([1, 3, 4, 2]);
  expect(w.proposedSources).toEqual({
    1: [DeathCause.Shot],
    2: [DeathCause.Lovers],
    3: [DeathCause.Dream],
    4: [DeathCause.Ability],
  });
  expect([...w.nightOrigin]).toEqual([1, 3, 4, 2]);
  expect([...w.linked]).toEqual([3]);
  expect([...w.seen]).toEqual([]);
  expect([...w.next]).toEqual([]);
  expect(events.map((e) => ({ type: e.type, payload: e.payload }))).toEqual([
    { type: "lovers_death", payload: { actorId: 1, targetId: 2 } },
  ]);
  expect(world.getAliveEntityIds()).toEqual([1, 2, 3, 4]);
  expect(result.fragrantGun).toBeNull();
  expect(result.originPhase()).toBe(Phase.Night);
});

test("双生只筛选可提交原生命并预约覆盖死因，来源阶段晚查询失败不撤销调用方已写前缀", () => {
  const game = fragrantPairOwnerFixture();
  game.open();
  game.choices([9, 10]);
  closeFragrantNight(game.world, 1, "normal");
  const w: AdditionalDeathRelationWave = {
    ...wave(),
    proposed: [9, 11, 12],
    proposedSources: {
      9: [DeathCause.Shot],
      10: [DeathCause.Poison],
      11: [DeathCause.Ability],
      12: [DeathCause.Exile],
    },
    nightTargets: [],
    allSources: {},
    seen: new Set([11]),
    next: new Set([12]),
    ownsFragrant: true,
  };
  const settledReads: number[] = [],
    beforeEvents = game.events.length,
    beforeResource = JSON.stringify(game.role(1).privateState),
    failure = new Error("literal_late_phase_failure");
  let reads = 0;
  const result = prepareAdditionalDeathRelations(
    {
      world: () => game.world,
      events: () => game.events,
      dreams: () => undefined,
      wedding: () => ({ expand: () => [] }),
      isSettledLife(id) {
        settledReads.push(id);
        return false;
      },
      phase() {
        reads++;
        throw failure;
      },
    },
    w,
  );
  try {
    expect(settledReads).toEqual([9]);
    expect(reads).toBe(0);
    expect(result.fragrantGun).toEqual({ day: 1, rootId: 9, addedTargetId: 10, pairIds: [9, 10] });
    expect(w.proposed).toEqual([9, 11, 12, 10]);
    expect(w.proposedSources[10]).toEqual([DeathCause.FragrantLink]);
    // 本地调用方容器模拟原参数点之前的登记，不借此假称已执行死亡提交或phaseClock。
    (w.seen as Set<EntityId>).add(9);
    w.allSources[9] = [DeathCause.Shot];
    expect(() => result.originPhase()).toThrow(failure);
    expect(reads).toBe(1);
    expect([...w.seen]).toEqual([11, 9]);
    expect(w.allSources).toEqual({ 9: [DeathCause.Shot] });
    expect(game.events.length).toBe(beforeEvents);
    expect(JSON.stringify(game.role(1).privateState)).toBe(beforeResource);
    expect(fragrantAuthoritySnapshot(game.world).fragrant.trigger).toBeNull();
    expect(game.world.getComponent(9, COMPONENT.Alive)!.alive).toBe(true);
    expect(game.world.getComponent(10, COMPONENT.Alive)!.alive).toBe(true);
    expect(() => prepareFragrantDeathWave(game.world, 1, [9])).toThrow(
      "fragrant_death_wave_pending",
    );
  } finally {
    cancelFragrantDeathWave(game.world, result.fragrantGun!);
  }
});
