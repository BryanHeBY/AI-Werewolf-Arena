/**
 * 单元测试：验证幽香幻影双人查验的独立 target scope、原生 frame 与 reader。输入为原内存 fixture、回调控制和畸形修改；原字面值、引用和拒绝断言为预期，不运行装配周期、模型或实体传输。
 */
import { expect, test } from "bun:test";
import { World } from "../../../../src/core/domain/world";
import { createRoleComponent } from "../../../../src/game/observation/role-presentation";
import { createCampComponent } from "../../../../src/core/domain/components/camp";
import {
  createAliveComponent,
  type AliveComponent,
} from "../../../../src/core/domain/components/alive";
import { COMPONENT } from "../../../../src/core/domain/components/names";
import { Role, Camp } from "../../../../src/core/domain/identity";
import {
  capturePairTarget,
  capturedPairContainsWolf,
  pairTargetCurrent,
} from "../../../../src/game/mechanisms/roles/fragrant_pair_seer/target_scope";
function targets() {
  const world = new World();
  for (const camp of [Camp.Good, Camp.Wolf]) {
    const id = world.createEntity();
    world.addComponent(
      id,
      COMPONENT.Role,
      createRoleComponent(camp === Camp.Wolf ? Role.Wolf : Role.Villager, camp),
    );
    world.addComponent(id, COMPONENT.Camp, createCampComponent(camp));
    world.addComponent(id, COMPONENT.Alive, createAliveComponent());
  }
  return { world, scopes: [capturePairTarget(world, 1)!, capturePairTarget(world, 2)!] };
}
test("two original targets yield only one aggregate boolean", () => {
  const { world, scopes } = targets();
  expect(capturedPairContainsWolf(world, scopes)).toBe(true);
  expect(capturedPairContainsWolf(world, [...scopes].reverse())).toBe(true);
  expect(capturedPairContainsWolf(world, [scopes[0]!, scopes[0]!])).toBeNull();
});
for (const changed of ["life", "role", "camp"] as const)
  test(`same-value second target ${changed} replacement revokes whole pair`, () => {
    const { world, scopes } = targets();
    if (changed === "life") world.addComponent(2, COMPONENT.Alive, createAliveComponent(true));
    if (changed === "role")
      world.addComponent(2, COMPONENT.Role, createRoleComponent(Role.Wolf, Camp.Wolf));
    if (changed === "camp") world.addComponent(2, COMPONENT.Camp, createCampComponent(Camp.Wolf));
    expect(pairTargetCurrent(world, scopes[0]!)).toBe(true);
    expect(capturedPairContainsWolf(world, scopes)).toBeNull();
  });
test("same body death and revival revokes target even when currently living", () => {
  const { world, scopes } = targets(),
    life = world.getComponent<AliveComponent>(2, COMPONENT.Alive)!;
  life.alive = false;
  life.alive = true;
  expect(capturedPairContainsWolf(world, scopes)).toBeNull();
});
test("field changes and getters cannot provide new identity or execute while validating", () => {
  const { world, scopes } = targets();
  scopes[1]!.camp.camp = Camp.Good;
  expect(capturedPairContainsWolf(world, scopes)).toBeNull();
  scopes[1]!.camp.camp = Camp.Wolf;
  let reads = 0;
  Object.defineProperty(scopes[1]!.role, "camp", {
    get() {
      reads++;
      return Camp.Wolf;
    },
  });
  expect(capturedPairContainsWolf(world, scopes)).toBeNull();
  expect(capturePairTarget(world, 2)).toBeNull();
  expect(reads).toBe(0);
});
test("a shadow alive getter is rejected without invoking it", () => {
  const { world, scopes } = targets();
  let reads = 0;
  Object.defineProperty(scopes[1]!.life, "alive", {
    get() {
      reads++;
      return true;
    },
  });
  expect(capturedPairContainsWolf(world, scopes)).toBeNull();
  expect(capturePairTarget(world, 2)).toBeNull();
  expect(reads).toBe(0);
});

test("unknown identity cannot become an inspection target", () => {
  const { world, scopes } = targets();
  scopes[1]!.role.role = "unknown" as Role;
  expect(capturePairTarget(world, 2)).toBeNull();
  expect(capturedPairContainsWolf(world, scopes)).toBeNull();
});

test("scope wrapper cannot be rewritten to revive old identity", () => {
  const { world, scopes } = targets(),
    s = scopes[1]!;
  expect(Object.isFrozen(s)).toBe(true);
  s.life.alive = false;
  s.life.alive = true;
  expect(Reflect.set(s, "version", 2)).toBe(false);
  expect(capturedPairContainsWolf(world, scopes)).toBeNull();
  expect(pairTargetCurrent(world, { ...s, version: 2 })).toBe(false);
});
test("array methods or getters cannot bypass the two actual target checks", () => {
  const { world, scopes } = targets();
  scopes[1]!.life.alive = false;
  let calls = 0;
  Object.defineProperty(scopes, "every", {
    value: () => {
      calls++;
      return true;
    },
  });
  Object.defineProperty(scopes, "some", {
    value: () => {
      calls++;
      return true;
    },
  });
  expect(capturedPairContainsWolf(world, scopes)).toBeNull();
  expect(calls).toBe(0);
  const clean = [scopes[0]!, scopes[1]!];
  Object.defineProperty(clean, "1", {
    get() {
      calls++;
      return scopes[1];
    },
  });
  expect(capturedPairContainsWolf(world, clean)).toBeNull();
  expect(calls).toBe(0);
});
