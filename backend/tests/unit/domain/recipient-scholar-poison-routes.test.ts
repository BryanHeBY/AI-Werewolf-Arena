/**
 * 单元测试：负责检查受赠／学者原毒到实际单目标伤害的因果路由。
 * 输入为捕获的原生命、独立已付毒和旧注入 claim；输出以字面死因、原体身份和归档形状验收。
 * 路由只属于一次伤害折叠，反射改变目标但不改变原因果身份；不运行完整对局或模型。
 * 测试中的集合清空只验证真实路由消费者，既不恢复库存也不调用生产规则生成预期。
 */
import { createAliveComponent } from "../../../src/game/observation/component-presentation";
import { expect, test } from "bun:test";
import { World } from "../../../src/core/domain/world";
import { COMPONENT } from "../../../src/core/domain/components/names";

import { StatusMarksComponent } from "../../../src/core/domain/components/status_marks";
import { StatusMark, DeathCause } from "../../../src/core/domain/model";
import {
  captureNightLife, originalPoisonIntent, mechanicalNightIntent, nightPoisonRoutes,
  planMechanicalDamage,
} from "../../../src/core/domain/night_effects";
import { planNightDamage } from "../../../src/core/domain/night-damage-plan";
import { resolveNightDamageTarget } from "../../../src/core/domain/night-damage-target";

function fixture() {
  const world = new World();
  const ids = Array.from({ length: 3 }, () => world.createEntity());
  for (const id of ids) {
    world.addComponent(id, COMPONENT.Alive, createAliveComponent());
    world.addComponent(id, COMPONENT.StatusMarks, new StatusMarksComponent());
  }
  return { world, lives: ids.map((id) => captureNightLife(world, id)!) };
}

for (const [family, stage, abilityId] of [
  ["lucky", "lucky", "gift:miracle"],
  ["black-market", "black_market_recipient", "gift:black-market"],
  ["scholar-mentor", "scholar_mentor_bonus", "bonus:poison"],
] as const)
  test(`${family} paid poison origin reaches the actual target acceptance branch`, () => {
    const { world, lives } = fixture(), [source, target] = lives;
    const claim = originalPoisonIntent({ source: source!, target: target! }, {
      family, stage, abilityId, day: 2, actorLife: source!, requestedTargetId: target!.id,
    });
    const marks = world.getComponent(target!.id, COMPONENT.StatusMarks)!;
    marks.add(StatusMark.PoisonMark);
    const plan = planNightDamage(world, { intentNight: 2, poisonClaims: [claim] });
    const routes = nightPoisonRoutes(plan.mechanical);
    expect(routes).toHaveLength(1);
    expect(routes[0]!.origin).toBe(claim.origin);
    expect(routes[0]!.target).toBe(target);
    expect(routes[0]!.route).toBe("direct");
    // owned 路由是实际消费端；旧集合仍独立保留对外 legacy 的兼容接口。
    (plan.mechanical.directPoisonTargets as Set<number>).clear();
    expect(resolveNightDamageTarget(world, target!.id, {}, plan, marks, () => {}))
      .toEqual([DeathCause.Poison]);
  });

test("reflection carries the original cause to the caster body without changing serialized fold fields", () => {
  const { world, lives } = fixture(), [owner, source, target] = lives;
  const shield = mechanicalNightIntent("mechanical-shield", {
    actorId: owner!.id, target: target!, isCurrent: () => true,
  }, {
    family: "mechanical", stage: "mechanical_skill", day: 2,
    actorLife: owner!, requestedTargetId: target!.id, abilityId: "learned:mechanical",
  });
  const claim = originalPoisonIntent({ source: source!, target: target! }, {
    family: "scholar-mentor", stage: "scholar_mentor_bonus", day: 2,
    actorLife: source!, requestedTargetId: target!.id, abilityId: "bonus:poison",
  });
  const fold = planMechanicalDamage(world, { shields: [shield], attacks: [], failures: [] }, [claim]);
  const route = nightPoisonRoutes(fold)[0]!;
  expect(route.origin.causeId).toBe(claim.origin.causeId);
  expect(route.origin.effectiveTargetId).toBe(target!.id);
  expect(route.target).toBe(source);
  expect(route.targetId).toBe(source!.id);
  expect(route.route).toBe("reflected");
  expect(Object.isFrozen(route)).toBe(true);
  expect(Object.isFrozen(nightPoisonRoutes(fold))).toBe(true);
  expect(Object.keys(fold)).toEqual([
    "shields", "directPoisonTargets", "reflectedPoisonTargets", "attacks", "failures", "reflections",
  ]);
  expect(JSON.stringify(fold)).not.toContain("origin");
  expect(fold.reflections).toEqual([
    { actorId: owner!.id, protectedTargetId: target!.id, casterId: source!.id },
  ]);
});

test("legacy poison keeps the original target path and never becomes a forged causal route", () => {
  const { world, lives } = fixture(), [source, target] = lives;
  let metadataReads = 0;
  const legacy = { source: source!, target: target! };
  Object.defineProperty(legacy, "origin", {
    get() { metadataReads++; throw new Error("legacy_origin_unused"); },
  });
  const marks = world.getComponent(target!.id, COMPONENT.StatusMarks)!;
  marks.add(StatusMark.PoisonMark);
  const plan = planNightDamage(world, { poisonClaims: [legacy] });
  expect(nightPoisonRoutes(plan.mechanical)).toEqual([]);
  expect(resolveNightDamageTarget(world, target!.id, {}, plan, marks, () => {}))
    .toEqual([DeathCause.Poison]);
  expect(metadataReads).toBe(0);
});

test("an external legacy damage-plan Proxy keeps its original collection reads without a new Symbol trap", () => {
  const { world, lives } = fixture(), [source, target] = lives;
  const marks = world.getComponent(target!.id, COMPONENT.StatusMarks)!;
  marks.add(StatusMark.PoisonMark);
  const plan = planNightDamage(world, { poisonClaims: [{ source: source!, target: target! }] });
  let symbolReads = 0;
  const legacyMechanical = { ...plan.mechanical };
  const proxy = new Proxy(legacyMechanical, {
    get(object, key, receiver) {
      if (typeof key === "symbol") { symbolReads++; throw new Error("legacy_symbol_unused"); }
      return Reflect.get(object, key, receiver);
    },
  });
  expect(resolveNightDamageTarget(world, target!.id, {}, { ...plan, mechanical: proxy }, marks, () => {}))
    .toEqual([DeathCause.Poison]);
  expect(symbolReads).toBe(0);
});
