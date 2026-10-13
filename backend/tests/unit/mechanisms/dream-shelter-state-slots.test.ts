/**
 * 摄梦人／庇护状态槽的有界契约测试：字面 payload、getter trace、真实原生／受赠实例和部分
 * 失败验证原引用与验证边界。手写预期不来自生产输出；不推进整局、借用生命周期或模型。
 * 支付效果与首次死亡仍由原 frame 测试覆盖，这里只核对状态写入及 scope 身份 codec。
 */
import { expect, test } from "bun:test";
import { Camp, Role, type DreamerState, type ShelterState } from "@ai-werewolf-arena/game-contract";
import { DREAMER_STATE_SLOT as dream } from "../../../src/game/mechanisms/roles/dreamer/ports";
import { SHELTER_STATE_SLOT as shelter } from "../../../src/game/mechanisms/roles/radiant_eclipse/shelter-state-slot";
import { createShelterState, readShelterState, selectShelter } from "../../../src/game/mechanisms/roles/radiant_eclipse/shelter-state";
import { copyAbilityData, findNightAbility, type NightAbilityReadView } from "../../../src/game/mechanisms/roles/abilities";
import { projectNightState } from "../../../src/game/observation/night-ability-projection";
import { grantNightAbility, installNativeAbility } from "../../../src/game/mechanisms/roles/ability_changes";
import { createRoleComponent } from "../../../src/game/observation/role-presentation";
import { World } from "../../../src/core/domain/world";
import { COMPONENT } from "../../../src/core/domain/components/names";

const freshDream = (): DreamerState => ({ lastTarget: null, lastDay: null, history: [] });

test("Dream JSON schema and Shelter preparation keep old extra fields while strict Shelter read remains separate", () => {
  expect(dream.create).toBe(copyAbilityData);
  expect(dream.schema).toBe(copyAbilityData);
  expect(shelter.prepare).toBe(copyAbilityData);
  expect(shelter.create).toBe(createShelterState);
  expect(shelter.schema).toBe(readShelterState);
  expect(shelter.select).toBe(selectShelter);
  const input = { ...createShelterState(), extra: { note: "native accepted" } };
  const owned = shelter.prepare(input) as typeof input;
  expect(owned).toEqual({ policy: "awa_radiant_eclipse_v1", lastTarget: null, lastDay: null, extra: { note: "native accepted" } });
  expect(owned.extra).not.toBe(input.extra);
  expect(shelter.schema(owned)).toBeUndefined();
  expect<unknown>(dream.schema({ ...freshDream(), extra: "kept" } as DreamerState & { extra: string })).toEqual({ lastTarget: null, lastDay: null, history: [], extra: "kept" });
  expect(() => dream.schema({ ...freshDream(), lastDay: Infinity })).toThrow("ability_state_not_json");
});

test("generic and direct native installs retain owned references and do not insert strict Shelter rejection", () => {
  const role = createRoleComponent(Role.Villager, Camp.Good), input = freshDream();
  const dreamState = dream.install(role, input);
  expect(dream.get(role)).toBe(dreamState);
  expect(findNightAbility(role, "dream")!.state).toBe(dreamState);
  expect(dreamState).not.toBe(input);
  const malformed = { ...createShelterState(), extra: "kept" };
  const shelterState = installNativeAbility(role, "shelter", malformed);
  const ability = findNightAbility(role, "shelter")!;
  expect(shelterState).toBe(ability.state);
  expect<unknown>(shelterState).toEqual({ policy: "awa_radiant_eclipse_v1", lastTarget: null, lastDay: null, extra: "kept" });
  expect(() => projectNightState(ability)).toThrow("radiant_shelter_state_invalid");
  const replacement = shelter.install(role, createShelterState());
  expect(findNightAbility(role, "shelter")).toBe(ability);
  expect(replacement).toBe(ability.state);
  expect(replacement).not.toBe(shelterState);
});

test("Dream selection preserves target/day prefix when original history push fails", () => {
  const failure = new Error("literal_history_failure"), trace: string[] = [];
  const state = {
    lastTarget: null as number | null,
    lastDay: null as number | null,
    get history(): DreamerState["history"] { trace.push("history"); throw failure; },
  };
  expect(() => dream.allowedWrites.recordDreamSelection(state, 7, 3)).toThrow(failure);
  expect(trace).toEqual(["history"]);
  expect(state.lastTarget).toBe(7);
  expect(state.lastDay).toBe(3);
});

