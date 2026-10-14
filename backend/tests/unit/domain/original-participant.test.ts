/**
 * 单元测试负责共用参与者的原读取顺序与宽接受规则。输入为原 World／工厂生命和含
 * getter／Proxy／循环私有容器的 Role，字面读取轨迹、引用、拒绝短路和同 Error 为预期。
 * 只核捕获与复验，不运行角色窗口或付款；普通属性读取不等于严格原体 schema 或权限。
 */
import { expect, test } from "bun:test";
import { World } from "../../../src/core/domain/world";
import { COMPONENT } from "../../../src/core/domain/components/names";
import { createAliveComponent } from "../../../src/core/domain/components/alive";
import { createCampComponent } from "../../../src/core/domain/components/camp";
import type { RoleComponent } from "../../../src/core/domain/components/role";
import { Camp, Role } from "../../../src/core/domain/identity";
import {
  captureOriginalParticipant,
  sameOriginalParticipant,
} from "../../../src/core/domain/original-participant";

test("participant keeps getter and Proxy acceptance, original references and a writable snapshot without Camp or JSON inspection", () => {
  const world = new World(), id = world.createEntity(), life = createAliveComponent();
  world.addComponent(id, COMPONENT.Alive, life);
  const reads: string[] = [];
  const state: { cycle?: object } = {};
  state.cycle = state;
  const values = { role: Role.Villager, camp: Camp.Good, state: state as object };
  // 原算法使用普通属性读取；继承 getter 与 Proxy 不被新 owner 改成 descriptor／JSON 拒绝。
  const role = new Proxy(Object.create({
    get role() { reads.push("role"); return values.role; },
    get camp() { reads.push("camp"); return values.camp; },
    get privateState() { reads.push("state"); return values.state; },
  }) as RoleComponent, {});
  world.addComponent(id, COMPONENT.Role, role);
  const original = world.getComponent;
  world.getComponent = new Proxy(original, {
    apply(target, receiver, args) {
      reads.push(String(args[1]));
      return Reflect.apply(target, receiver, args);
    },
  });
  const snapshot = captureOriginalParticipant(world, id)!;
  expect(reads).toEqual(["AliveComponent", "RoleComponent", "role", "camp", "state"]);
  expect(snapshot.role).toBe(role);
  expect(snapshot.state).toBe(state);
  expect(snapshot.life.life).toBe(life);
  expect(Object.isFrozen(snapshot)).toBe(false);
  expect(Object.getOwnPropertyDescriptor(snapshot, "camp")?.writable).toBe(true);
  reads.length = 0;
  expect(sameOriginalParticipant(world, snapshot)).toBe(true);
  expect(reads).toEqual(["AliveComponent", "RoleComponent", "role", "camp", "state"]);
  world.addComponent(id, COMPONENT.Camp, createCampComponent(Camp.ThirdParty));
  expect(sameOriginalParticipant(world, snapshot)).toBe(true);
  values.state = { cycle: state };
  expect(sameOriginalParticipant(world, snapshot)).toBe(false);
  values.state = state;
  expect(sameOriginalParticipant(world, snapshot)).toBe(true);
  snapshot.roleId = Role.Wolf;
  expect(sameOriginalParticipant(world, snapshot)).toBe(false);
  snapshot.roleId = Role.Villager;
  expect(sameOriginalParticipant(world, snapshot)).toBe(true);
  world.getComponent = original;
});

test("capture retains Role lookup after missing life, original getter errors and life-first recheck short circuit", () => {
  const world = new World(), id = world.createEntity(), reads: string[] = [];
  const error = new Error("literal_original_participant_role_getter");
  let throws = false;
  const state = {};
  const role = {
    get role() { reads.push("kind"); if (throws) throw error; return Role.Villager; },
    get camp() { reads.push("camp"); return Camp.Good; },
    get privateState() { reads.push("state"); return state; },
  };
  world.addComponent(id, COMPONENT.Role, role);
  const original = world.getComponent;
  world.getComponent = new Proxy(original, {
    apply(target, receiver, args) { reads.push(String(args[1])); return Reflect.apply(target, receiver, args); },
  });
  expect(captureOriginalParticipant(world, id)).toBeNull();
  expect(reads).toEqual(["AliveComponent", "RoleComponent"]);
  const life = createAliveComponent();
  world.addComponent(id, COMPONENT.Alive, life);
  throws = true;
  reads.length = 0;
  let caught: unknown;
  try { captureOriginalParticipant(world, id); } catch (e) { caught = e; }
  expect(caught).toBe(error);
  expect(reads).toEqual(["AliveComponent", "RoleComponent", "kind"]);
  throws = false;
  const snapshot = captureOriginalParticipant(world, id)!;
  life.alive = false;
  throws = true;
  reads.length = 0;
  expect(sameOriginalParticipant(world, snapshot)).toBe(false);
  expect(reads).toEqual(["AliveComponent"]);
  life.alive = true;
  expect(sameOriginalParticipant(world, snapshot)).toBe(false);
  world.getComponent = original;
});
