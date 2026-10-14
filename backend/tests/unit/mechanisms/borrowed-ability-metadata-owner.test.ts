/**
 * 单元测试验证借用实例公共 metadata 的具体退役写权与原描述符／方法读取顺序。
 * 输入为真实 native/grant 构造的内存实例、替换访问器和手写失败；预期是原引用、属性和错误前缀。
 * 只调用实例 owner，不验证整板资格、租约、付款、伤害或完整游戏；不生成规则 oracle。
 * 全局方法描述符在 finally 原样恢复，不使用模型、传输或文件。
 */
import { expect, test } from "bun:test";
import { Camp, Role } from "@ai-werewolf-arena/game-contract";
import { World } from "../../../src/core/domain/world";
import { COMPONENT } from "../../../src/core/domain/components/names";
import { createRoleComponent } from "../../../src/game/observation/role-presentation";
import type { GameEvent } from "../../../src/core/domain/events";
import { installNativeAbility } from "../../../src/game/mechanisms/roles/ability_changes";
import { retireBorrowedNightAbility } from "../../../src/game/mechanisms/roles/abilities";
import { grantNightAbility } from "../../../src/game/mechanisms/roles/night-ability-grants";

function instance() {
  const world = new World(),
    sourceId = world.createEntity(),
    targetId = world.createEntity(),
    source = createRoleComponent(Role.Seer),
    target = createRoleComponent(Role.EclipseMaid),
    events: GameEvent[] = [];
  world.addComponent(sourceId, COMPONENT.Role, source);
  world.addComponent(sourceId, COMPONENT.Camp, { camp: Camp.Good });
  world.addComponent(targetId, COMPONENT.Role, target);
  world.addComponent(targetId, COMPONENT.Camp, { camp: Camp.Wolf });
  installNativeAbility(source, "seer_check", {
    lastTarget: null,
    lastIsWerewolf: null,
    history: [],
  });
  const ability = grantNightAbility(
    world,
    targetId,
    {
      id: "copy:eclipse:night:2",
      kind: "seer_check",
      state: { lastTarget: null, lastIsWerewolf: null, history: [] },
      source: { kind: "copy", actorId: sourceId, abilityId: "native:seer_check" },
      sourceDisclosed: true,
      startsOnDay: 2,
      expiresAfterDay: 2,
      maxUses: null,
    },
    events,
  );
  return { ability, target, events };
}

test("retiring a captured instance rewrites disabled data without invoking substituted accessors or relooking up its id", () => {
  const f = instance(),
    state = f.ability.state,
    source = f.ability.source,
    count = f.events.length;
  let reads = 0,
    writes = 0;
  Object.defineProperty(f.ability, "id", { value: "copy:changed" });
  Object.defineProperty(f.ability, "disabled", {
    configurable: true,
    enumerable: true,
    get() {
      reads++;
      return false;
    },
    set(_value: boolean) {
      writes++;
    },
  });
  retireBorrowedNightAbility(() => f.ability);
  expect([reads, writes]).toEqual([0, 0]);
  expect(Object.getOwnPropertyDescriptor(f.ability, "disabled")).toEqual({
    value: true,
    writable: true,
    enumerable: true,
    configurable: true,
  });
  expect(
    (f.target.privateState as { abilities: { "copy:eclipse:night:2": unknown } }).abilities[
      "copy:eclipse:night:2"
    ],
  ).toBe(f.ability);
  expect(f.ability.state).toBe(state);
  expect(f.ability.source).toBe(source);
  expect([
    f.ability.uses,
    f.ability.lastUsedDay,
    f.ability.startsOnDay,
    f.ability.expiresAfterDay,
  ]).toEqual([0, null, 2, 2]);
  expect(f.events.length).toBe(count);
});

test("retirement reads the defineProperty callee before the late captured target and preserves supplier errors", () => {
  const f = instance(),
    descriptor = Object.getOwnPropertyDescriptor(Object, "defineProperty")!,
    define = descriptor.value as typeof Object.defineProperty,
    trace: string[] = [],
    failure = Error("literal_borrowed_target_read_failed");
  let caught: unknown;
  try {
    define(Object, "defineProperty", {
      configurable: true,
      get() {
        trace.push("callee");
        return define;
      },
    });
    retireBorrowedNightAbility(() => {
      trace.push("target");
      return f.ability;
    });
    try {
      retireBorrowedNightAbility(() => {
        trace.push("failed-target");
        throw failure;
      });
    } catch (error) {
      caught = error;
    }
  } finally {
    define(Object, "defineProperty", descriptor);
  }
  expect(trace).toEqual(["callee", "target", "callee", "failed-target"]);
  expect(caught).toBe(failure);
  expect(f.ability.disabled).toBe(true);
});

test("a non-configurable disabled field rejects without rewriting payload or adding lifecycle events", () => {
  const f = instance(),
    state = f.ability.state,
    count = f.events.length;
  Object.defineProperty(f.ability, "disabled", {
    value: false,
    writable: false,
    configurable: false,
  });
  expect(() => retireBorrowedNightAbility(() => f.ability)).toThrow(TypeError);
  expect(f.ability.disabled).toBe(false);
  expect(f.ability.state).toBe(state);
  expect(f.ability.uses).toBe(0);
  expect(f.events.length).toBe(count);
});