test("Shelter assign lookup precedes state getter and field failure retains the assigned prefix", () => {
  const trace: string[] = [], failure = new Error("literal_shelter_day_failure");
  const state = {
    policy: "awa_radiant_eclipse_v1", lastTarget: null as number | null,
    get lastDay() { return null; },
    set lastDay(_value: number | null) { trace.push("day:set"); throw failure; },
  };
  const ability = { get state() { trace.push("state"); return state; } } as unknown as NightAbilityReadView<"shelter">;
  const descriptor = Object.getOwnPropertyDescriptor(Object, "assign")!;
  try {
    Object.defineProperty(Object, "assign", { configurable: true, get() { trace.push("assign"); return descriptor.value; } });
    expect(() => shelter.allowedWrites.recordShelterSelection(ability, { policy: "awa_radiant_eclipse_v1", lastTarget: 8, lastDay: 2 })).toThrow(failure);
  } finally { Object.defineProperty(Object, "assign", descriptor); }
  expect(trace).toEqual(["assign", "state", "day:set"]);
  expect(state.lastTarget).toBe(8);
  expect(state.lastDay).toBeNull();
});

test("strict Shelter schema rejects Proxy and accessor before invoking reflection or getter", () => {
  const trace: string[] = [];
  const hostile = new Proxy(createShelterState(), {
    ownKeys() { trace.push("keys"); throw Error("must_not_reflect"); },
    getPrototypeOf() { trace.push("prototype"); throw Error("must_not_reflect"); },
  });
  expect(shelter.schema(hostile)).toBeUndefined();
  const getterState = { policy: "awa_radiant_eclipse_v1", lastDay: null, get lastTarget() { trace.push("target"); return null; } };
  expect(shelter.schema(getterState)).toBeUndefined();
  expect(trace).toEqual([]);
  const input: ShelterState = { policy: "awa_radiant_eclipse_v1", lastTarget: 8, lastDay: 2 };
  const detached = shelter.schema(input)!;
  expect(detached).toEqual({ policy: "awa_radiant_eclipse_v1", lastTarget: 8, lastDay: 2 });
  expect(detached).not.toBe(input);
});

test("gifted Dream uses its independent history and preserves native-first state lookup", () => {
  const world = new World(), actor = world.createEntity(), giver = world.createEntity();
  const role = createRoleComponent(Role.Dreamer, Camp.Good);
  world.addComponent(actor, COMPONENT.Role, role);
  world.addComponent(giver, COMPONENT.Role, createRoleComponent(Role.Villager, Camp.Good));
  const native = dream.install(role, freshDream());
  const gift = grantNightAbility(world, actor, {
    id: "gift:literal:dream", kind: "dream", state: freshDream(),
    source: { kind: "gift", actorId: giver }, startsOnDay: 2, maxUses: 1,
  }, []);
  dream.allowedWrites.recordDreamSelection(gift.state, giver, 2);
  expect(gift.state.history).toEqual([{ day: 2, targetId: giver }]);
  expect(native.history).toEqual([]);
  expect(dream.get(role)).toBe(native);
  expect(dream.get(role, gift.id)).toBe(gift.state);
  expect(gift.uses).toBe(0);
});

test("both policy codecs preserve stringify lookup before their one original state read", () => {
  const trace: string[] = [], descriptor = Object.getOwnPropertyDescriptor(JSON, "stringify")!;
  const dreamAbility = { get state() { trace.push("dream"); return freshDream(); } } as unknown as NightAbilityReadView<"dream">;
  const shelterAbility = { get state() { trace.push("shelter"); return createShelterState(); } } as unknown as NightAbilityReadView<"shelter">;
  const bytes: string[] = [];
  try {
    Object.defineProperty(JSON, "stringify", { configurable: true, get() { trace.push("stringify"); return descriptor.value; } });
    bytes.push(dream.invalidations.policyIdentity(dreamAbility));
    bytes.push(shelter.invalidations.policyIdentity(shelterAbility));
  } finally { Object.defineProperty(JSON, "stringify", descriptor); }
  expect(bytes).toEqual(['[null]', '["awa_radiant_eclipse_v1"]']);
  expect(trace).toEqual(["stringify", "dream", "stringify", "shelter"]);
});
