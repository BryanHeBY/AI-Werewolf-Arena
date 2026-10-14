/**
 * 单元测试：负责夜能力授予／转移的真实库存引用、晚政策复验和部分失败前缀。
 * 输入为实际 World／原角色、字面资源和受控 getter／发布失败；输出是独立手写的错误、字段和事实顺序。
 * 只调用共同提交 owner，不执行阶段、模型、传输或整局；类型负例核旧命令叶退休，不扩大资源或授权规则。
 */
import { expect, test } from "bun:test";
import { Camp, Role } from "@ai-werewolf-arena/game-contract";
import { World } from "../../../src/core/domain/world";
import { COMPONENT } from "../../../src/core/domain/components/names";
import { createRoleComponent } from "../../../src/core/domain/components/role";
import { createAliveComponent } from "../../../src/core/domain/components/alive";
import type { GameEvent } from "../../../src/core/domain/events";
import { allNightAbilities } from "../../../src/game/mechanisms/roles/abilities";
import { grantNightAbility, transferNightAbility } from "../../../src/game/mechanisms/roles/night-ability-grants";
import * as metadataCommands from "../../../src/game/mechanisms/roles/ability_changes";

function retiredGrantExports() {
  // @ts-expect-error 授予实际算法已退出 metadata 命令叶，无转发桥。
  void metadataCommands.grantNightAbility;
  // @ts-expect-error 完整转移实际算法也不再从旧叶公开。
  void metadataCommands.transferNightAbility;
}
void retiredGrantExports;

function fixture() {
  const world = new World(), origin = world.createEntity(), from = world.createEntity(), to = world.createEntity();
  const originRole = createRoleComponent(Role.Seer, Camp.Good),
    fromRole = createRoleComponent(Role.Villager, Camp.Good),
    toRole = createRoleComponent(Role.Villager, Camp.Good);
  for (const [id, role] of [[origin, originRole], [from, fromRole], [to, toRole]] as const) {
    world.addComponent(id, COMPONENT.Role, role);
    world.addComponent(id, COMPONENT.Alive, createAliveComponent());
  }
  return { world, origin, from, to, fromRole, toRole };
}

function guardGift(f: ReturnType<typeof fixture>, events: GameEvent[]) {
  return grantNightAbility(f.world, f.from, {
    id: "gift:prefix", kind: "guard", state: { lastTarget: null },
    source: { kind: "gift", actorId: f.origin }, startsOnDay: 2, maxUses: 2,
  }, events);
}

// 发布查找是原安装之后的故障点；原实例和字典都已写，尚无事实被追加。
test("grant publication reads push before source and retains the installed instance on source failure", () => {
  const f = fixture(), events: GameEvent[] = [], trace: string[] = [], failure = Error("literal_grant_source_failure");
  Object.defineProperty(events, "push", {
    configurable: true,
    get() {
      trace.push("push:get");
      const installed = allNightAbilities(f.fromRole)[0]!;
      Object.defineProperty(installed, "source", { configurable: true, get() { trace.push("source:get"); throw failure; } });
      return Array.prototype.push;
    },
  });
  expect(() => guardGift(f, events)).toThrow(failure);
  expect(trace).toEqual(["push:get", "source:get"]);
  expect(allNightAbilities(f.fromRole)).toHaveLength(1);
  expect(allNightAbilities(f.fromRole)[0]!.id).toBe("gift:prefix");
  expect(events).toHaveLength(0);
});

test("target publication failure retains both installed target and undeleted original source", () => {
  const f = fixture(), events: GameEvent[] = [], original = guardGift(f, events), failure = Error("literal_target_publication_failure"), trace: string[] = [];
  Object.defineProperty(events, "push", { configurable: true, value(event: GameEvent) {
    trace.push(this === events ? "push:same-array" : "push:wrong-array");
    if (event.type !== "ability_changed") throw Error("unexpected_literal_event");
    trace.push(event.payload.operation);
    throw failure;
  } });
  expect(() => transferNightAbility(f.world, f.from, f.to, original.id, "transfer:prefix", events, {
    kind: "guard", statePolicy: (state) => ({ ...state }),
  })).toThrow(failure);
  expect(trace).toEqual(["push:same-array", "granted"]);
  expect(allNightAbilities(f.fromRole)[0]).toBe(original);
  expect(allNightAbilities(f.toRole)[0]!.id).toBe("transfer:prefix");
  expect(Object.hasOwn(f.fromRole.privateState, "retiredAbilityIds")).toBe(false);
  expect(events.map((event) => event.type === "ability_changed" ? event.payload.operation : event.type)).toEqual(["granted"]);
});

test("retired-id getter failure follows source deletion and retains the target grant fact", () => {
  const f = fixture(), events: GameEvent[] = [], original = guardGift(f, events), failure = Error("literal_retired_id_failure"), trace: string[] = [];
  Object.defineProperty(f.fromRole.privateState, "retiredAbilityIds", { configurable: true, get() { trace.push("retired:get"); throw failure; } });
  expect(() => transferNightAbility(f.world, f.from, f.to, original.id, "transfer:prefix", events, {
    kind: "guard", statePolicy: (state) => ({ ...state }),
  })).toThrow(failure);
  expect(trace).toEqual(["retired:get"]);
  expect(allNightAbilities(f.fromRole)).toEqual([]);
  expect(allNightAbilities(f.toRole)[0]!.source).toEqual({ kind: "transfer", actorId: f.from, abilityId: "gift:prefix" });
  expect(events.map((event) => event.type === "ability_changed" ? [event.payload.actorId, event.payload.operation] : event.type)).toEqual([[f.from, "granted"], [f.to, "granted"]]);
});

test("a late black-market policy replacement revokes transfer before installing another owner", () => {
  const f = fixture(), events: GameEvent[] = [], trace: string[] = [];
  const original = grantNightAbility(f.world, f.from, {
    id: "gift:black-market", kind: "seer_check", activation: "black_market",
    state: { lastTarget: null, lastIsWerewolf: null, lastResult: null, history: [] },
    source: { kind: "gift", actorId: f.origin }, sourceDisclosed: false, startsOnDay: 2, maxUses: 1,
  }, events), source = original.source;
  expect(() => transferNightAbility(f.world, f.from, f.to, original.id, original.id, events, {
    kind: "seer_check", statePolicy(state) {
      trace.push("policy:call");
      Object.defineProperty(original, "source", { value: { kind: "gift", actorId: f.origin }, writable: true, enumerable: true, configurable: true });
      return structuredClone(state);
    },
  })).toThrow("ability_black_market_transfer_revoked");
  expect(trace).toEqual(["policy:call"]);
  expect(allNightAbilities(f.fromRole)[0]).toBe(original);
  expect(original.source).not.toBe(source);
  expect(allNightAbilities(f.toRole)).toEqual([]);
  expect(events).toHaveLength(1);
});
