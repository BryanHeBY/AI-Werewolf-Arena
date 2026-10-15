/**
 * 单元测试：验证 F05a 身份失败永久退休在真实夜能力／赠枪命令的拒绝与已付数据边界。
 * 输入是字面角色、原库存、实际政策／容器 getter 和对象退休；预期用手写事件、引用、错误与写入前缀。
 * 只执行三个资源 owner，不跑模型、整局或旧绿色；纯 body/source/life、已消费提案与清理不冒新行动许可。
 */
import { expect, test } from "bun:test";
import { Camp, Role, type GameEvent } from "@ai-werewolf-arena/game-contract";
import { World } from "../../../src/domain/world";
import { COMPONENT } from "../../../src/domain/components/names";
import { createRoleComponent } from "../../../src/domain/components/role";
import { createAliveComponent } from "../../../src/domain/components/alive";
import {
  retireRoleExecution,
  isRoleExecutionRetired,
} from "../../../src/domain/role-execution-authority";
import {
  allNightAbilities,
  findNightAbility,
  activeNightAbility,
  abilityStatus,
  type NightAbilityReadView,
} from "../../../src/features/night-abilities/abilities";
import {
  grantNightAbility,
  transferNightAbility,
} from "../../../src/features/night-abilities/night-ability-grants";
import {
  allDeathGuns,
  findDeathGun,
  grantDeathGun,
  armDeathGun,
  activeDeathGun,
  deathGunOwnerCurrent,
  captureDeathGun,
  firstDeathGuns,
  finishDeathGuns,
  transferDeathGun,
  consumeDeathGunShot,
  setDeathGunEnabled,
} from "../../../src/features/death-actions/death-gun-lifecycle";

function fixture() {
  const world = new World(),
    ids = [world.createEntity(), world.createEntity(), world.createEntity()];
  const origin = ids[0]!,
    holder = ids[1]!,
    target = ids[2]!;
  const originRole = createRoleComponent(Role.Guard),
    holderRole = createRoleComponent(Role.Villager),
    targetRole = createRoleComponent(Role.Villager);
  for (const [id, role] of [
    [origin, originRole],
    [holder, holderRole],
    [target, targetRole],
  ] as const) {
    world.addComponent(id, COMPONENT.Role, role);
    world.addComponent(id, COMPONENT.Camp, { camp: Camp.Good });
    world.addComponent(id, COMPONENT.Alive, createAliveComponent());
  }
  return {
    world,
    origin,
    holder,
    target,
    originRole,
    holderRole,
    targetRole,
    events: [] as GameEvent[],
  };
}
function grant(f: ReturnType<typeof fixture>) {
  return grantNightAbility(
    f.world,
    f.holder,
    {
      id: "gift:retirement",
      kind: "guard",
      state: { lastTarget: null },
      source: { kind: "gift", actorId: f.origin },
      startsOnDay: 2,
      maxUses: 2,
    },
    f.events,
  );
}
function transfer(
  f: ReturnType<typeof fixture>,
  policy: (state: Readonly<{ lastTarget: number | null }>) => { lastTarget: number | null },
) {
  transferNightAbility(
    f.world,
    f.holder,
    f.target,
    "gift:retirement",
    "transfer:retirement",
    f.events,
    { kind: "guard", statePolicy: policy },
  );
}
function nightEvents(events: GameEvent[]) {
  return events.map((e) =>
    e.type === "ability_changed" ? [e.payload.actorId, e.payload.operation] : e.type,
  );
}

