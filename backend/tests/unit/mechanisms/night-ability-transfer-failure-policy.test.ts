/**
 * 单元测试：负责 F03 转移的真实库存接受边界和源先退休后的数据安装失败。
 * 输入为实际 World、字面守卫资源、共享／访问器／Proxy 槽及冻结空目标字典；输出为手写错误、引用、计数与事件前缀。
 * 只调用实际授予／转移 owner；不推进阶段、模型或整局，不复制实现作为 oracle。
 * 非法预存别名只拒绝本次命令、不修复旧数据；目标安装失败不退款，持有裸实例不等于仍在有效库存。
 */
import { expect, test } from "bun:test";
import { Camp, Role } from "@ai-werewolf-arena/game-contract";
import { World } from "../../../src/core/domain/world";
import { COMPONENT } from "../../../src/core/domain/components/names";
import { createRoleComponent } from "../../../src/core/domain/components/role";
import { createAliveComponent } from "../../../src/core/domain/components/alive";
import type { GameEvent } from "../../../src/core/domain/events";
import {
  allNightAbilities, activeNightAbility, findNightAbility,
  type NightAbilityReadView,
} from "../../../src/game/mechanisms/roles/abilities";
import { grantNightAbility, transferNightAbility } from "../../../src/game/mechanisms/roles/night-ability-grants";

function fixture() {
  const world = new World(), origin = world.createEntity(), from = world.createEntity(), to = world.createEntity();
  const sourceRole = createRoleComponent(Role.Villager), targetRole = createRoleComponent(Role.Villager);
  for (const [id, role] of [[origin, createRoleComponent(Role.Guard)], [from, sourceRole], [to, targetRole]] as const) {
    world.addComponent(id, COMPONENT.Role, role);
    world.addComponent(id, COMPONENT.Camp, { camp: Camp.Good });
    world.addComponent(id, COMPONENT.Alive, createAliveComponent());
  }
  const events: GameEvent[] = [];
  const original = grantNightAbility(world, from, {
    id: "gift:bounded", kind: "guard", state: { lastTarget: null },
    source: { kind: "gift", actorId: origin }, startsOnDay: 2, maxUses: 2,
  }, events);
  const sourcePrivate = sourceRole.privateState as { abilities: Record<string, NightAbilityReadView>; retiredAbilityIds?: string[] };
  return { world, origin, from, to, sourceRole, targetRole, sourcePrivate, stored: sourcePrivate.abilities, original, events };
}

function transfer(f: ReturnType<typeof fixture>, trace: string[]) {
  transferNightAbility(f.world, f.from, f.to, f.original.id, "transfer:bounded", f.events, {
    kind: "guard", statePolicy(state) { trace.push("policy"); return { ...state }; },
  });
}

test("F03 rejects aliased roles, private containers and dictionaries without owned writes", () => {
  // 三个输入分别覆盖实际 Role、privateState 和 abilities 身份；非法旧库存不被测试当作合法唯一来源。
  for (const alias of ["role", "private", "dictionary"] as const) {
    const f = fixture(), trace: string[] = [];
    if (alias === "role") f.world.addComponent(f.to, COMPONENT.Role, f.sourceRole);
    if (alias === "private") Object.defineProperty(f.targetRole, "privateState", { value: f.sourcePrivate });
    if (alias === "dictionary") Object.defineProperty(f.targetRole.privateState, "abilities", { value: f.stored });
    expect(() => transfer(f, trace)).toThrow("ability_transfer_inventory_alias");
    expect(trace).toEqual(["policy"]);
    expect(Object.keys(f.stored)).toEqual(["gift:bounded"]);
    expect(f.stored["gift:bounded"]).toBe(f.original);
    expect(f.original).toMatchObject({ uses: 0, lastUsedDay: null, maxUses: 2, disabled: false });
    expect(Object.hasOwn(f.sourcePrivate, "retiredAbilityIds")).toBe(false);
    expect(f.events.map((e) => e.type === "ability_changed" ? [e.payload.actorId, e.payload.operation] : e.type)).toEqual([[f.from, "granted"]]);
  }
});

test("F03 rejects actual source-key mismatch, local aliases and unstable inventory paths before data writes", () => {
  for (const input of ["wrong-key", "local-alias", "alternating-getter", "dictionary-proxy"] as const) {
    const f = fixture(), trace: string[] = [];
    if (input === "wrong-key") { delete f.stored["gift:bounded"]; f.stored.shadow = f.original; }
    if (input === "local-alias") f.stored.shadow = f.original;
    if (input === "alternating-getter") {
      let reads = 0;
      Object.defineProperty(f.sourcePrivate, "abilities", { get() { reads++; return reads % 2 ? f.stored : { ...f.stored }; } });
    }
    if (input === "dictionary-proxy") f.sourcePrivate.abilities = new Proxy(f.stored, {});
    const keys = Object.keys(f.stored);
    expect(() => transfer(f, trace)).toThrow(input === "wrong-key" || input === "local-alias" ? "ability_transfer_source_slot_invalid" : "ability_transfer_inventory_invalid");
    expect(trace).toEqual(["policy"]);
    expect(Object.keys(f.stored)).toEqual(keys);
    expect(Object.values(f.stored).every((ability) => ability === f.original)).toBe(true);
    expect(Object.hasOwn(f.sourcePrivate, "retiredAbilityIds")).toBe(false);
    expect(Object.hasOwn(f.targetRole.privateState, "abilities")).toBe(false);
    expect(f.events).toHaveLength(1);
  }
});

test("F03 target installation failure leaves the source retired and no effective target", () => {
  const f = fixture(), trace: string[] = [], targetStored = Object.freeze({});
  Object.defineProperty(f.targetRole.privateState, "abilities", { value: targetStored });
  // 冻结字典仍是普通 data 输入；失败发生在源 delete／退休之后的实际赋值，不能提前改成预检拒绝。
  expect(() => transfer(f, trace)).toThrow(TypeError);
  expect(trace).toEqual(["policy"]);
  expect(f.sourcePrivate.retiredAbilityIds).toEqual(["gift:bounded"]);
  expect(allNightAbilities(f.sourceRole)).toEqual([]);
  expect(findNightAbility(f.sourceRole, "guard", "gift:bounded")).toBeUndefined();
  expect(activeNightAbility(f.sourceRole, "guard", 2)).toBeUndefined();
  expect(allNightAbilities(f.targetRole)).toEqual([]);
  expect(activeNightAbility(f.targetRole, "guard", 2)).toBeUndefined();
  expect((f.targetRole.privateState as { abilities: object }).abilities).toBe(targetStored);
  expect(f.original).toMatchObject({ uses: 0, lastUsedDay: null, maxUses: 2, startsOnDay: 2, disabled: false, state: { lastTarget: null } });
  expect(f.events.map((e) => e.type === "ability_changed" ? [e.payload.actorId, e.payload.operation] : e.type)).toEqual([[f.from, "granted"]]);
});
