/**
 * 单元测试：验证机械狼的独立继承契约及原 owner／frame／reader。输入为内存 fixture、受控回调与畸形修改；原字面值、身份快照和拒绝断言为预期，不执行装配周期、模型或实体传输。
 */
import { createAliveComponent } from "../../../../src/agents/observation/component-presentation";
import { expect, test } from "bun:test";
import { COMPONENT } from "../../../../src/domain/components/names";

import { createRoleComponent } from "../../../../src/agents/observation/role-presentation";
import { Camp, Role } from "../../../../src/domain/model";
import { World } from "../../../../src/domain/world";
import {
  canMechanicalKnife,
  refreshMechanicalInheritance,
} from "../../../../src/features/mechanical-wolf/inheritance";
import {
  captureMechanicalOwner,
  recordMechanicalModeScope,
} from "../../../../src/features/mechanical-wolf/night-scope";
import {
  freshMechanicalState,
  selectMechanicalMode,
  setMechanicalState,
} from "../../../../src/features/mechanical-wolf/state";

function fixture(otherWolves = 1) {
  const world = new World(),
    actor = world.createEntity();
  const role = createRoleComponent(Role.MechanicalWolf),
    life = createAliveComponent();
  world.addComponent(actor, COMPONENT.Role, role);
  world.addComponent(actor, COMPONENT.Camp, { camp: Camp.Wolf });
  world.addComponent(actor, COMPONENT.Alive, life);
  const state = setMechanicalState(role, freshMechanicalState());
  const others = Array.from({ length: otherWolves }, () => {
    const id = world.createEntity(),
      alive = createAliveComponent();
    world.addComponent(id, COMPONENT.Role, createRoleComponent(Role.WolfKing));
    world.addComponent(id, COMPONENT.Camp, { camp: Camp.Wolf });
    world.addComponent(id, COMPONENT.Alive, alive);
    return alive;
  });
  const chooseMode = (day: number, mode: "skill" | "kill") => {
    selectMechanicalMode(state, day, mode);
    recordMechanicalModeScope(
      world,
      captureMechanicalOwner(world, actor, () => true)!,
      day,
    );
  };
  return { world, actor, role, life, state, others, chooseMode };
}

test("only assembly or actual complete death commit can acquire the sole-true-Wolf knife fact", () => {
  const f = fixture(),
    before = JSON.stringify(f.state);
  f.chooseMode(2, "kill");
  expect(refreshMechanicalInheritance(f.world, 1)).toEqual([]);
  expect(canMechanicalKnife(f.role, f.world, () => f.world.getComponent(f.actor, COMPONENT.Camp))).toBe(false);
  expect(f.state.hasInheritedKnife).toBe(false);
  // 控制器先提交死亡，再调用实际死亡刷新。
  f.others[0]!.alive = false;
  for (let i = 0; i < 3; i++) expect(canMechanicalKnife(f.role, f.world, () => f.world.getComponent(f.actor, COMPONENT.Camp))).toBe(false);
  expect(f.state.hasInheritedKnife).toBe(false);
  expect(refreshMechanicalInheritance(f.world, 2)).toEqual([
    { actorId: f.actor, day: 2, firstKnifeNight: 3 },
  ]);
  expect(canMechanicalKnife(f.role, f.world, () => f.world.getComponent(f.actor, COMPONENT.Camp))).toBe(false);
  f.chooseMode(3, "kill");
  expect(canMechanicalKnife(f.role, f.world, () => f.world.getComponent(f.actor, COMPONENT.Camp))).toBe(true);
  expect(refreshMechanicalInheritance(f.world, 3)).toEqual([]);
  expect(JSON.parse(before).hasInheritedKnife).toBe(false);
});

test("no transient inheritance when mechanical and the last other Wolf die in the same marked proposal", () => {
  const f = fixture();
  f.others[0]!.alive = false;
  f.life.alive = false;
  expect(refreshMechanicalInheritance(f.world, 2)).toEqual([]);
  expect(f.state.hasInheritedKnife).toBe(false);
  expect(f.state.firstKnifeNight).toBeNull();
});

test("a fact acquired in an earlier committed proposal survives later death and another Wolf's revival", () => {
  const f = fixture();
  f.others[0]!.alive = false;
  refreshMechanicalInheritance(f.world, 2);
  f.chooseMode(3, "kill");
  expect(canMechanicalKnife(f.role, f.world, () => f.world.getComponent(f.actor, COMPONENT.Camp))).toBe(true);
  f.others[0]!.alive = true;
  expect(canMechanicalKnife(f.role, f.world, () => f.world.getComponent(f.actor, COMPONENT.Camp))).toBe(false);
  expect(refreshMechanicalInheritance(f.world, 7)).toEqual([]);
  f.others[0]!.alive = false;
  expect(f.state.firstKnifeNight).toBe(3);
  f.life.alive = false;
  expect(canMechanicalKnife(f.role, f.world, () => f.world.getComponent(f.actor, COMPONENT.Camp))).toBe(false);
  expect(f.state.hasInheritedKnife).toBe(true);
});

test("a lone mechanical at assembly first attacks on night two, with a live chosen kill mode", () => {
  const f = fixture(0);
  expect(refreshMechanicalInheritance(f.world, 1)).toEqual([
    { actorId: 1, day: 1, firstKnifeNight: 2 },
  ]);
  expect(canMechanicalKnife(f.role, undefined, () => f.world.getComponent(f.actor, COMPONENT.Camp))).toBe(false);
  expect(canMechanicalKnife(f.role, f.world, () => f.world.getComponent(f.actor, COMPONENT.Camp))).toBe(false);
  f.chooseMode(2, "skill");
  expect(canMechanicalKnife(f.role, f.world, () => f.world.getComponent(f.actor, COMPONENT.Camp))).toBe(false);
  f.chooseMode(3, "kill");
  expect(canMechanicalKnife(f.role, f.world, () => f.world.getComponent(f.actor, COMPONENT.Camp))).toBe(true);
});
