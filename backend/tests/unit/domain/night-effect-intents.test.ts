/**
 * 单元测试：验证机械／觉醒／原毒的有来源效果消费链。
 * 输入是原生命、字面量 callback、已付标记以及新旧效果对象；输出与独立预期检查
 * 类别、夜时点、原体、因果 ID 和单次反射，错误保持原标记及已付前缀。
 * 旧注入额外 getter 不读取，新 owned intent 的约束属于明确强化；不跑完整对局或模型。
 */
import { createAliveComponent } from "../../../src/agents/observation/component-presentation";
import { expect, test } from "bun:test";
import { World } from "../../../src/domain/world";
import { COMPONENT } from "../../../src/domain/components/names";

import { StatusMark } from "../../../src/domain/identity";
import { StatusMarksComponent } from "../../../src/domain/components/status-marks";
import {
  captureNightLife, mechanicalNightIntent, awakenedNightIntent, originalPoisonIntent,
  planMechanicalDamage, type NightMechanicalEffect,
} from "../../../src/domain/night-effects";
import { planNightDamage } from "../../../src/domain/night-damage-plan";

function fixture() {
  const world = new World();
  const ids = Array.from({ length: 3 }, () => world.createEntity());
  for (const id of ids) {
    world.addComponent(id, COMPONENT.Alive, createAliveComponent());
    world.addComponent(id, COMPONENT.StatusMarks, new StatusMarksComponent());
  }
  return { world, ids, lives: ids.map((id) => captureNightLife(world, id)!) };
}

test("one original poison retains source/target identity and reflects only once through its stamped shield", () => {
  const { world, lives } = fixture(), [owner, caster, victim] = lives;
  const shieldBase = { actorId: owner!.id, target: victim!, isCurrent: () => true };
  const shield = mechanicalNightIntent("mechanical-shield", shieldBase, {
    family: "mechanical", day: 2, stage: "mechanical_skill", actorLife: owner!,
    requestedTargetId: victim!.id, abilityId: "learned:mechanical",
  });
  const poisonBase = { source: caster!, target: victim! };
  const poison = originalPoisonIntent(poisonBase, {
    family: "witch", day: 2, stage: "witch", actorLife: caster!,
    requestedTargetId: victim!.id, abilityId: "native:potion",
  });
  const plan = planMechanicalDamage(world, { shields: [shield], attacks: [], failures: [] }, [poison], new Set(), () => 2);
  expect<object>(shield).toBe(shieldBase);
  expect<object>(poison).toBe(poisonBase);
  expect(poison.source).toBe(caster);
  expect(poison.target).toBe(victim);
  expect(poison.origin.causeId.description).toBe(`effect:2:witch:witch:${caster!.id}:original-poison:native:potion:${victim!.id}:${victim!.id}`);
  expect([...plan.directPoisonTargets]).toEqual([]);
  expect([...plan.reflectedPoisonTargets]).toEqual([caster!.id]);
  expect(plan.reflections).toEqual([{ actorId: owner!.id, protectedTargetId: victim!.id, casterId: caster!.id }]);
});

test("a paid awakened shield absorbs original poison before mechanical reflection", () => {
  const { world, lives } = fixture(), [owner, caster, victim] = lives;
  const shield = awakenedNightIntent("awakened-shield", { actorId: owner!.id, target: victim!, isCurrent: () => true }, {
    family: "awakened", day: 3, stage: "awakened_skill", actorLife: owner!, requestedTargetId: victim!.id, abilityId: "learned:awakened",
  });
  const poison = originalPoisonIntent({ source: caster!, target: victim! }, {
    family: "witch", day: 3, stage: "witch", actorLife: caster!, requestedTargetId: victim!.id, abilityId: "native:potion",
  });
  const plan = planNightDamage(world, { intentNight: 3, awakenedEffects: { shields: [shield], attacks: [] }, poisonClaims: [poison] });
  expect([...plan.awakenedShields]).toEqual([victim!.id]);
  expect([...plan.mechanical.directPoisonTargets]).toEqual([]);
  expect(plan.mechanical.reflections).toEqual([]);
});

for (const violation of ["kind", "night", "target"] as const)
  test(`new ${violation} mismatch refuses consumption without undoing paid marks`, () => {
    const { world, lives } = fixture(), [owner, , victim] = lives;
    const marks = world.getComponent(victim!.id, COMPONENT.StatusMarks)!;
    marks.add(StatusMark.PoisonMark);
    const shield = mechanicalNightIntent("mechanical-shield", { actorId: owner!.id, target: victim!, isCurrent: () => true }, {
      family: "mechanical", day: 2, stage: "mechanical_skill", actorLife: owner!, requestedTargetId: victim!.id, abilityId: "learned:mechanical",
    });
    if (violation === "target") (shield as { target: typeof victim }).target = owner;
    expect(() => planNightDamage(world, {
      intentNight: violation === "night" ? 3 : 2,
      mechanicalEffects: violation === "kind" ? { shields: [], attacks: [shield], failures: [] } : { shields: [shield], attacks: [], failures: [] },
    })).toThrow(`night_effect_intent_${violation === "night" ? "night" : violation}_mismatch`);
    expect(marks.values()).toEqual([StatusMark.PoisonMark]);
    expect(victim!.life.alive).toBe(true);
  });

