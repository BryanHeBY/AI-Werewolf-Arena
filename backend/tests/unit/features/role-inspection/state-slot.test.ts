/**
 * 单元测试验证角色查验状态槽的原创建／政策验证、实例引用、两条写入前缀与身份字节。
 * 输入为六种实际原生角色、手写政策／历史、明示 getter 和失败；字面状态、引用与 trace
 * 是预期。只调用有限状态、能力安装与原 scope，不推进完整夜、对局、传输或模型。
 */
import { expect, test } from "bun:test";
import { Camp, Role, type RoleInspectionState, type RoleInspectionReadState } from "@ai-werewolf-arena/game-contract";
import { ROLE_INSPECTION_STATE_SLOT as slot } from "../../../../src/game/mechanisms/roles/role_inspection/state-slot";
import { findNightAbility, type NightAbilityReadView } from "../../../../src/game/mechanisms/roles/abilities";
import { installNativeAbility } from "../../../../src/game/mechanisms/roles/ability_changes";
import { grantNightAbility } from "../../../../src/game/mechanisms/roles/night-ability-grants";
import { captureNightAbilityScope } from "../../../../src/game/mechanisms/roles/ability_scope";
import { createRoleComponent } from "../../../../src/game/observation/role-presentation";
import { createAliveComponent } from "../../../../src/game/observation/component-presentation";
import { World } from "../../../../src/core/domain/world";
import { COMPONENT } from "../../../../src/core/domain/components/names";

const fresh = (policy: RoleInspectionState["policy"] = "psychic"): RoleInspectionState => ({
  policy, lastTarget: null, lastDay: null, history: [],
});

test("slot creation retains legacy extra fields, clone isolation and missing-policy interpretation", () => {
  const input = { lastTarget: null, lastDay: null, history: [], extra: { label: "raw" }, omitted: undefined };
  const owned = slot.create(input);
  expect<unknown>(owned).toEqual({ lastTarget: null, lastDay: null, history: [], extra: { label: "raw" } });
  expect(owned).not.toBe(input);
  expect(owned.history).not.toBe(input.history);
  expect(Object.hasOwn(owned, "policy")).toBe(false);
  expect(slot.schema(owned)).toBe("gargoyle");
  expect(Object.hasOwn(input, "omitted")).toBe(true);
});

test("policy-only schema keeps original getter order and rejects configured policy before role policy", () => {
  const trace: string[] = [];
  const legacy = {
    get inspectionPolicy() { trace.push("configured"); return undefined; },
    get policy() { trace.push("policy"); return undefined; },
    get history() { throw new Error("history_not_in_original_schema"); },
  } as unknown as RoleInspectionReadState;
  expect(slot.schema(legacy)).toBe("gargoyle");
  expect(trace).toEqual(["configured", "policy"]);
  trace.length = 0;
  const denied = {
    get inspectionPolicy() { trace.push("configured"); return "invalid"; },
    get policy() { throw new Error("late_policy_must_not_run"); },
  } as unknown as RoleInspectionReadState;
  expect(() => slot.schema(denied)).toThrow("role_inspection_configuration_policy_invalid");
  expect(trace).toEqual(["configured", "configured"]);
});

test("six implemented native-role paths install one original instance and replace only payload on reapplication", () => {
  const cases = [
    [Role.Gargoyle, "gargoyle"], [Role.Psychic, "psychic"], [Role.MirrorGirl, "mirror"],
    [Role.PureWhiteGirl, "pure_white"], [Role.WolfWitch, "wolf_witch"], [Role.AwakenedHiddenWolf, "gargoyle"],
  ] as const;
  for (const [roleId, policy] of cases) {
    const role = createRoleComponent(roleId), input = fresh(policy);
    const first = slot.install(role, input), ability = findNightAbility(role, "role_check")!;
    expect(ability.id).toBe("native:role_check");
    expect(ability.source).toEqual({ kind: "native", role: roleId });
    expect(ability.state).toBe(first);
    expect(slot.get(role)).toBe(first);
    expect(first).not.toBe(input);
    expect(first.history).not.toBe(input.history);
    const second = slot.install(role, fresh(policy));
    expect(findNightAbility(role, "role_check")).toBe(ability);
    expect(second).not.toBe(first);
    expect(ability.state).toBe(second);
    expect(ability.uses).toBe(0);
  }
});

test("a gifted role-check instance keeps independent knowledge and native selection", () => {
  const world = new World(), id = world.createEntity(), giver = world.createEntity();
  const role = createRoleComponent(Role.Psychic);
  world.addComponent(id, COMPONENT.Role, role);
  world.addComponent(id, COMPONENT.Camp, { camp: Camp.Good });
  world.addComponent(giver, COMPONENT.Role, createRoleComponent(Role.Villager));
  world.addComponent(giver, COMPONENT.Camp, { camp: Camp.Good });
  const native = slot.install(role, fresh());
  const gift = grantNightAbility(world, id, {
    id: "gift:inspection:1", kind: "role_check", state: fresh(),
    source: { kind: "gift", actorId: giver }, startsOnDay: 1, maxUses: 1,
  }, []);
  slot.allowedWrites.appendState(gift.state, giver, 1, { kind: "role", role: "villager" });
  expect(slot.get(role)).toBe(native);
  expect(slot.get(role, "gift:inspection:1")).toBe(gift.state);
  expect(native.history).toEqual([]);
  expect(gift.state.history).toEqual([{ day: 1, targetId: giver, result: { kind: "role", role: "villager" } }]);
  expect(gift.uses).toBe(0);
});

