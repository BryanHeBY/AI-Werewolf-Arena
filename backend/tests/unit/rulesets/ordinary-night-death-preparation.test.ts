/**
 * 单元测试验证普通黎明提案的已付狐狸原因、原生命过滤、自爆来源合并与提交夜报的不同发布时点。
 * 输入为真实 World／工厂生命、可执行 claim 与字面事件／回执故障；输出为手写名单、读取轨迹、引用和同 Error 前缀。
 * 不执行真实死亡或整局，不把提案／空提交凭证当付款许可；经理的 await、finally 与封盘另由原精准场景覆盖。
 */
import { expect, test } from "bun:test";
import { DeathCause, Phase, type GameEvent } from "@ai-werewolf-arena/game-contract";
import { World } from "../../../src/domain/world";
import { COMPONENT } from "../../../src/domain/components/names";
import { createAliveComponent, aliveLifeVersion } from "../../../src/domain/components/alive";
import { captureNightLife, type NightFoxInspectionClaim } from "../../../src/domain/night-effects";
import { DeathCommitReceipt, planDeathWave } from "../../../src/game/engine/death-wave";
import {
  prepareOrdinaryNightDeaths,
  ordinaryNightDeathPublication,
  type OrdinaryNightDeathRuntime,
} from "../../../src/rulesets/ordinary-night-death-preparation";

function fixture(count: number) {
  const world = new World();
  const lives = Array.from({ length: count }, () => {
    const id = world.createEntity(), life = createAliveComponent();
    world.addComponent(id, COMPONENT.Alive, life);
    return { id, life, version: aliveLifeVersion(life) };
  });
  return { world, lives, deathLives: new Map(lives.map(({ id, life, version }) => [id, { life, version }])) };
}

test("狐狸只撤自己的原因；原生命／版本逐点核验，公开夜报先于自爆合并，claim 抛错不发表", () => {
  const f = fixture(6), events: GameEvent[] = [], calls: string[] = [];
  const claims: NightFoxInspectionClaim[] = [1, 2, 5].map((id) => ({
    target: captureNightLife(f.world, id)!,
    isTargetCurrent() { calls.push(`target:${id}`); return id === 5; },
    isCurrent(): never { throw new Error("literal_owner_permission_must_not_read"); },
  }));
  f.lives[2]!.life.alive = false;
  f.world.addComponent(4, COMPONENT.Alive, createAliveComponent());
  f.lives[5]!.life.alive = false;
  f.lives[5]!.life.alive = true;
  const damage = {
    deaths: [1, 2, 3, 4, 5, 6],
    deathSources: {
      1: [DeathCause.FoxInspection, DeathCause.Poison],
      2: [DeathCause.FoxInspection],
      3: [DeathCause.WolfKill],
      4: [DeathCause.WolfKill],
      5: [DeathCause.FoxInspection],
      6: [DeathCause.WolfKill],
    },
  };
  let damageReads = 0, lifeReads = 0;
  const runtime: OrdinaryNightDeathRuntime = {
    world: f.world,
    night: {
      get damage() { damageReads++; return damage; },
      get deathLives() { lifeReads++; return f.deathLives; },
      foxInspections: claims,
    },
    config: {},
    publishNightResolved(deaths) {
      const event: GameEvent = { timestamp: 1, type: "night_resolved", payload: { deaths: [...deaths()] } };
      events.push(event);
      return event;
    },
  };
  const proposal = prepareOrdinaryNightDeaths(runtime, {
    deaths: [2, 1, 7],
    sources: { 2: [DeathCause.SelfDestruct], 1: [DeathCause.Poison, DeathCause.WhiteWolfBlast], 7: [DeathCause.WhiteWolfBlast] },
  });
  expect(calls).toEqual(["target:1", "target:2", "target:5"]);
  expect([damageReads, lifeReads]).toEqual([8, 6]);
  expect(proposal.nightDeaths).toEqual([1, 5]);
  expect(proposal.deaths).toEqual([1, 5, 2, 7]);
  expect(proposal.sources).toEqual({
    1: [DeathCause.Poison, DeathCause.WhiteWolfBlast],
    5: [DeathCause.FoxInspection],
    2: [DeathCause.SelfDestruct],
    7: [DeathCause.WhiteWolfBlast],
  });
  expect(proposal.deathPhases).toEqual({ 2: Phase.Day, 1: Phase.Day, 7: Phase.Day });
  expect(events.map((event) => event.payload)).toEqual([{ deaths: [1, 5] }]);
  expect(proposal.sourceDamage).toBe(damage);
  expect(proposal.originalLives).toBe(f.deathLives);
  expect(proposal.sources[1]).not.toBe(damage.deathSources[1]);
  expect(damage.deaths).toEqual([1, 2, 3, 4, 5, 6]);
  expect(damage.deathSources[1]).toEqual([DeathCause.FoxInspection, DeathCause.Poison]);
  expect(ordinaryNightDeathPublication(runtime, proposal.nightDeaths, proposal.retainedSources)).toEqual({});
  const failure = new Error("literal_fox_target_current_failed");
  claims[1] = { ...claims[1]!, isTargetCurrent() { throw failure; } };
  let caught: unknown;
  try { prepareOrdinaryNightDeaths(runtime); } catch (error) { caught = error; }
  expect(caught).toBe(failure);
  expect(events).toHaveLength(1);
  expect(f.lives.map(({ life }) => life.alive)).toEqual([true, true, false, true, true, true]);
});

