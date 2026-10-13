/**
 * 单元测试用已接受查验死因与明确反击政策验证恶灵骑士的独立库存。字面单次反射、免疫及
 * 序列化历史是预期，输入及字面／不可变 fixture 保持原样，不运行模型或完整对局。
 */
import { createAliveComponent } from "../../../../src/game/observation/component-presentation";
import type { EvilKnightShotPolicy } from "@ai-werewolf-arena/game-contract";
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { sixPlayerMvpConfig } from "../../../../src/runtime/scenarios/six_player_mvp";
import { COMPONENT } from "../../../../src/core/domain/components/names";
import { type AliveComponent } from "../../../../src/core/domain/components/alive";
import type { RoleComponent } from "../../../../src/core/domain/components/role";
import type { StatusMarksComponent } from "../../../../src/core/domain/components/status_marks";
import { Camp, Role, StatusMark } from "../../../../src/core/domain/identity";
import { DeathCause } from "../../../../src/core/domain/deaths";
import { captureNightLife } from "../../../../src/core/domain/night_effects";
import { DamageResolutionSystem } from "../../../../src/core/domain/systems/damage_resolution_system";
import {
  captureEvilKnight,
  commitEvilKnightReflection,
  freshEvilKnightState,
  evilKnightNightShotImmune,
  getEvilKnightState,
} from "../../../../src/game/mechanisms/roles/evil_knight/state";

function fixture(policy: EvilKnightShotPolicy = "night_shot_immune") {
  const { world } = bootstrapGame(sixPlayerMvpConfig);
  const id = (kind: Role) =>
    world
      .entityIds()
      .find((id) => world.getComponent<RoleComponent>(id, COMPONENT.Role)?.role === kind)!;
  const knight = id(Role.Wolf),
    seer = id(Role.Seer),
    witch = id(Role.Witch) ?? id(Role.Villager);
  const role = world.getComponent<RoleComponent>(knight, COMPONENT.Role)!;
  world.getComponent<RoleComponent>(witch, COMPONENT.Role)!.role = Role.Witch;
  role.role = "evil_knight" as Role;
  const state = freshEvilKnightState(policy);
  (role as { privateState: Readonly<Record<string, unknown>> }).privateState = {
    evilKnight: state,
  };
  const binding = captureEvilKnight(world, captureNightLife(world, knight)!)!;
  let current = true;
  const commit = (kind: "seer_check" | "poison" = "seer_check") =>
    commitEvilKnightReflection(
      world,
      binding,
      captureNightLife(world, kind === "poison" ? witch : seer)!,
      kind,
      () => current,
    );
  return {
    world,
    knight,
    seer,
    witch,
    role,
    state,
    binding,
    commit,
    revoke: () => {
      current = false;
    },
  };
}
for (const first of ["seer_check", "poison"] as const) {
  test(`first accepted ${first} consumes only one reflection without consuming immunity`, () => {
    const f = fixture();
    const effect = f.commit(first)!;
    expect(effect.actorId).toBe(f.knight);
    expect(effect.target.id).toBe(first === "poison" ? f.witch : f.seer);
    expect(effect.isCurrent()).toBe(true);
    expect(f.state.reflectionRemaining).toBe(0);
    expect(f.commit(first === "poison" ? "seer_check" : "poison")).toBeNull();
    expect(evilKnightNightShotImmune(f.world, f.knight)).toBe(true);
  });
}
for (const shot of ["night_shot_immune", "hunter_shot_bypasses"] as const) {
  test(`shot policy ${shot} is independent from retaliation`, () => {
    const f = fixture(shot);
    expect(evilKnightNightShotImmune(f.world, f.knight)).toBe(shot === "night_shot_immune");
    expect(f.commit()).not.toBeNull();
    expect(evilKnightNightShotImmune(f.world, f.knight)).toBe(shot === "night_shot_immune");
  });
}
for (const mode of ["role", "state", "camp", "policy", "life", "revive"] as const) {
  test(`original knight ${mode} change revokes an accepted effect without refund`, () => {
    const f = fixture(),
      effect = f.commit()!;
    if (mode === "role") f.role.role = Role.Wolf;
    if (mode === "state")
      (f.role as { privateState: Readonly<Record<string, unknown>> }).privateState = {
        evilKnight: freshEvilKnightState(),
      };
    if (mode === "camp") f.role.camp = Camp.Good;
    if (mode === "policy") f.state.shotPolicy = "hunter_shot_bypasses";
    if (mode === "life") f.world.addComponent(f.knight, COMPONENT.Alive, createAliveComponent());
    if (mode === "revive") {
      const life = f.world.getComponent<AliveComponent>(f.knight, COMPONENT.Alive)!;
      life.alive = false;
      life.alive = true;
    }
    expect(effect.isCurrent()).toBe(false);
    expect(f.state.reflectionRemaining).toBe(0);
  });
}
test("revoked caster ownership cannot spend the reflection", () => {
  const f = fixture();
  f.revoke();
  expect(f.commit()).toBeNull();
  expect(f.state.reflectionRemaining).toBe(1);
});
test("late caster revocation cancels damage without refund", () => {
  const f = fixture(),
    effect = f.commit()!;
  f.revoke();
  expect(effect.isCurrent()).toBe(false);
  expect(f.state.reflectionRemaining).toBe(0);
});
test("replacement and revived caster lives cannot inherit retaliation", () => {
  for (const replace of [false, true]) {
    const f = fixture(),
      effect = f.commit()!;
    if (replace) f.world.addComponent(f.seer, COMPONENT.Alive, createAliveComponent());
    else {
      const life = f.world.getComponent<AliveComponent>(f.seer, COMPONENT.Alive)!;
      life.alive = false;
      life.alive = true;
    }
    expect(effect.isCurrent()).toBe(false);
  }
});
test("only native good Seer or Witch identity can trigger this finite resource", () => {
  const f = fixture();
  f.world.getComponent<RoleComponent>(f.seer, COMPONENT.Role)!.role = Role.Villager;
  expect(f.commit()).toBeNull();
  expect(f.state.reflectionRemaining).toBe(1);
});
test("state reading rejects accessor fields without executing them", () => {
  const f = fixture();
  let read = 0;
  Object.defineProperty(f.state, "reflectionRemaining", {
    get() {
      read++;
      return 1;
    },
  });
  expect(getEvilKnightState(f.role)).toBeUndefined();
  expect(read).toBe(0);
});
for (const marks of [
  [],
  [StatusMark.GuardMark],
  [StatusMark.HealMark],
  [StatusMark.GuardMark, StatusMark.HealMark],
  [StatusMark.PoisonMark],
  [StatusMark.WolfKillMark],
]) {
  test(`retaliation remains independent of ordinary marks ${marks.join(",")}`, () => {
    const f = fixture(),
      effect = f.commit()!;
    const status = f.world.getComponent<StatusMarksComponent>(f.seer, COMPONENT.StatusMarks)!;
    for (const mark of marks) status.add(mark);
    const damage = new DamageResolutionSystem().resolve(f.world, {
      retaliationAttacks: [effect, effect],
    });
    expect(damage.deaths).toEqual([f.seer]);
    expect(
      damage.deathSources[f.seer]!.filter((c) => c === DeathCause.EvilKnightReflection),
    ).toHaveLength(1);
    expect(damage.deathSources[f.seer]).toEqual(
      expect.arrayContaining([
        DeathCause.EvilKnightReflection,
        ...(marks.includes(StatusMark.PoisonMark) ? [DeathCause.Poison] : []),
        ...(marks.includes(StatusMark.WolfKillMark) ? [DeathCause.WolfKill] : []),
      ]),
    );
    expect(f.world.getComponent<AliveComponent>(f.seer, COMPONENT.Alive)!.alive).toBe(true);
  });
}
test("revoked retaliation contributes no damage; absence of status marks does not suppress a valid effect", () => {
  const f = fixture(),
    effect = f.commit()!;
  f.world.removeComponent(f.seer, COMPONENT.StatusMarks);
  expect(
    new DamageResolutionSystem().resolve(f.world, { retaliationAttacks: [effect] }).deaths,
  ).toEqual([f.seer]);
  f.revoke();
  expect(
    new DamageResolutionSystem().resolve(f.world, { retaliationAttacks: [effect] }).deaths,
  ).toEqual([]);
});

