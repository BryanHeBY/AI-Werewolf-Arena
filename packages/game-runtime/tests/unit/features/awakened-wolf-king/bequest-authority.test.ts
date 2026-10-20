/**
 * 单元测试验证亲传原单位转出、受传原生命绑定与逐夜唯一窗口。
 * 输入为手写有限 World／Catalog 与明确选择；独立字面库存、受众前缀和零授权是预期。
 * 不推进完整 PM／模型；拒绝同号新身体、换私态及非法目标，不靠生产校验函数生成 expected。
 */
import { expect, test } from "bun:test";
import { Camp, Role } from "@ai-werewolf-arena/game-contract";
import { World } from "../../../../src/domain/world";
import { COMPONENT } from "../../../../src/domain/components/names";
import { createAliveComponent } from "../../../../src/domain/components/alive";
import { createRoleComponent } from "../../../../src/domain/components/role";
import { RoleCatalog } from "../../../../src/rulesets/roles/catalog";
import {
  createNativeClaws,
  installAwakenedClaws,
  ownedAwakenedClaws,
  getAwakenedClaws,
  replaceAwakenedClaws,
  nextClawStatus,
} from "../../../../src/features/awakened-wolf-king/state";
import type { NightLifeReadScope } from "../../../../src/domain/night-effects";
import {
  openClawBequest,
  clawBequestCandidates,
  commitClawBequest,
  closeClawBequest,
} from "../../../../src/features/awakened-wolf-king/bequest-authority";
function fixture() {
  const world = new World("en"),
    lives = Array.from({ length: 4 }, (_, index) => {
      const id = world.createEntity(),
        life = createAliveComponent(),
        role = createRoleComponent(
          index === 0 ? Role.AwakenedWolfKing : index === 3 ? Role.Villager : Role.Wolf,
        );
      world.addComponent(id, COMPONENT.Role, role);
      world.addComponent(id, COMPONENT.Alive, life);
      world.addComponent(id, COMPONENT.Camp, { camp: index === 3 ? Camp.Good : Camp.Wolf });
      if (id === 1) installAwakenedClaws(role, createNativeClaws(), world, id);
      return life;
    });
  const catalog = new RoleCatalog(
    [Role.AwakenedWolfKing, Role.Wolf].map((role) => ({
      role,
      camp: Camp.Wolf,
      label: "literal wolf",
      skillBrief: "literal",
      wolfTeam: {
        recognizedByPack: true,
        recognizes: "pack" as const,
        canChat: true,
        canVoteForKill: true,
      },
    })),
    [],
  );
  return {
    world,
    lives,
    catalog,
    stock: (id = 1) => ownedAwakenedClaws(world, id),
    open: (day: number) => openClawBequest(world, 1, day, catalog),
  };
}
test("two original units transfer to distinct live packmates across nights; pass consumes none and same-night reopening fails", () => {
  const f = fixture();
  f.open(1);
  expect(clawBequestCandidates(f.world, 1, 1)).toEqual([2, 3]);
  expect(commitClawBequest(f.world, 1, 1, null, () => true)).toBeNull();
  expect(f.stock()!.units.map((u) => u.status)).toEqual(["ready", "ready"]);
  expect(() => f.open(1)).toThrow("awakened_claw_bequest_unavailable");
  f.open(2);
  expect(commitClawBequest(f.world, 1, 2, 2, () => true)).toEqual({
    unitId: "awakened_claw:native:1",
    receivedUnitId: "awakened_claw:bequest:1:2:1",
  });
  expect(f.stock()!.units.map((u) => u.status)).toEqual(["transferred", "ready"]);
  expect(f.stock(2)!.units.map((u) => u.status)).toEqual(["ready"]);
  f.open(3);
  expect(clawBequestCandidates(f.world, 1, 3)).toEqual([3]);
  expect(() => commitClawBequest(f.world, 1, 3, 2, () => true)).toThrow(
    "awakened_claw_bequest_invalid",
  );
  commitClawBequest(f.world, 1, 3, 3, () => true);
  expect(f.stock()!.units.map((u) => u.status)).toEqual(["transferred", "transferred"]);
  expect(f.stock(3)!.units[0]!.id).toBe("awakened_claw:bequest:1:3:2");
  expect(() => f.open(4)).toThrow("awakened_claw_bequest_unavailable");
});
test.each(["replace", "revive"] as const)(
  "received claw cannot migrate after %s; observed revocation remains closed",
  (mode) => {
    const f = fixture();
    f.open(1);
    commitClawBequest(f.world, 1, 1, 2, () => true);
    const original = f.lives[1]!;
    if (mode === "replace") f.world.addComponent(2, COMPONENT.Alive, createAliveComponent());
    else {
      original.alive = false;
      original.alive = true;
    }
    expect(f.stock(2)).toBeUndefined();
    f.world.addComponent(2, COMPONENT.Alive, original);
    expect(f.stock(2)).toBeUndefined();
    expect(getAwakenedClaws(f.world.getComponent(2, COMPONENT.Role))!.units[0]!.status).toBe(
      "ready",
    );
    expect(f.stock()!.units.map((u) => u.status)).toEqual(["transferred", "ready"]);
  },
);
test("target replacement or late guard failure rejects before donor payment and cannot silently transfer", () => {
  for (const mode of ["target", "guard"] as const) {
    const f = fixture();
    f.open(1);
    if (mode === "target") f.world.addComponent(2, COMPONENT.Alive, createAliveComponent());
    expect(() => commitClawBequest(f.world, 1, 1, 2, () => mode !== "guard")).toThrow();
    expect(f.stock()!.units.map((u) => u.status)).toEqual(["ready", "ready"]);
    expect(getAwakenedClaws(f.world.getComponent(2, COMPONENT.Role))).toBeUndefined();
    closeClawBequest(f.world);
    expect(() => commitClawBequest(f.world, 1, 1, 3, () => true)).toThrow();
  }
});
test("late recipient installation failure retains the transferred donor prefix and does not authorize a recipient", () => {
  const f = fixture();
  f.open(1);
  const recipient = f.world.getComponent(2, COMPONENT.Role)!;
  let checks = 0;
  expect(() =>
    commitClawBequest(f.world, 1, 1, 2, () => {
      checks++;
      if (checks === 2) Object.preventExtensions(recipient.privateState);
      return true;
    }),
  ).toThrow();
  expect(f.stock()!.units.map((u) => u.status)).toEqual(["transferred", "ready"]);
  expect(f.stock(2)).toBeUndefined();
  expect(f.stock()!.bequests).toEqual([{ day: 1, targetId: 2, unitId: "awakened_claw:native:1" }]);
  expect(() => commitClawBequest(f.world, 1, 1, 3, () => true)).toThrow();
});