test("F05a night grant rejects retired captured endpoints while data reads and paid gifts remain", () => {
  for (const endpoint of ["source", "target"] as const) {
    const f = fixture(),
      retired = endpoint === "source" ? f.originRole : f.holderRole;
    Object.freeze(retired);
    retireRoleExecution(retired);
    retireRoleExecution(retired);
    expect(() => grant(f)).toThrow("ability_actor_execution_retired");
    expect(f.events).toEqual([]);
    expect(allNightAbilities(f.holderRole)).toEqual([]);
    expect(Object.hasOwn(f.holderRole.privateState, "abilities")).toBe(false);
    expect(f.world.getComponent(endpoint === "source" ? f.origin : f.holder, COMPONENT.Role)).toBe(
      retired,
    );
  }
  const f = fixture(),
    ability = grant(f);
  retireRoleExecution(f.originRole);
  expect(activeNightAbility(f.holderRole, "guard", 2)).toBe(ability);
  retireRoleExecution(f.holderRole);
  f.world.getComponent(f.holder, COMPONENT.Camp)!.camp = Camp.Wolf;
  f.world.getComponent(f.holder, COMPONENT.Camp)!.camp = Camp.Good;
  expect(isRoleExecutionRetired(f.holderRole)).toBe(true);
  expect(findNightAbility(f.holderRole, "guard", "gift:retirement")).toBe(ability);
  expect(allNightAbilities(f.holderRole)).toEqual([ability]);
  expect(abilityStatus(ability, 2)).toBe("active");
  expect(activeNightAbility(f.holderRole, "guard", 2)).toBeUndefined();
  const other = new World(),
    alias = other.createEntity();
  other.addComponent(alias, COMPONENT.Role, f.holderRole);
  other.addComponent(alias, COMPONENT.Camp, { camp: Camp.Good });
  expect(allNightAbilities(other.getComponent(alias, COMPONENT.Role))).toEqual([ability]);
  expect(activeNightAbility(other.getComponent(alias, COMPONENT.Role), "guard", 2)).toBeUndefined();
});

test("F05a transfer rechecks policy-retired source and target before any owned write", () => {
  for (const endpoint of ["source", "target"] as const) {
    const f = fixture(),
      original = grant(f),
      trace: string[] = [];
    expect(() =>
      transfer(f, (state) => {
        trace.push("policy");
        retireRoleExecution(endpoint === "source" ? f.holderRole : f.targetRole);
        return { lastTarget: state.lastTarget };
      }),
    ).toThrow("ability_actor_execution_retired");
    expect(trace).toEqual(["policy"]);
    expect(findNightAbility(f.holderRole, "guard", "gift:retirement")).toBe(original);
    expect(allNightAbilities(f.targetRole)).toEqual([]);
    expect(Object.hasOwn(f.holderRole.privateState, "retiredAbilityIds")).toBe(false);
    expect(Object.hasOwn(f.targetRole.privateState, "abilities")).toBe(false);
    expect(original).toMatchObject({ uses: 0, lastUsedDay: null, disabled: false, startsOnDay: 2 });
    expect(nightEvents(f.events)).toEqual([[f.holder, "granted"]]);
  }
});

test("F05a late target retirement retains the source deletion and ID prefix without target installation", () => {
  const f = fixture(),
    original = grant(f),
    trace: string[] = [],
    retiredIds: string[] = [];
  const sourcePrivate = f.holderRole.privateState as {
    abilities: Record<string, NightAbilityReadView>;
  };
  Object.defineProperty(sourcePrivate, "retiredAbilityIds", {
    configurable: true,
    get() {
      trace.push("retired-list");
      retireRoleExecution(f.targetRole);
      return retiredIds;
    },
  });
  expect(() =>
    transfer(f, (state) => {
      trace.push("policy");
      return { ...state };
    }),
  ).toThrow("ability_transfer_owner_revoked");
  expect(trace).toEqual(["policy", "retired-list"]);
  expect(Object.keys(sourcePrivate.abilities)).toEqual([]);
  expect(retiredIds).toEqual(["gift:retirement"]);
  expect(Object.hasOwn(f.targetRole.privateState, "abilities")).toBe(false);
  expect(original).toMatchObject({ uses: 0, lastUsedDay: null, disabled: false });
  expect(activeNightAbility(f.holderRole, "guard", 2)).toBeUndefined();
  expect(nightEvents(f.events)).toEqual([[f.holder, "granted"]]);
});