test("legacy input keeps callback receiver/target reads and ignores forged metadata getters", () => {
  const { world, lives } = fixture(), [owner, , victim] = lives;
  let targetReads = 0, metadataReads = 0;
  const effect: NightMechanicalEffect = {
    actorId: owner!.id,
    get target() { targetReads++; return victim!; },
    isCurrent() { expect(this).toBe(effect); return true; },
  };
  Object.defineProperties(effect, {
    kind: { get() { metadataReads++; throw new Error("legacy_kind_unused"); } },
    origin: { get() { metadataReads++; throw new Error("legacy_origin_unused"); } },
  });
  const plan = planNightDamage(world, {
    get intentNight(): number { metadataReads++; throw new Error("legacy_day_unused"); },
    mechanicalEffects: { shields: [effect], attacks: [], failures: [] },
  });
  expect([...plan.mechanical.shields]).toEqual([victim!.id]);
  expect(targetReads).toBe(2);
  expect(metadataReads).toBe(0);
});

test("owned metadata cannot be rewritten to bless retargeting or annotated a second time", () => {
  const { world, lives } = fixture(), [owner, other, victim] = lives;
  const base = { actorId: owner!.id, target: victim!, isCurrent: () => true };
  const origin = { family: "mechanical" as const, day: 2, stage: "mechanical_skill" as const, actorLife: owner!, requestedTargetId: victim!.id, abilityId: "learned:mechanical" };
  const shield = mechanicalNightIntent("mechanical-shield", base, origin);
  expect(() => Object.defineProperty(shield, "origin", { value: { ...shield.origin, effectiveTargetId: other!.id, targetVersion: other!.version, targetBody: other!.life } })).toThrow();
  expect(() => Object.defineProperty(shield, "kind", { value: "mechanical-attack" })).toThrow();
  expect(() => mechanicalNightIntent("mechanical-shield", base, origin)).toThrow("night_effect_intent_already_owned");
  base.target = other!;
  expect(() => planNightDamage(world, { intentNight: 2, mechanicalEffects: { shields: [shield], attacks: [], failures: [] } })).toThrow("night_effect_intent_target_mismatch");
});

test("each same-label original toxin keeps a distinct cause identity and is reflected separately", () => {
  const { world, lives } = fixture(), [owner, caster, victim] = lives;
  const shield = mechanicalNightIntent("mechanical-shield", { actorId: owner!.id, target: victim!, isCurrent: () => true }, {
    family: "mechanical", day: 2, stage: "mechanical_skill", actorLife: owner!, requestedTargetId: victim!.id, abilityId: "learned:mechanical",
  });
  const origin = { family: "witch" as const, day: 2, stage: "witch" as const, actorLife: caster!, requestedTargetId: victim!.id, abilityId: "native:potion" };
  const one = originalPoisonIntent({ source: caster!, target: victim! }, origin),
    two = originalPoisonIntent({ source: caster!, target: victim! }, origin);
  expect(one.origin.causeId).not.toBe(two.origin.causeId);
  expect(one.origin.causeId.description).toBe(two.origin.causeId.description);
  const plan = planMechanicalDamage(world, { shields: [shield], attacks: [], failures: [] }, [one, two], new Set(), () => 2);
  expect(plan.reflections).toHaveLength(2);
  expect([...plan.reflectedPoisonTargets]).toEqual([caster!.id]);
});

test("a branded shield cannot change the reflected source actor after payment", () => {
  const { world, lives } = fixture(), [owner, caster, victim] = lives;
  const base = { actorId: owner!.id, target: victim!, isCurrent: () => true };
  const shield = mechanicalNightIntent("mechanical-shield", base, {
    family: "mechanical", day: 2, stage: "mechanical_skill", actorLife: owner!, requestedTargetId: victim!.id, abilityId: "learned:mechanical",
  });
  const poison = originalPoisonIntent({ source: caster!, target: victim! }, {
    family: "witch", day: 2, stage: "witch", actorLife: caster!, requestedTargetId: victim!.id, abilityId: "native:potion",
  });
  base.actorId = caster!.id;
  expect(() => planMechanicalDamage(world, { shields: [shield], attacks: [], failures: [] }, [poison], new Set(), () => 2)).toThrow("night_effect_intent_source_mismatch");
});