for (const shot of ["night_shot_immune", "hunter_shot_bypasses"] as const) {
  for (const poison of [false, true]) {
    test(`persistent night immunity ${shot}/poison=${poison} survives spent reflection`, () => {
      const f = fixture(shot);
      f.commit();
      const marks = f.world.getComponent<StatusMarksComponent>(f.knight, COMPONENT.StatusMarks)!;
      marks.add(StatusMark.WolfKillMark);
      if (poison) marks.add(StatusMark.PoisonMark);
      const damage = new DamageResolutionSystem().resolve(f.world, {
        nightImmunities: [f.binding],
      });
      expect(damage.deaths).toEqual([]);
      expect(marks.has(StatusMark.WolfKillMark)).toBe(false);
      expect(marks.has(StatusMark.PoisonMark)).toBe(false);
      expect(f.state.reflectionRemaining).toBe(0);
    });
  }
}
test("revoked immunity binding cannot protect a replacement body", () => {
  const f = fixture();
  f.world.addComponent(f.knight, COMPONENT.Alive, createAliveComponent());
  f.world
    .getComponent<StatusMarksComponent>(f.knight, COMPONENT.StatusMarks)!
    .add(StatusMark.PoisonMark);
  const damage = new DamageResolutionSystem().resolve(f.world, { nightImmunities: [f.binding] });
  expect(damage.deaths).toEqual([f.knight]);
});
test("night immunity does not remove retaliation against its caster", () => {
  const f = fixture(),
    effect = f.commit()!;
  f.world
    .getComponent<StatusMarksComponent>(f.knight, COMPONENT.StatusMarks)!
    .add(StatusMark.PoisonMark);
  const damage = new DamageResolutionSystem().resolve(f.world, {
    nightImmunities: [f.binding],
    retaliationAttacks: [effect],
  });
  expect(damage.deaths).toEqual([f.seer]);
  expect(damage.deathSources[f.seer]).toEqual([DeathCause.EvilKnightReflection]);
});
