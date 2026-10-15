/**
 * 单元测试负责雾鸦状态槽迁移的失败前缀、晚读顺序与逐层引用身份。
 * 输入为独立内存参与者和受控 JSON／属性写故障；输出预期是手写调用轨迹、原错误引用及原库存。
 * 不执行整夜、模型或传输，不从新 slot 推导预期；状态同字节不能代替原引用，知识不能授予新付款。
 */
import { expect, test } from "bun:test";
import { Camp, Role } from "@ai-werewolf-arena/game-contract";
import { World } from "../../../../src/domain/world";
import { COMPONENT } from "../../../../src/domain/components/names";
import { createIdentityComponent } from "../../../../src/domain/entities/player";
import { createRoleComponent } from "../../../../src/agents/observation/role-presentation";
import {
  createAliveComponent,
  createCampComponent,
} from "../../../../src/agents/observation/component-presentation";
import {
  createAlchemistState,
  createRavenState,
  type AlchemistState,
} from "../../../../src/features/mist-raven/state";
import { MistCasterAuthority } from "../../../../src/features/mist-raven/caster-authority";

function participant(caster: "alchemist" | "raven_claw_wolf" = "alchemist") {
  const world = new World(),
    id = world.createEntity();
  const role = createRoleComponent(caster === "alchemist" ? Role.Alchemist : Role.RavenClawWolf);
  const raw = caster === "alchemist" ? createAlchemistState() : createRavenState();
  (role.privateState as Record<string, unknown>)[caster === "alchemist" ? "alchemist" : "ravenClaw"] = raw;
  world.addComponent(id, COMPONENT.Role, role);
  world.addComponent(id, COMPONENT.Camp, createCampComponent(caster === "alchemist" ? Camp.Good : Camp.Wolf));
  world.addComponent(id, COMPONENT.Alive, createAliveComponent());
  world.addComponent(id, COMPONENT.Identity, createIdentityComponent(id, 1, "字面施法者"));
  return { world, id, role, raw, caster };
}
function authority(p: ReturnType<typeof participant>) {
  return new MistCasterAuthority(p.world, p.id, 1, p.caster);
}

test("raven check remains consumed after the independent unseal selector throws", () => {
  const p = participant("raven_claw_wolf"),
    owner = authority(p);
  expect(() => owner.checkRavenAtNightStart([p.id, p.id])).toThrow("raven_unseal_invalid");
  expect((p.role.privateState as Record<string, unknown>).ravenClaw).toBe(p.raw);
  expect(() => owner.checkRavenAtNightStart([p.id, 2])).toThrow("raven_night_start_reentry");
  expect(owner.state()).toMatchObject({ awakenedDay: null, knownTeammateIds: [] });
});

test("raven check remains consumed when its prepared state cannot replace the frozen slot", () => {
  const p = participant("raven_claw_wolf"),
    owner = authority(p);
  Object.freeze(p.role.privateState);
  expect(() => owner.checkRavenAtNightStart([p.id, 2])).toThrow(TypeError);
  expect((p.role.privateState as Record<string, unknown>).ravenClaw).toBe(p.raw);
  expect(owner.isCurrent()).toBe(true);
  expect(() => owner.checkRavenAtNightStart([p.id, 2])).toThrow("raven_night_start_reentry");
});

test("a descriptor failure after the physical write preserves the new stock and revokes the old checkpoint", () => {
  const p = participant(),
    owner = authority(p),
    failure = new Error("literal_after_state_write");
  const define = Object.defineProperty;
  let observed: unknown;
  Object.defineProperty = ((target, key, descriptor) => {
    const result = define(target, key, descriptor);
    if (target === p.role.privateState && key === "alchemist") throw failure;
    return result;
  }) as typeof Object.defineProperty;
  try {
    owner.commitMist([1, 2, 3], [1, 2, 3]);
  } catch (error) {
    observed = error;
  } finally {
    Object.defineProperty = define;
  }
  expect(observed).toBe(failure);
  expect((p.role.privateState as Record<string, unknown>).alchemist).not.toBe(p.raw);
  expect((p.role.privateState as Record<string, unknown>).alchemist).toMatchObject({
    mistRemaining: 0,
    healRemaining: 1,
    mistHistory: [{ day: 1, targetIds: [1, 2, 3] }],
  });
  expect(owner.isCurrent()).toBe(false);
  expect(() => owner.commitSnake(1, [1])).toThrow("mist_caster_authority_revoked");
});

test("initial binding JSON failure leaves the original inventory untouched", () => {
  const p = participant(),
    failure = new Error("literal_initial_json"),
    stringify = JSON.stringify;
  let observed: unknown;
  JSON.stringify = (() => {
    throw failure;
  }) as typeof JSON.stringify;
  try {
    authority(p);
  } catch (error) {
    observed = error;
  } finally {
    JSON.stringify = stringify;
  }
  expect(observed).toBe(failure);
  expect((p.role.privateState as Record<string, unknown>).alchemist).toBe(p.raw);
  expect(authority(p).state()).toMatchObject({
    mistRemaining: 1,
    healRemaining: 1,
    mistHistory: [],
    healHistory: [],
  });
});

test("caster and JSON reads remain late around prepare and descriptor publication", () => {
  const p = participant(),
    owner = authority(p),
    trace: string[] = [];
  const define = Object.defineProperty,
    stringify = JSON.stringify;
  Object.defineProperty(owner, "caster", {
    configurable: true,
    get() {
      trace.push("caster");
      return "alchemist";
    },
  });
  Object.defineProperty = ((target, key, descriptor) => {
    if (target === p.role.privateState && key === "alchemist") trace.push("write");
    return define(target, key, descriptor);
  }) as typeof Object.defineProperty;
  JSON.stringify = ((...args: Parameters<typeof JSON.stringify>) => {
    trace.push("json");
    return stringify(...args);
  }) as typeof JSON.stringify;
  try {
    owner.commitMist(null, [p.id]);
  } finally {
    Object.defineProperty = define;
    JSON.stringify = stringify;
  }
  expect(trace).toEqual([
    "caster",
    "caster",
    "caster",
    "json",
    "caster",
    "caster",
    "caster",
    "json",
    "caster",
    "caster",
    "caster",
    "json",
    "write",
    "caster",
    "caster",
    "json",
    "caster",
  ]);
  expect((p.role.privateState as Record<string, unknown>).alchemist).toMatchObject({
    mistRemaining: 1,
    mistHistory: [{ day: 1, targetIds: null }],
  });
});

for (const replaced of ["array", "row", "targets"] as const) {
  test(`same-JSON ${replaced} replacement cannot renew state identity`, () => {
    const p = participant(),
      owner = authority(p);
    owner.commitMist([1, 2, 3], [1, 2, 3]);
    const raw = (p.role.privateState as Record<string, unknown>).alchemist as AlchemistState,
      before = JSON.stringify(raw);
    if (replaced === "array") raw.mistHistory = [...raw.mistHistory];
    else if (replaced === "row") raw.mistHistory[0] = { ...raw.mistHistory[0]! };
    else raw.mistHistory[0]!.targetIds = [...raw.mistHistory[0]!.targetIds!];
    expect(JSON.stringify(raw)).toBe(before);
    expect(owner.isCurrent()).toBe(false);
    expect(() => owner.state(true)).toThrow("mist_caster_authority_revoked");
  });
}