test("F05a gifted gun retirement denies fresh execution but preserves consumed proposal identity and cleanup", () => {
  const f = fixture(),
    gun = grantDeathGun(f.world, f.origin, f.holder, 1, f.events);
  armDeathGun(f.world, f.holder, gun, 1, f.events);
  retireRoleExecution(f.originRole);
  expect(activeDeathGun(f.world, f.holder, gun.id, 1)).toBe(gun);
  f.world.getComponent(f.holder, COMPONENT.Alive)!.alive = false;
  const captured = captureDeathGun(f.world, f.holder, gun, 1, () => true);
  expect(captured.isEligible()).toBe(true);
  retireRoleExecution(f.holderRole);
  expect(deathGunOwnerCurrent(f.world, f.holder, gun, true)).toBe(true);
  expect(captured.isCurrent()).toBe(true);
  expect(captured.isEligible()).toBe(false);
  expect(activeDeathGun(f.world, f.holder, gun.id, 1, true)).toBeUndefined();
  expect(findDeathGun(f.holderRole, gun.id)).toBe(gun);
  expect(() => setDeathGunEnabled(f.world, f.holder, gun.id, false, f.events)).toThrow(
    "death_ability_instance_unavailable",
  );
  // 死后 metadata 启停原 ownerCurrent(false) 本来拒绝；已付证明只用明确 onDeath 的纯谓词。
  consumeDeathGunShot(gun);
  expect(gun.remaining).toBe(0);
  expect(captured.isCurrent()).toBe(true);
  const rows = firstDeathGuns(f.world, f.holder);
  expect(rows.map((row) => row.gun)).toEqual([gun]);
  finishDeathGuns(rows, f.events);
  expect(allDeathGuns(f.holderRole)).toEqual([gun]);
  expect(gun).toMatchObject({ remaining: 0, disabled: true, deathExpired: true });
});

test("F05a gift-gun endpoints and late binding getter cannot install a new gun after retirement", () => {
  for (const endpoint of ["source", "target"] as const) {
    const f = fixture();
    retireRoleExecution(endpoint === "source" ? f.originRole : f.holderRole);
    expect(() => grantDeathGun(f.world, f.origin, f.holder, 1, f.events)).toThrow(
      "death_ability_grant_invalid",
    );
    expect(f.events).toEqual([]);
    expect(allDeathGuns(f.holderRole)).toEqual([]);
  }
  for (const endpoint of ["source", "target"] as const) {
    const f = fixture(),
      gun = grantDeathGun(f.world, f.origin, f.holder, 1, f.events);
    retireRoleExecution(endpoint === "source" ? f.holderRole : f.targetRole);
    expect(() => transferDeathGun(f.world, f.holder, f.target, gun.id, f.events)).toThrow(
      "death_ability_transfer_invalid",
    );
    expect(findDeathGun(f.holderRole, gun.id)).toBe(gun);
    expect(allDeathGuns(f.targetRole)).toEqual([]);
    expect(f.events).toHaveLength(1);
    if (endpoint === "source") {
      setDeathGunEnabled(f.world, f.holder, gun.id, false, f.events);
      setDeathGunEnabled(f.world, f.holder, gun.id, true, f.events);
      expect(gun.disabled).toBe(false);
      expect(activeDeathGun(f.world, f.holder, gun.id, 1)).toBeUndefined();
    }
  }
  const f = fixture(),
    originalPrivate = f.holderRole.privateState,
    trace: string[] = [];
  Object.defineProperty(f.holderRole, "privateState", {
    get() {
      trace.push("target-private");
      if (trace.length === 3) retireRoleExecution(f.originRole);
      return originalPrivate;
    },
  });
  // 原第三次读在 bind 的 owner 数据形成；证明已建立后仍须拒目标库存和计数写入。
  expect(() => grantDeathGun(f.world, f.origin, f.holder, 1, f.events)).toThrow(
    "death_ability_grant_invalid",
  );
  expect(trace).toEqual(["target-private", "target-private", "target-private"]);
  expect(Object.hasOwn(originalPrivate, "deathAbilities")).toBe(false);
  expect(f.events).toEqual([]);
  f.world.addComponent(f.origin, COMPONENT.Role, createRoleComponent(Role.Guard));
  f.world.addComponent(f.origin, COMPONENT.Camp, { camp: Camp.Good });
  const first = grantDeathGun(f.world, f.origin, f.target, 1, f.events);
  expect(first.id).toBe("gift-gun:1");
});
