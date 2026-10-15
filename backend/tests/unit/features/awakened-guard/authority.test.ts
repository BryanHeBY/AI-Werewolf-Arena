/**
 * 单元测试负责觉醒守卫周期／边界／付款／已付原体保护。输入为显式World与手写选择，字面状态和盾判定独立。
 * 不调用生产死亡结算生成预期；同周期限制、空单位断连、同步互撤与失败前缀在最小资源边界验证。
 */
import { expect, test } from "bun:test";
import { Role, Camp } from "@ai-werewolf-arena/game-contract";
import { AWAKENED_GUARD_ROLE_ID } from "@ai-werewolf-arena/game-contract/facts/awakened-guard";
import { World } from "../../../../src/domain/world";
import { COMPONENT } from "../../../../src/domain/components/names";
import { createAliveComponent } from "../../../../src/domain/components/alive";
import { createRoleComponent } from "../../../../src/domain/components/role";
import {
  initializeAwakenedGuardState,
  getAwakenedGuardState,
} from "../../../../src/features/awakened-guard/state";
import {
  beginGuardCycle,
  openGuardBoundary,
  guardBoundaryOptions,
  commitGuardChoice,
  shieldForDeath,
  endGuardCycle,
  closeGuardBoundary,
  guardBoundaryCurrent,
} from "../../../../src/features/awakened-guard/authority";
function fixture() {
  const world = new World("en"),
    lives = Array.from({ length: 4 }, (_, i) => {
      const id = world.createEntity(),
        role = createRoleComponent(i === 0 ? (AWAKENED_GUARD_ROLE_ID as Role) : Role.Villager),
        life = createAliveComponent();
      world.addComponent(id, COMPONENT.Role, role);
      world.addComponent(id, COMPONENT.Alive, life);
      world.addComponent(id, COMPONENT.Camp, { camp: Camp.Good });
      if (i === 0) initializeAwakenedGuardState(role, world);
      return life;
    }),
    role = world.getComponent(1, COMPONENT.Role)!;
  return {
    world,
    lives,
    role,
    start: (day: number, night = {}) => beginGuardCycle(world, 1, day, night, () => true),
    scope: (id = 2) => ({ id, life: lives[id - 1]!, version: 0 }),
    state: () => getAwakenedGuardState(role)!,
  };
}
test("one cycle protection covers N+D and many threats; next unit forbids repeat, empty unit breaks it", () => {
  const f = fixture();
  f.start(1);
  const b = openGuardBoundary(f.world, 1, {}, "night")!;
  expect(guardBoundaryOptions(f.world, b)!.targetIds).toEqual([1, 2, 3, 4]);
  expect(commitGuardChoice(f.world, b, { mode: "protect", targetId: 2 }, () => true)).toBe(
    "protected",
  );
  expect(shieldForDeath(f.world, 1, f.scope())).toBe(true);
  expect(shieldForDeath(f.world, 1, f.scope())).toBe(true);
  expect(openGuardBoundary(f.world, 1, {}, "day")).toBeNull();
  f.start(2);
  expect(shieldForDeath(f.world, 1, f.scope())).toBe(false);
  const second = openGuardBoundary(f.world, 2, {}, "night")!;
  expect(guardBoundaryOptions(f.world, second)!.targetIds).toEqual([1, 3, 4]);
  expect(() =>
    commitGuardChoice(f.world, second, { mode: "protect", targetId: 2 }, () => true),
  ).toThrow("awakened_guard_choice_invalid");
  commitGuardChoice(f.world, second, { mode: "pass", targetId: null }, () => true);
  f.start(3);
  const third = openGuardBoundary(f.world, 3, {}, "day")!;
  commitGuardChoice(f.world, third, { mode: "protect", targetId: 2 }, () => true);
  expect(f.state().cycles).toEqual([
    { day: 1, status: "protected", targetId: 2, timing: "night" },
    { day: 2, status: "passed" },
    { day: 3, status: "protected", targetId: 2, timing: "day" },
  ]);
});
test("night wait and day waits never repeat the same boundary; last wait closes as actual unused", () => {
  const f = fixture();
  f.start(1);
  const night = {},
    b = openGuardBoundary(f.world, 1, night, "night")!;
  expect(commitGuardChoice(f.world, b, { mode: "wait", targetId: null }, () => true)).toBe("wait");
  expect(openGuardBoundary(f.world, 1, night, "night")).toBeNull();
  const day = {},
    d = openGuardBoundary(f.world, 1, day, "day")!;
  commitGuardChoice(f.world, d, { mode: "wait", targetId: null }, () => true);
  expect(openGuardBoundary(f.world, 1, day, "day")).toBeNull();
  const last = openGuardBoundary(f.world, 1, {}, "day", true)!;
  expect(commitGuardChoice(f.world, last, { mode: "wait", targetId: null }, () => true)).toBe(
    "unused",
  );
  expect(openGuardBoundary(f.world, 1, {}, "day")).toBeNull();
  expect(f.state().cycles).toEqual([{ day: 1, status: "unused" }]);
});
test.each(["deadline", "target", "actor"] as const)(
  "unpaid %s revocation does not consume or install a shield",
  (mode) => {
    const f = fixture();
    f.start(1);
    const b = openGuardBoundary(f.world, 1, {}, "night")!;
    expect(() =>
      commitGuardChoice(f.world, b, { mode: "protect", targetId: 2 }, () => {
        if (mode === "target") f.world.addComponent(2, COMPONENT.Alive, createAliveComponent());
        if (mode === "actor") f.world.addComponent(1, COMPONENT.Alive, createAliveComponent());
        return mode !== "deadline";
      }),
    ).toThrow("awakened_guard_choice_revoked");
    expect(f.state().cycles).toEqual([{ day: 1, status: "open" }]);
    expect(shieldForDeath(f.world, 1, f.scope())).toBe(false);
    closeGuardBoundary(b);
  },
);
test.each(["role", "private", "life", "death"] as const)(
  "paid protection survives source %s without giving a new owner editing rights",
  (mode) => {
    const f = fixture();
    f.start(1);
    const b = openGuardBoundary(f.world, 1, {}, "night")!;
    commitGuardChoice(f.world, b, { mode: "protect", targetId: 2 }, () => true);
    if (mode === "role")
      f.world.addComponent(1, COMPONENT.Role, createRoleComponent(Role.Villager));
    if (mode === "private")
      Object.defineProperty(f.role, "privateState", {
        value: { awakenedGuard: structuredClone(f.state()) },
      });
    if (mode === "life") f.world.addComponent(1, COMPONENT.Alive, createAliveComponent());
    if (mode === "death") f.lives[0]!.alive = false;
    expect(shieldForDeath(f.world, 1, f.scope())).toBe(true);
    expect(openGuardBoundary(f.world, 1, {}, "day")).toBeNull();
    expect(shieldForDeath(f.world, 1, f.scope(3))).toBe(false);
    endGuardCycle(f.world, 1, true);
    expect(shieldForDeath(f.world, 1, f.scope())).toBe(false);
  },
);
test("target replacement/restore cannot resurrect an observed revoked shield; a new target body never inherits", () => {
  const f = fixture();
  f.start(1);
  const b = openGuardBoundary(f.world, 1, {}, "night")!;
  commitGuardChoice(f.world, b, { mode: "protect", targetId: 2 }, () => true);
  const original = f.lives[1]!,
    newLife = createAliveComponent();
  f.world.addComponent(2, COMPONENT.Alive, newLife);
  expect(shieldForDeath(f.world, 1, { id: 2, life: newLife, version: 0 })).toBe(false);
  f.world.addComponent(2, COMPONENT.Alive, original);
  expect(shieldForDeath(f.world, 1, f.scope())).toBe(false);
});
test("last target query cannot replace the source after external checks and still pay", () => {
  const f = fixture();
  f.start(1);
  const b = openGuardBoundary(f.world, 1, {}, "night")!,
    get = f.world.getComponent.bind(f.world);
  let armed = false,
    swapped = false;
  f.world.getComponent = ((id, name) => {
    const value = get(id, name);
    if (armed && !swapped && id === 2 && name === COMPONENT.Camp) {
      swapped = true;
      f.world.addComponent(1, COMPONENT.Alive, createAliveComponent());
    }
    return value;
  }) as typeof f.world.getComponent;
  expect(() =>
    commitGuardChoice(f.world, b, { mode: "protect", targetId: 2 }, () => {
      armed = true;
      return true;
    }),
  ).toThrow("awakened_guard_choice_revoked");
  expect(swapped).toBe(true);
  expect(f.state().cycles).toEqual([{ day: 1, status: "open" }]);
  expect(shieldForDeath(f.world, 1, f.scope())).toBe(false);
});
test("reentrant choice preserves the inner paid prefix and rejects the outer old snapshot", () => {
  const f = fixture();
  f.start(1);
  const b = openGuardBoundary(f.world, 1, {}, "night")!;
  expect(() =>
    commitGuardChoice(f.world, b, { mode: "protect", targetId: 2 }, () => {
      commitGuardChoice(f.world, b, { mode: "protect", targetId: 3 }, () => true);
      return true;
    }),
  ).toThrow("awakened_guard_choice_revoked");
  expect(f.state().cycles).toEqual([{ day: 1, status: "protected", targetId: 3, timing: "night" }]);
  expect(shieldForDeath(f.world, 1, f.scope(3))).toBe(true);
  expect(shieldForDeath(f.world, 1, f.scope())).toBe(false);
});
test("real cycle identity cannot be replayed for another day; abort is not a normal unused result", () => {
  const f = fixture(),
    night = {};
  f.start(1, night);
  const b = openGuardBoundary(f.world, 1, {}, "night")!;
  expect(() => f.start(2, night)).toThrow("awakened_guard_cycle_invalid");
  endGuardCycle(f.world, 1, false);
  expect(guardBoundaryCurrent(f.world, b)).toBe(false);
  expect(f.state().cycles).toEqual([{ day: 1, status: "open" }]);
});
