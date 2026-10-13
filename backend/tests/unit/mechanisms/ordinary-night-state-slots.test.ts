/**
 * 单元测试验证普通查验、守卫、药瓶完整状态槽的原实例、原 JSON 接受集合、身份字节
 * 及不同写入前缀。输入为字面状态、getter、失败和实际赠予实例；手写字段、引用和 trace
 * 是预期。不推进完整阶段、对局、Demon 封存流程、模型或档案，不生成新 golden。
 */
import { expect, test } from "bun:test";
import {
  Camp, Role, WitchSelfHealRule,
  type SeerState, type GuardState, type WitchState,
} from "@ai-werewolf-arena/game-contract";
import { SEER_STATE_SLOT as seer } from "../../../src/game/mechanisms/roles/seer/ports";
import { GUARD_STATE_SLOT as guard } from "../../../src/game/mechanisms/roles/guard/ports";
import { WITCH_STATE_SLOT as witch } from "../../../src/game/mechanisms/roles/witch/ports";
import { copyAbilityData, findNightAbility, type NightAbilityReadView } from "../../../src/game/mechanisms/roles/abilities";
import { grantNightAbility, installNativeAbility } from "../../../src/game/mechanisms/roles/ability_changes";
import { createRoleComponent } from "../../../src/game/observation/role-presentation";
import { World } from "../../../src/core/domain/world";
import { COMPONENT } from "../../../src/core/domain/components/names";

const freshSeer = (): SeerState => ({ lastTarget: null, lastIsWerewolf: null, history: [] });
const freshGuard = (): GuardState => ({ lastTarget: null });
const freshWitch = (): WitchState => ({
  heal: 1, poison: 1, selfHealRule: WitchSelfHealRule.FirstNightOnly,
  canSelfHeal: false, healUsedThisNight: false, poisonUsedThisNight: false,
});

test("three slots retain the original JSON schema-copy function and do not invent strict payload rejection", () => {
  for (const slot of [seer, guard, witch]) {
    expect(slot.create).toBe(copyAbilityData);
    expect(slot.schema).toBe(copyAbilityData);
  }
  const input = { ...freshSeer(), extra: { raw: "kept" }, omitted: undefined };
  const owned = seer.create(input);
  expect<unknown>(owned).toEqual({ lastTarget: null, lastIsWerewolf: null, history: [], extra: { raw: "kept" } });
  expect(owned.history).not.toBe(input.history);
  expect(Object.hasOwn(owned, "targetPolicy")).toBe(false);
  expect(Object.hasOwn(input, "omitted")).toBe(true);
  expect(() => seer.schema({ ...freshSeer(), lastTarget: Infinity })).toThrow("ability_state_not_json");
});

test("all three actual native installs preserve owned payload, instance identity and native-first reads", () => {
  const role = createRoleComponent(Role.Seer, Camp.Good), input = freshSeer(), state = seer.install(role, input);
  const ability = findNightAbility(role, "seer_check")!;
  expect(ability.state).toBe(state);
  expect(seer.get(role)).toBe(state);
  expect(state).not.toBe(input);
  expect(seer.install(role, freshSeer())).not.toBe(state);
  expect(findNightAbility(role, "seer_check")).toBe(ability);
  const guardRole = createRoleComponent(Role.Guard, Camp.Good), guardState = guard.install(guardRole, freshGuard());
  expect(findNightAbility(guardRole, "guard")!.state).toBe(guardState);
  expect(guard.get(guardRole)).toBe(guardState);
  const witchRole = createRoleComponent(Role.Witch, Camp.Good), witchState = witch.install(witchRole, freshWitch());
  expect(findNightAbility(witchRole, "potion")!.state).toBe(witchState);
  expect(witch.get(witchRole)).toBe(witchState);
  (findNightAbility(witchRole, "potion") as { disabled: boolean }).disabled = true;
  expect(witch.get(witchRole)).toBe(witchState);
});

test("generic native installation uses the same Seer Guard and Witch owned state", () => {
  const role = createRoleComponent(Role.Villager, Camp.Good), input = freshSeer();
  const seerState = installNativeAbility(role, "seer_check", input);
  const guardState = installNativeAbility(role, "guard", freshGuard());
  const witchState = installNativeAbility(role, "potion", freshWitch());
  expect(seer.get(role)).toBe(seerState);
  expect(guard.get(role)).toBe(guardState);
  expect(witch.get(role)).toBe(witchState);
  expect(seerState).not.toBe(input);
});