test("动物只公开实际共同原因的夜死，双生保原名单；发布 callee 先于晚配置，回执失败保事件", () => {
  const f = fixture(3), trace: string[] = [], events: GameEvent[] = [];
  const damage = { deaths: [1, 2], deathSources: { 1: [DeathCause.WolfKill], 2: [DeathCause.Poison] } };
  const config: OrdinaryNightDeathRuntime["config"] = {
    animalDream: { policy: "awa_animal_dream_v1", eliminationPriority: "awa_wolf_priority_v1" },
  };
  const failure = new Error("literal_night_publication_failed");
  let failAt: "none" | "publish" | "receipt" = "none";
  const sink = {
    get emit() {
      trace.push("callee");
      return (ids: number[]) => {
        trace.push("publish");
        if (failAt === "publish") throw failure;
        const event: GameEvent = { timestamp: 2, type: "night_resolved", payload: { deaths: [...ids] } };
        events.push(event);
        return event;
      };
    },
  };
  const runtime: OrdinaryNightDeathRuntime = {
    world: f.world,
    night: { damage, deathLives: f.deathLives },
    get config() { trace.push("config"); return config; },
    // 与真实经理 sink 同形：方法 callee 先读取，名单 thunk 后执行，不在调用方提前取配置。
    publishNightResolved(deaths) { return sink.emit(deaths()); },
  };
  const proposal = prepareOrdinaryNightDeaths(runtime);
  expect(events).toEqual([]);
  const publication = ordinaryNightDeathPublication(runtime, proposal.nightDeaths, proposal.retainedSources);
  const callback = publication.onInitialWaveCommitted;
  if (!callback) throw new Error("literal_initial_publication_missing");
  const actualIds = [1, 2, 3], actualSources = { 1: [DeathCause.WolfKill], 2: [DeathCause.Exile], 3: [DeathCause.Poison] };
  const receipt = new DeathCommitReceipt(planDeathWave(actualIds, actualSources, "initial"), []);
  const record = receipt.recordPublication;
  Object.defineProperty(receipt, "recordPublication", {
    value(this: DeathCommitReceipt, event: GameEvent, ids: readonly number[]) {
      trace.push("receipt");
      if (failAt === "receipt") throw failure;
      record.call(this, event, ids);
    },
  });
  trace.length = 0;
  const event = callback(actualIds, actualSources, receipt);
  expect(trace).toEqual(["callee", "config", "publish", "receipt"]);
  expect(event.payload).toEqual({ deaths: [1] });
  expect(receipt.publicationLinks()[0]!.event).toBe(event);
  expect(receipt.publicationLinks()[0]!.ids).toEqual([1, 2, 3]);
  expect(receipt.publicationLinks()[0]!.ids).not.toBe(actualIds);
  failAt = "publish";
  let caught: unknown;
  trace.length = 0;
  try { callback(actualIds, actualSources, receipt); } catch (error) { caught = error; }
  expect(caught).toBe(failure);
  expect(trace).toEqual(["callee", "config", "publish"]);
  expect(events).toHaveLength(1);
  failAt = "receipt";
  caught = undefined;
  trace.length = 0;
  try { callback(actualIds, actualSources, receipt); } catch (error) { caught = error; }
  expect(caught).toBe(failure);
  expect(trace).toEqual(["callee", "config", "publish", "receipt"]);
  expect(events).toHaveLength(2);
  expect(events[1]!.payload).toEqual({ deaths: [1] });
  expect(receipt.publicationLinks()).toHaveLength(1);
  const fragrant = ordinaryNightDeathPublication({
    ...runtime,
    config: { fragrantPairSeer: { policy: "awa_fragrant_pair_seer_v1" } },
  }, proposal.nightDeaths, proposal.retainedSources).onInitialWaveCommitted;
  if (!fragrant) throw new Error("literal_fragrant_publication_missing");
  failAt = "none";
  const fragrantReceipt = new DeathCommitReceipt(planDeathWave([], {}, "initial"), []);
  const fragrantEvent = fragrant([], undefined, fragrantReceipt);
  expect(fragrantEvent.payload).toEqual({ deaths: [1, 2] });
  expect(fragrantReceipt.publicationLinks()[0]!.event).toBe(fragrantEvent);
  expect(f.lives.map(({ life }) => life.alive)).toEqual([true, true, true]);
});
