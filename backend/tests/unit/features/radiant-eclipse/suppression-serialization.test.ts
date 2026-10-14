/**
 * 单元测试：验证明辉／黯月抑制序列化边界边界。
 * 输入为原内存 fixture、callback 和显式非法变更；引用、状态、错误与字面预期是独立 oracle。
 * 实际原生 owner/frame/readers 仍按原顺序执行，use/install 入口只随实际实例 owner 迁移。
 * 不运行完整对局、模型或物理传输，不重建 fixture、矩阵或生产生成的预期。
 */
import { createAliveComponent } from "../../../../src/game/observation/component-presentation";
import { expect, test } from "bun:test";
import { World } from "../../../../src/core/domain/world";
import { Role, Camp } from "../../../../src/core/domain/identity";
import { COMPONENT } from "../../../../src/core/domain/components/names";
import { createRoleComponent } from "../../../../src/game/observation/role-presentation";

import { findNightAbility } from "../../../../src/game/mechanisms/roles/abilities";
import { installNativeAbility } from "../../../../src/game/mechanisms/roles/ability_changes";
import {
  openEclipseSuppression,
  type SuppressibleAbility,
} from "../../../../src/game/mechanisms/roles/radiant_eclipse/suppression";
function fixture() {
  const world = new World(),
    actorId = world.createEntity();
  const role = createRoleComponent(Role.Seer),
    life = createAliveComponent();
  world.addComponent(actorId, COMPONENT.Role, role);
  world.addComponent(actorId, COMPONENT.Camp, { camp: Camp.Good });
  world.addComponent(actorId, COMPONENT.Alive, life);
  world.addComponent(actorId, COMPONENT.Identity, {
    id: actorId,
    seat: 1,
    name: "independent",
    sessionId: "synthetic",
  });
  installNativeAbility(role, "seer_check", { lastTarget: null, lastIsWerewolf: null, history: [] });
  return {
    world,
    actorId,
    role,
    life,
    ability: findNightAbility(role, "seer_check")! as SuppressibleAbility,
  };
}
test("capture refuses replaced original-life getter without calling it or installing a marker", () => {
  const f = fixture();
  let calls = 0;
  Object.defineProperty(f.life, "alive", {
    configurable: true,
    enumerable: true,
    get() {
      calls++;
      return true;
    },
    set() {},
  });
  let thrown = false;
  try {
    openEclipseSuppression(f.world, f.actorId, f.ability, 2);
  } catch {
    thrown = true;
  }
  expect({ thrown, calls, marker: f.ability.nightSuppression }).toEqual({
    thrown: true,
    calls: 0,
    marker: undefined,
  });
});
test("marker attribute drift cannot stay current when serialization loses the policy", () => {
  const f = fixture(),
    scope = openEclipseSuppression(f.world, f.actorId, f.ability, 2);
  Object.defineProperty(scope.marker, "policy", { enumerable: false });
  expect(JSON.parse(JSON.stringify(f.ability)).nightSuppression).toEqual({ day: 2 });
  expect(scope.isCurrent()).toBe(false);
});
test("ability suppression attribute drift cannot stay current when serialization loses the marker", () => {
  const f = fixture(),
    scope = openEclipseSuppression(f.world, f.actorId, f.ability, 2);
  Object.defineProperty(f.ability, "nightSuppression", { enumerable: false });
  expect(JSON.parse(JSON.stringify(f.ability)).nightSuppression).toBeUndefined();
  expect(scope.isCurrent()).toBe(false);
});
test("capture cannot invoke an inherited marker setter or alter persistent disabled", () => {
  const f = fixture();
  let calls = 0;
  Object.setPrototypeOf(f.ability, {
    set nightSuppression(_value: unknown) {
      calls++;
      (f.ability as { disabled: boolean }).disabled = true;
    },
  });
  let thrown = false;
  try {
    openEclipseSuppression(f.world, f.actorId, f.ability, 2);
  } catch {
    thrown = true;
  }
  expect({ calls, disabled: f.ability.disabled, thrown }).toEqual({
    calls: 0,
    disabled: false,
    thrown: true,
  });
});
test("a normal blocker remains serializable, owns cleanup after a field edit, and preserves permanent disabled", () => {
  const f = fixture(),
    scope = openEclipseSuppression(f.world, f.actorId, f.ability, 2);
  expect(scope.isCurrent()).toBe(true);
  expect(JSON.parse(JSON.stringify(f.ability)).nightSuppression).toEqual({
    policy: "awa_radiant_eclipse_v1",
    day: 2,
  });
  (scope.marker as { day: number }).day = 3;
  (f.ability as { disabled: boolean }).disabled = true;
  expect(scope.isCurrent()).toBe(false);
  expect(scope.close()).toBe(true);
  expect(f.ability.disabled).toBe(true);
  expect(f.ability.nightSuppression).toBeUndefined();
});
