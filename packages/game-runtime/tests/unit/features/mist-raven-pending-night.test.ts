/**
 * 单元测试用明确根、连线、救药及穿透声明验证雾鸦待处理夜晚。手写死因集合与原前缀断言
 * 验证选择性来源移除，输入及字面／不可变 fixture 预期保持原样，不运行模型或完整对局。
 */
import { bindDreamLifeQueries } from "../../../src/domain/dream-night-effects";
import { createAliveComponent } from "../../../src/agents/observation/component-presentation";
import { expect, test } from "bun:test";
import { World } from "../../../src/domain/world";
import { aliveLifeVersion } from "../../../src/domain/components/alive";
import { COMPONENT } from "../../../src/domain/components/names";
import { DeathCause, type DeathSources } from "../../../src/domain/deaths";
import { DreamNightFrame, type DreamNightLink } from "../../../src/features/dreamer/night-frame";
import { MistPendingNight } from "../../../src/features/mist-raven/pending-night";
import type { GameEvent } from "../../../src/domain/events";

function setup(day = 1, consecutive = false) {
  const world = new World();
  const lives = Array.from({ length: 6 }, () => {
    const id = world.createEntity(),
      life = createAliveComponent();
    world.addComponent(id, COMPONENT.Alive, life);
    return life;
  });
  const link: DreamNightLink = {
    actorId: 1,
    targetId: 2,
    day,
    consecutive,
    protectionPolicy: "netease_2026_night_immunity_v1",
    actorLife: lives[0]!,
    actorVersion: aliveLifeVersion(lives[0]!),
    targetLife: lives[1]!,
    targetVersion: aliveLifeVersion(lives[1]!),
  };
  const dreams = new DreamNightFrame([link]);
  const pending = (wolfTarget: number | null, sources: DeathSources) =>
    new MistPendingNight(
      world,
      day,
      wolfTarget,
      { deaths: Object.keys(sources).map(Number), deathSources: sources },
      dreams,
    );
  return { world, lives, dreams, pending };
}
// 这些用例手动冻结直接来源；此处用另一种已有刀因表示
// 未来 Raven 来源，本基础夹具不注册或执行 Raven。
const extra = DeathCause.AwakenedHiddenKnife;
test("saving the dreamer removes an unconfirmed link, not merely the root id", () => {
  const { world, lives, dreams, pending } = setup(),
    p = pending(1, { 1: [DeathCause.WolfKill] });
  expect(p.status).toBe("pending");
  expect(world.getAliveEntityIds()).toEqual([1, 2, 3, 4, 5, 6]);
  const events: GameEvent[] = [];
  dreams.recordDeaths([1, 2], events);
  expect(events).toEqual([]);
  p.claim(() => true);
  const final = p.prepareFinalDamage(1, () => true);
  expect(final).toEqual({ deaths: [], deathSources: {} });
  dreams.recordDeaths([1, 2], events);
  expect(events).toEqual([]);
  expect(lives.every((l) => l.alive)).toBe(true);
  p.finish(() => true);
  expect(p.status).toBe("committed");
});
test("saving dreamer retains a dreamwalker's independent penetrating source", () => {
  const { world, lives, dreams, pending } = setup(),
    p = pending(1, { 1: [DeathCause.WolfKill], 2: [extra] });
  p.claim(() => true);
  const final = p.prepareFinalDamage(1, () => true);
  expect(final).toEqual({ deaths: [2], deathSources: { 2: [extra] } });
  lives[1]!.alive = false;
  p.finish(() => true);
  const events: GameEvent[] = [];
  dreams.recordDeaths([2], events);
  expect(events).toEqual([]);
  expect(world.getAliveEntityIds()).toEqual([1, 3, 4, 5, 6]);
});
test("extra knife on the dreamer survives snake and establishes its real linked death", () => {
  const { lives, dreams, pending } = setup(),
    p = pending(1, { 1: [DeathCause.WolfKill, extra] });
  p.claim(() => true);
  const final = p.prepareFinalDamage(1, () => true);
  expect(final).toEqual({
    deaths: [1, 2],
    deathSources: { 1: [extra], 2: [DeathCause.Dream] },
  });
  const events: GameEvent[] = [];
  dreams.recordDeaths(final.deaths, events);
  expect(events.map((e) => e.type)).toEqual(["dream_death"]);
  expect(events[0]?.payload).toMatchObject({
    actorId: 1,
    targetId: 2,
    reason: "linked",
  });
  lives[0]!.alive = false;
  lives[1]!.alive = false;
  p.finish(() => true);
  dreams.recordDeaths(final.deaths, events);
  expect(events).toHaveLength(1);
});
test("snake preserves direct consecutive dream and an independent knife cause", () => {
  const { world, lives, dreams, pending } = setup(2, true);
  expect(dreams.consecutiveDeaths(bindDreamLifeQueries(world))).toEqual([2]);
  expect(dreams.consecutiveDeaths(bindDreamLifeQueries(new World()))).toEqual([]); // 其他 World 不能激活已保存的关系。
  const p = pending(2, { 2: [DeathCause.WolfKill, DeathCause.Dream] });
  p.claim(() => true);
  expect(p.prepareFinalDamage(2, () => true)).toEqual({
    deaths: [2],
    deathSources: { 2: [DeathCause.Dream] },
  });
  const events: GameEvent[] = [];
  dreams.recordDeaths([2], events);
  expect(events).toHaveLength(1);
  expect(events[0]?.payload).toMatchObject({
    actorId: 1,
    targetId: 2,
    reason: "consecutive",
  });
  dreams.recordDeaths([2], events);
  expect(events).toHaveLength(1);
  lives[1]!.alive = false;
  p.finish(() => true);
});
test("protected knife information is retained even if direct damage was empty", () => {
  const { lives, pending } = setup(),
    p = pending(2, {});
  expect(p.wolfTarget).toBe(2);
  expect(p.snakeTargets(3)).toEqual([2]);
  p.claim(() => true);
  expect(p.prepareFinalDamage(2, () => true)).toEqual({
    deaths: [],
    deathSources: {},
  });
  expect(lives[1]!.alive).toBe(true);
  p.finish(() => true);
});
test("same-target extra source cannot be deleted by curing ordinary knife", () => {
  const { lives, pending } = setup(),
    p = pending(3, { 3: [DeathCause.WolfKill, extra] });
  p.claim(() => true);
  expect(p.prepareFinalDamage(3, () => true)).toEqual({
    deaths: [3],
    deathSources: { 3: [extra] },
  });
  lives[2]!.alive = false;
  p.finish(() => true);
});
test("first-night self-heal policy uses the pending night, not a current Day counter", () => {
  expect(setup(1).pending(3, {}).snakeTargets(3)).toEqual([3]);
  expect(setup(2).pending(3, {}).snakeTargets(3)).toEqual([]);
});
test("a blast's real death remains dead; knife still known and snake is pass-only", () => {
  const { world, lives, pending } = setup(),
    p = pending(3, { 3: [DeathCause.WolfKill], 4: [extra] });
  p.claim(() => true);
  lives[2]!.alive = false;
  expect(p.wolfTarget).toBe(3);
  expect(p.snakeTargets(5)).toEqual([]);
  expect(p.prepareFinalDamage(null, () => true)).toEqual({
    deaths: [4],
    deathSources: { 4: [extra] },
  });
  expect(world.getAliveEntityIds()).not.toContain(3);
  lives[3]!.alive = false;
  p.finish(() => true);
});
test("same number replacement and death-revival cannot inherit ordinary or extra damage", () => {
  const { world, lives, pending } = setup(),
    p = pending(3, { 3: [DeathCause.WolfKill], 4: [extra] });
  p.claim(() => true);
  world.addComponent(3, COMPONENT.Alive, createAliveComponent());
  lives[3]!.alive = false;
  lives[3]!.alive = true;
  expect(p.snakeTargets(5)).toEqual([]);
  expect(p.prepareFinalDamage(null, () => true)).toEqual({
    deaths: [],
    deathSources: {},
  });
  p.finish(() => true);
});
test("freeze saves all possible link lives, and replaced dreamwalker is excluded", () => {
  const { world, lives, pending } = setup(),
    p = pending(1, { 1: [DeathCause.WolfKill] });
  world.addComponent(2, COMPONENT.Alive, createAliveComponent());
  p.claim(() => true);
  expect(p.prepareFinalDamage(null, () => true)).toEqual({
    deaths: [1],
    deathSources: { 1: [DeathCause.WolfKill] },
  });
  lives[0]!.alive = false;
  p.finish(() => true);
});
test("claim before first await blocks every attempted duplicate request", async () => {
  const { pending } = setup(),
    p = pending(null, {});
  p.claim(() => true);
  await Promise.resolve();
  expect(() => p.claim(() => true)).toThrow("mist_pending_night_reentry");
  expect(() => p.finish(() => true)).toThrow("mist_pending_night_reentry");
  p.prepareFinalDamage(null, () => true);
  expect(() => p.prepareFinalDamage(null, () => true)).toThrow("mist_pending_night_reentry");
  p.finish(() => true);
  p.abort();
  expect(p.status).toBe("committed");
  expect(() => p.claim(() => true)).toThrow("mist_pending_night_reentry");
});
test("stale phase, cancellation and failed commit never reopen the pending night", () => {
  for (const boundary of ["claim", "prepare", "finish"] as const) {
    const { pending } = setup(),
      p = pending(null, {});
    if (boundary !== "claim") p.claim(() => true);
    if (boundary === "finish") p.prepareFinalDamage(null, () => true);
    expect(() =>
      boundary === "claim"
        ? p.claim(() => false)
        : boundary === "prepare"
          ? p.prepareFinalDamage(null, () => false)
          : p.finish(() => false),
    ).toThrow("mist_pending_night_stale");
    expect(p.status).toBe("aborted");
    expect(() => p.claim(() => true)).toThrow("mist_pending_night_reentry");
  }
});
test("no pretend death commit and no revival through a heal response", () => {
  const { lives, pending } = setup(),
    p = pending(3, { 3: [DeathCause.WolfKill] });
  p.claim(() => true);
  p.prepareFinalDamage(null, () => true);
  expect(() => p.finish(() => true)).toThrow("mist_pending_night_unsettled");
  expect(p.status).toBe("aborted");
  const q = pending(4, { 4: [DeathCause.WolfKill] });
  q.claim(() => true);
  lives[3]!.alive = false;
  expect(() => q.prepareFinalDamage(4, () => true)).toThrow("mist_pending_heal_invalid");
  expect(lives[3]!.alive).toBe(false);
});
test("caller mutation cannot rewrite frozen or final causal sources", () => {
  const { lives, pending } = setup(),
    sources: DeathSources = { 3: [DeathCause.WolfKill, extra] },
    p = pending(3, sources);
  sources[3] = [];
  p.claim(() => true);
  const result = p.prepareFinalDamage(null, () => true);
  expect(result.deathSources[3]).toEqual([DeathCause.WolfKill, extra]);
  result.deaths.length = 0;
  result.deathSources[3] = [];
  expect(() => p.finish(() => true)).toThrow("mist_pending_night_unsettled");
  expect(lives[2]!.alive).toBe(true);
});
test("malformed internal direct damage rejects before creating an ownership window", () => {
  const { pending } = setup();
  expect(() => pending(99, {})).toThrow("mist_pending_damage_invalid");
  expect(() => pending(null, { 3: [] })).toThrow("mist_pending_damage_invalid");
  expect(() => pending(null, { 99: [extra] })).toThrow("mist_pending_damage_invalid");
});