test("recipient Seer keeps four state reads and two target getter points", () => {
  const states = [freshSeer(), freshSeer(), freshSeer(), freshSeer()], trace: string[] = [];
  let at = 0;
  const ability = { get state() { trace.push(`state:${at}`); return states[at++]; } } as unknown as NightAbilityReadView<"seer_check">;
  const target = { get id() { trace.push("target"); return 4; } };
  seer.allowedWrites.recordRecipientSeerInspection(ability, target, true, { kind: "camp", camp: "wolf" });
  expect(trace).toEqual(["state:0", "target", "state:1", "state:2", "state:3", "target"]);
  expect(states[0].lastTarget).toBe(4);
  expect(states[1].lastIsWerewolf).toBe(true);
  expect(states[2].lastResult).toEqual({ kind: "camp", camp: "wolf" });
  expect(states[3].history).toEqual([{ targetId: 4, isWerewolf: true, result: { kind: "camp", camp: "wolf" } }]);
});

test("recipient Guard captures its LHS state before a throwing target getter", () => {
  const trace: string[] = [], state = freshGuard(), failure = new Error("literal_target_failure");
  const ability = { get state() { trace.push("state"); return state; } } as unknown as NightAbilityReadView<"guard">;
  expect(() => guard.allowedWrites.recordRecipientGuardTarget(ability, {
    get id(): number { trace.push("target"); throw failure; },
  })).toThrow(failure);
  expect(trace).toEqual(["state", "target"]);
  expect(state.lastTarget).toBeNull();
});

test("Witch reset failure preserves both reset writes before currentDay and leaves the old self-heal value", () => {
  const state = { ...freshWitch(), healUsedThisNight: true, poisonUsedThisNight: true, canSelfHeal: true };
  const failure = new Error("literal_day_failure");
  expect(() => witch.allowedWrites.resetWitchNightState(state, () => { throw failure; })).toThrow(failure);
  expect(state.healUsedThisNight).toBe(false);
  expect(state.poisonUsedThisNight).toBe(false);
  expect(state.canSelfHeal).toBe(true);
});

test("gifted potion recipient writes remain independent from native bottles and metadata", () => {
  const world = new World(), actor = world.createEntity(), giver = world.createEntity(), role = createRoleComponent(Role.Witch, Camp.Good);
  world.addComponent(actor, COMPONENT.Role, role);
  world.addComponent(giver, COMPONENT.Role, createRoleComponent(Role.Villager, Camp.Good));
  const native = witch.install(role, freshWitch()), gift = grantNightAbility(world, actor, {
    id: "gift:ordinary:potion", kind: "potion", state: freshWitch(), source: { kind: "gift", actorId: giver }, startsOnDay: 1, maxUses: 1,
  }, []);
  witch.allowedWrites.consumeRecipientPoison(gift);
  expect(gift.state.poison).toBe(0);
  expect(gift.state.poisonUsedThisNight).toBe(true);
  expect(gift.uses).toBe(0);
  expect(native.poison).toBe(1);
  expect(native.poisonUsedThisNight).toBe(false);
  expect(witch.get(role)).toBe(native);
  expect(witch.get(role, gift.id)).toBe(gift.state);
});

test("three policy codecs keep stringify lookup before each original state field read", () => {
  const trace: string[] = [], descriptor = Object.getOwnPropertyDescriptor(JSON, "stringify")!;
  const seerAbility = { get state() { trace.push("seer"); return freshSeer(); } } as unknown as NightAbilityReadView<"seer_check">;
  const guardAbility = { get state() { trace.push("guard"); return freshGuard(); } } as unknown as NightAbilityReadView<"guard">;
  const witchAbility = { get state() { trace.push("witch"); return freshWitch(); } } as unknown as NightAbilityReadView<"potion">;
  const encoded: string[] = [];
  try {
    Object.defineProperty(JSON, "stringify", { configurable: true, get() { trace.push("stringify"); return descriptor.value; } });
    encoded.push(seer.invalidations.policyIdentity(seerAbility));
    encoded.push(guard.invalidations.policyIdentity(guardAbility));
    encoded.push(witch.invalidations.policyIdentity(witchAbility));
  } finally { Object.defineProperty(JSON, "stringify", descriptor); }
  expect(encoded).toEqual(['[null,null]', '[null]', '["first_night_only",null,null]']);
  expect(trace).toEqual(["stringify", "seer", "seer", "stringify", "guard", "stringify", "witch", "witch", "witch"]);
});
