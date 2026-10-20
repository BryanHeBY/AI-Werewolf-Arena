/**
 * 单元测试负责查验输入的实际 Camp、资料初值与运行标签边界。输入为真实 World 和公开 flat Catalog，
 * 手写 null／结果／getter 顺序及同 Error 是预期；身份查验仍保原 camp 读取前缀，标签不授行动许可。
 * 只执行纯查验查询，不初始化角色、推进窗口或调用模型；探针只附在本案例 World，不改全局登记或生产函数。
 */
import { expect, test } from "bun:test";
import { COMPONENT } from "../../../../src/domain/components/names";
import type { CampComponent } from "../../../../src/domain/components/camp";
import { Camp, Role } from "../../../../src/domain/identity";
import { World } from "../../../../src/domain/world";
import type { RoleProfile } from "../../../../src/rulesets/roles/contracts";
import { createRoleCatalog } from "../../../../src/rulesets/roles/role-catalog-assembly";
import { resolveInspection } from "../../../../src/engine/inspection";

/** 资料刻意声明 Wolf，当前 Camp 必须独立装入 World；getter 是原普通读取宽度的真实输入。 */
function fixture(labels: RoleProfile["inspectionLabels"], trace: string[]) {
  const world = new World(),
    targetId = world.createEntity();
  world.addComponent(targetId, COMPONENT.Role, {
    get role() {
      trace.push("target-role");
      return Role.Villager;
    },
    privateState: {},
  });
  const profile: RoleProfile = {
    role: Role.Villager,
    camp: Camp.Wolf,
    label: "literal metadata",
    skillBrief: "literal rules",
    get inspectionLabels() {
      trace.push("labels");
      return labels;
    },
  };
  const catalog = createRoleCatalog([profile]),
    get = world.getComponent;
  world.getComponent = new Proxy(get, {
    apply(target, receiver, args) {
      if (args[1] === COMPONENT.Role) trace.push("World.Role");
      if (args[1] === COMPONENT.Camp) trace.push("World.Camp");
      return Reflect.apply(target, receiver, args);
    },
  });
  return { world, targetId, catalog };
}

test("Camp and combined inspection do not fall back to metadata when the actual Camp is missing", () => {
  const trace: string[] = [],
    f = fixture(undefined, trace);
  expect(f.catalog.getCamp(Role.Villager)).toBe(Camp.Wolf);
  expect(resolveInspection(f.world, f.targetId, "camp", f.catalog)).toBeNull();
  expect(resolveInspection(f.world, f.targetId, "combined", f.catalog)).toBeNull();
  // 身份结果不要求 Camp 存在；它仍先读取原两个字段，再按 kind 返回当前角色标签。
  expect(resolveInspection(f.world, f.targetId, "role", f.catalog)).toEqual({
    kind: "role",
    role: "villager",
  });
  expect(f.world.getComponent(f.targetId, COMPONENT.Camp)).toBeUndefined();
});

test("role-only inspection keeps label Camp then World Camp then role label reads and the same source error", () => {
  const trace: string[] = [],
    error = new Error("literal_inspection_camp_source_failure");
  let fail = false;
  const labels = {
    get camp() {
      trace.push("label-camp");
      return undefined;
    },
    get role() {
      trace.push("label-role");
      return Role.Seer;
    },
  };
  const f = fixture(labels, trace);
  const actualCamp: CampComponent = {
    get camp() {
      trace.push("camp-value");
      if (fail) throw error;
      return Camp.Good;
    },
  };
  f.world.addComponent(f.targetId, COMPONENT.Camp, actualCamp);
  expect(resolveInspection(f.world, f.targetId, "role", f.catalog)).toEqual({
    kind: "role",
    role: "seer",
  });
  expect(trace).toEqual([
    "World.Role",
    "target-role",
    "labels",
    "label-camp",
    "World.Camp",
    "camp-value",
    "label-role",
  ]);
  trace.length = 0;
  fail = true;
  let caught: unknown;
  try {
    resolveInspection(f.world, f.targetId, "role", f.catalog);
  } catch (failure) {
    caught = failure;
  }
  // 即使只请求身份，原 Camp 前缀抛错也不会跳到 role getter，错误对象不被包装。
  expect(caught).toBe(error);
  expect(trace).toEqual([
    "World.Role",
    "target-role",
    "labels",
    "label-camp",
    "World.Camp",
    "camp-value",
  ]);
});

test("an explicit runtime Camp label still short circuits the actual World Camp lookup", () => {
  const trace: string[] = [];
  const labels = {
    get camp() {
      trace.push("label-camp");
      return Camp.Good;
    },
    get role() {
      trace.push("label-role");
      return Role.Seer;
    },
  };
  const f = fixture(labels, trace),
    get = f.world.getComponent;
  f.world.getComponent = new Proxy(get, {
    apply(target, receiver, args) {
      if (args[1] === COMPONENT.Camp) throw new Error("literal_unused_world_camp_query");
      return Reflect.apply(target, receiver, args);
    },
  });
  expect(resolveInspection(f.world, f.targetId, "combined", f.catalog)).toEqual({
    kind: "combined",
    camp: "good",
    role: "seer",
  });
  expect(trace).toEqual(["World.Role", "target-role", "labels", "label-camp", "label-role"]);
});