for (const boundary of ["claim", "prepare", "finish"] as const) {
  test(`scope abort and original errors are terminal at ${boundary}`, () => {
    for (const mode of ["abort", "throw"] as const) {
      const { pending } = setup(),
        p = pending(null, {}),
        original = new TypeError("fixture_scope_revoked");
      if (boundary !== "claim") p.claim(() => true);
      if (boundary === "finish") p.prepareFinalDamage(null, () => true);
      const scope = () => {
        if (mode === "throw") throw original;
        p.abort();
        return true;
      };
      let caught: unknown;
      try {
        if (boundary === "claim") p.claim(scope);
        else if (boundary === "prepare") p.prepareFinalDamage(null, scope);
        else p.finish(scope);
      } catch (error) {
        caught = error;
      }
      if (mode === "throw") expect(caught).toBe(original);
      else expect((caught as Error).message).toBe("mist_pending_night_stale");
      expect(p.status).toBe("aborted");
      expect(() => p.claim(() => true)).toThrow("mist_pending_night_reentry");
    }
  });
}
test("claim validation cannot prepare damage or claim another action", () => {
  const { pending } = setup(),
    p = pending(null, {});
  p.claim(() => {
    expect(() => p.claim(() => true)).toThrow("mist_pending_night_reentry");
    expect(() => p.prepareFinalDamage(null, () => true)).toThrow("mist_pending_night_reentry");
    return true;
  });
  expect(p.status).toBe("committing");
  p.prepareFinalDamage(null, () => {
    expect(() => p.prepareFinalDamage(null, () => true)).toThrow("mist_pending_night_reentry");
    return true;
  });
  p.finish(() => {
    expect(() => p.finish(() => true)).toThrow("mist_pending_night_reentry");
    return true;
  });
});
test("altered factory accessors cannot execute during capture, query, dream expansion or finish", () => {
  for (const boundary of ["capture", "root", "dream_target", "finish"] as const) {
    const { world, lives, pending } = setup();
    const p = boundary === "capture" ? null : pending(1, { 1: [DeathCause.WolfKill] });
    let calls = 0;
    if (boundary === "finish") {
      p!.claim(() => true);
      p!.prepareFinalDamage(null, () => true);
      lives[0]!.alive = false;
      lives[1]!.alive = false;
    }
    const target = boundary === "dream_target" ? lives[1]! : lives[0]!;
    Object.defineProperty(target, "alive", {
      get() {
        calls++;
        return boundary !== "finish";
      },
      enumerable: true,
      configurable: true,
    });
    if (!p)
      expect(() => pending(1, { 1: [DeathCause.WolfKill] })).toThrow("mist_pending_life_invalid");
    else if (boundary === "finish") {
      expect(() => p.finish(() => true)).toThrow("mist_pending_night_unsettled");
      expect(p.status).toBe("aborted");
    } else {
      if (boundary === "root") expect(p.snakeTargets(3)).toEqual([]);
      p.claim(() => true);
      expect(() => p.prepareFinalDamage(null, () => true)).toThrow("mist_pending_life_invalid");
      expect(p.status).toBe("aborted");
    }
    expect(calls).toBe(0);
    expect(world.entityIds()).toHaveLength(6);
  }
});
