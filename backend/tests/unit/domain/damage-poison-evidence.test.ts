/**
 * 单元测试验证真实毒接受分支与延期副本保留同一因果证据。
 * 输入为内存 World、字面原体、独立毒及盾；预期死因与目标由手写常量给出。
 * 验证保护抑制、同目标直接／反射区别、legacy Proxy 和原序列化形状，不运行整局或模型。
 */
import { createAliveComponent } from "../../../src/agents/observation/component-presentation";
import { expect, test } from "bun:test";
import { World } from "../../../src/domain/world";
import { COMPONENT } from "../../../src/domain/components/names";

import { StatusMarksComponent } from "../../../src/domain/components/status-marks";
import { StatusMark, DeathCause } from "../../../src/domain/model";
import {
  captureNightLife, originalPoisonIntent, mechanicalNightIntent,
} from "../../../src/domain/night-effects";
import { damagePoisonRoutes } from "../../../src/domain/damage-evidence";
import { DamageResolutionSystem } from "../../../src/domain/systems/damage-resolution-system";
import { MistPendingNight } from "../../../src/features/mist-raven/pending-night";
import { DreamNightFrame } from "../../../src/features/dreamer/night-frame";

function fixture() {
  const world = new World();
  for (let i = 0; i < 3; i++) {
    const id = world.createEntity();
    world.addComponent(id, COMPONENT.Alive, createAliveComponent());
    world.addComponent(id, COMPONENT.StatusMarks, new StatusMarksComponent());
  }
  return { world, source: captureNightLife(world, 1)!, target: captureNightLife(world, 2)!, shieldOwner: captureNightLife(world, 3)! };
}
function poison(f: ReturnType<typeof fixture>, target = f.target) {
  return originalPoisonIntent({ source: f.source, target }, {
    family: "scholar-mentor", stage: "scholar_mentor_bonus", day: 2,
    actorLife: f.source, requestedTargetId: target.id, abilityId: "bonus:poison",
  });
}
function shield(f: ReturnType<typeof fixture>) {
  return mechanicalNightIntent("mechanical-shield", {
    actorId: f.shieldOwner.id, target: f.target, isCurrent: () => true,
  }, {
    family: "mechanical", stage: "mechanical_skill", day: 2,
    actorLife: f.shieldOwner, requestedTargetId: 2, abilityId: "learned:guard",
  });
}

test("two accepted poisons preserve independent causes and original result fields", () => {
  const f = fixture(), a = poison(f), b = poison(f);
  f.world.getComponent(2, COMPONENT.StatusMarks)!.add(StatusMark.PoisonMark);
  const result = new DamageResolutionSystem().resolve(f.world, { intentNight: 2, poisonClaims: [a, b] });
  expect(result.deaths).toEqual([2]);
  expect(result.deathSources).toEqual({ 2: [DeathCause.Poison] });
  const routes = damagePoisonRoutes(result);
  expect(routes.map(r => r.origin.causeId)).toEqual([a.origin.causeId, b.origin.causeId]);
  expect(a.origin.causeId).not.toBe(b.origin.causeId);
  expect(routes[0]!.target).toBe(f.target);
  expect(Object.isFrozen(routes)).toBe(true);
  expect(Object.keys(result)).toEqual(["deaths", "deathSources"]);
  expect(JSON.stringify(result)).toBe('{"deaths":[2],"deathSources":{"2":["poison"]}}');
});

test("dream protection does not turn a folded route into accepted lethal evidence", () => {
  const f = fixture();
  f.world.getComponent(2, COMPONENT.StatusMarks)!.add(StatusMark.PoisonMark);
  const result = new DamageResolutionSystem().resolve(f.world, {
    intentNight: 2, poisonClaims: [poison(f)], protectedTargets: [2],
  });
  expect(result.deaths).toEqual([]);
  expect(result.deathSources).toEqual({});
  expect(damagePoisonRoutes(result)).toEqual([]);
});

test("reflected poison reaches the caster without attributing an unmarked direct poison there", () => {
  const f = fixture(), reflected = poison(f), unmarkedDirect = poison(f, f.source);
  f.world.getComponent(2, COMPONENT.StatusMarks)!.add(StatusMark.PoisonMark);
  const result = new DamageResolutionSystem().resolve(f.world, {
    intentNight: 2, poisonClaims: [reflected, unmarkedDirect],
    mechanicalEffects: { shields: [shield(f)], attacks: [], failures: [] },
  });
  expect(result.deaths).toEqual([1]);
  expect(result.deathSources).toEqual({ 1: [DeathCause.Poison] });
  const routes = damagePoisonRoutes(result);
  expect(routes).toHaveLength(1);
  expect(routes[0]!.origin.causeId).toBe(reflected.origin.causeId);
  expect(routes[0]!.target).toBe(f.source);
  expect(routes[0]!.route).toBe("reflected");
});

test("delayed Mist copies carry the same accepted source without new enumerable fields", () => {
  const f = fixture(), claim = poison(f);
  f.world.getComponent(2, COMPONENT.StatusMarks)!.add(StatusMark.PoisonMark);
  const result = new DamageResolutionSystem().resolve(f.world, { intentNight: 2, poisonClaims: [claim] });
  const pending = new MistPendingNight(f.world, 2, 2, result, new DreamNightFrame([]));
  pending.claim(() => true);
  const final = pending.prepareFinalDamage(2, () => true);
  expect(final.deaths).toEqual([2]);
  expect(final.deathSources).toEqual({ 2: [DeathCause.Poison] });
  expect(final).not.toBe(result);
  expect(damagePoisonRoutes(final)[0]!.origin).toBe(claim.origin);
  expect(damagePoisonRoutes(final)[0]!.target).toBe(f.target);
  expect(Object.keys(final)).toEqual(["deaths", "deathSources"]);
});

test("old external result Proxy is not inspected for new metadata", () => {
  let reads = 0;
  const result = new Proxy({ deaths: [], deathSources: {} }, {
    get() { reads++; throw new Error("legacy_damage_getter_unused"); },
  });
  expect(damagePoisonRoutes(result)).toEqual([]);
  expect(reads).toBe(0);
});