test("ability append preserves three successive state reads and no metadata payment", () => {
  const states = [fresh(), fresh(), fresh()], trace: string[] = [];
  let cursor = 0;
  const ability = {
    get state() { trace.push(`state:${cursor}`); return states[cursor++]; },
  } as unknown as NightAbilityReadView<"role_check">;
  slot.allowedWrites.appendAbility(ability, 3, 2, { kind: "role", role: "seer" });
  expect(trace).toEqual(["state:0", "state:1", "state:2"]);
  expect(states[0].lastTarget).toBe(3);
  expect(states[0].lastDay).toBeNull();
  expect(states[1].lastTarget).toBeNull();
  expect(states[1].lastDay).toBe(2);
  expect(states[2].history).toEqual([{ day: 2, targetId: 3, result: { kind: "role", role: "seer" } }]);
});

test("state append keeps target write when later day write fails", () => {
  const state = fresh(), failure = new Error("literal_day_write_failure");
  Object.defineProperty(state, "lastDay", { get: () => null, set: () => { throw failure; } });
  expect(() => slot.allowedWrites.appendState(state, 3, 2, { kind: "role", role: "seer" })).toThrow(failure);
  expect(state.lastTarget).toBe(3);
  expect(state.lastDay).toBeNull();
  expect(state.history).toEqual([]);
});

test("policy identity codec looks up stringify before two live state reads", () => {
  const trace: string[] = [], descriptor = Object.getOwnPropertyDescriptor(JSON, "stringify")!;
  const state = { ...fresh(), inspectionPolicy: "awa_repeat_optional_v1" } as const;
  const ability = { get state() { trace.push("state"); return state; } } as unknown as NightAbilityReadView<"role_check">;
  let encoded: string;
  try {
    Object.defineProperty(JSON, "stringify", { configurable: true, get() { trace.push("stringify"); return descriptor.value; } });
    encoded = slot.checkpoint.policyIdentity(ability);
  } finally { Object.defineProperty(JSON, "stringify", descriptor); }
  expect(encoded!).toBe('["psychic","awa_repeat_optional_v1"]');
  expect(trace).toEqual(["stringify", "state", "state"]);
});

test("original ability scope remains the owner of state replacement and real life revocation", () => {
  const world = new World(), id = world.createEntity(), role = createRoleComponent(Role.Gargoyle), life = createAliveComponent();
  world.addComponent(id, COMPONENT.Role, role);
  world.addComponent(id, COMPONENT.Camp, { camp: Camp.Wolf });
  world.addComponent(id, COMPONENT.Alive, life);
  slot.install(role, fresh("gargoyle"));
  const ability = findNightAbility(role, "role_check")!, scope = captureNightAbilityScope(world, id, ability, 1, () => true)!;
  expect(scope.isEligible()).toBe(true);
  slot.install(role, fresh("gargoyle"));
  expect(scope.isOwnerCurrent()).toBe(false);
  const current = captureNightAbilityScope(world, id, ability, 1, () => true)!;
  expect(current.isEligible()).toBe(true);
  life.alive = false;
  expect(current.isOwnerCurrent()).toBe(false);
});


test("native entry paths retain clone before two inventory reads and late source role", () => {
  for (const entry of ["slot", "generic"] as const) {
    const trace: string[] = [], container = {};
    const role = {
      get role(): Role { trace.push("role"); return Role.Psychic; },
      get privateState(): object { trace.push("private"); return container; },
    };
    const input: RoleInspectionState = {
      get policy() { trace.push("input-policy"); return "psychic" as const; },
      lastTarget: null, lastDay: null, history: [],
    };
    const state = entry === "slot" ? slot.install(role, input) : installNativeAbility(role, "role_check", input);
    expect(trace).toEqual(["input-policy", "private", "private", "role"]);
    expect(state).not.toBe(input);
    expect((container as { abilities: Record<string, { state: unknown }> }).abilities["native:role_check"].state).toBe(state);
  }
});

test("prepared native writes keep revision and conflict identity before replacing payload", () => {
  const role = createRoleComponent(Role.Psychic), first = slot.install(role, fresh());
  const data = role.privateState as { abilities: Record<string, NightAbilityReadView>; retiredAbilityIds?: string[] };
  const original = data.abilities["native:role_check"];
  data.retiredAbilityIds = ["native:role_check"];
  const later = slot.install(role, fresh());
  expect(data.abilities["native:role_check"]).toBe(original);
  expect(data.abilities["native:role_check"].state).toBe(first);
  expect(data.abilities["native:role_check:2"].state).toBe(later);
  const current = data.abilities["native:role_check:2"];
  role.role = Role.Seer;
  expect(() => slot.install(role, fresh())).toThrow("ability_native_binding_conflict");
  expect(data.abilities["native:role_check:2"]).toBe(current);
  expect(current.state).toBe(later);
});