test("final donor query cannot swap the selected recipient to a new life and authorize that body", () => {
  const f = fixture();
  f.open(1);
  const get = f.world.getComponent.bind(f.world);
  let checks = 0,
    swapped = false;
  expect(() =>
    commitClawBequest(f.world, 1, 1, 2, () => {
      if (++checks === 2)
        f.world.getComponent = ((id, name) => {
          const value = get(id, name);
          if (!swapped && id === 1 && name === COMPONENT.Alive) {
            swapped = true;
            f.world.addComponent(2, COMPONENT.Alive, createAliveComponent());
          }
          return value;
        }) as typeof f.world.getComponent;
      return true;
    }),
  ).toThrow("awakened_claw_bequest_target_stale");
  expect(swapped).toBe(true);
  expect(f.stock()!.units.map((u) => u.status)).toEqual(["ready", "ready"]);
  expect(f.stock(2)).toBeUndefined();
  expect(getAwakenedClaws(get(2, COMPONENT.Role))).toBeUndefined();
});

test("replaced private-state accessor is rejected without executing it; final external guard cannot kill a target then pay", () => {
  const f = fixture();
  f.open(1);
  const recipient = f.world.getComponent(2, COMPONENT.Role)!,
    container = recipient.privateState;
  let reads = 0;
  Object.defineProperty(recipient, "privateState", {
    configurable: true,
    get() {
      reads++;
      f.lives[0]!.alive = false;
      return container;
    },
  });
  expect(() => commitClawBequest(f.world, 1, 1, 2, () => true)).toThrow();
  expect(reads).toBe(0);
  expect(f.lives[0]!.alive).toBe(true);
  expect(f.stock()!.units.map((u) => u.status)).toEqual(["ready", "ready"]);
  const second = fixture();
  second.open(1);
  let checks = 0;
  expect(() =>
    commitClawBequest(second.world, 1, 1, 2, () => {
      checks++;
      if (checks === 2) second.lives[1]!.alive = false;
      return true;
    }),
  ).toThrow();
  expect(second.stock()!.units.map((u) => u.status)).toEqual(["ready", "ready"]);
  expect(getAwakenedClaws(second.world.getComponent(2, COMPONENT.Role))).toBeUndefined();
});

test("stable writer refuses target scope getters without running them or paying", () => {
  const f = fixture(),
    stock = f.stock()!,
    role = f.world.getComponent(1, COMPONENT.Role)!;
  let reads = 0;
  const target = {
    get id() {
      reads++;
      f.world.addComponent(1, COMPONENT.Alive, createAliveComponent());
      return 2;
    },
    life: f.lives[1]!,
    version: 0,
  } as NightLifeReadScope;
  expect(() =>
    replaceAwakenedClaws(role, stock, nextClawStatus(stock, stock.units[0]!.id, "spent"), target),
  ).toThrow("awakened_claw_commit_target_invalid");
  expect(reads).toBe(0);
  expect(f.stock()!.units.map((u) => u.status)).toEqual(["ready", "ready"]);
});
