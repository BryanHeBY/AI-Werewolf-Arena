/**
 * 单元测试验证诡术师状态槽的原初始化左值、descriptor 追加与身份编码失败前缀。
 * 输入为测试自有容器、callee getter 和真实内存 frame；读取轨迹、原 choice／pair 身份、
 * 字面状态及错误是独立预期，不运行整局／模型，不把直接 writer 视为获准夜行动。
 */
import { expect, test } from "bun:test";
import { Camp, Role } from "@ai-werewolf-arena/game-contract";
import { World } from "../../../../src/domain/world";
import { COMPONENT } from "../../../../src/domain/components/names";
import { createAliveComponent } from "../../../../src/domain/components/alive";
import { createRoleComponent } from "../../../../src/domain/components/role";
import { TRICKSTER_STATE_SLOT } from "../../../../src/features/trickster/state-slot";
import {
  installTricksterBoard,
  beginTricksterNight,
  commitTricksterExchange,
  finishTricksterNight,
} from "../../../../src/features/trickster/night-frame";

test("初始化先取左值容器，setter失败不补写且不冻结原状态", () => {
  const trace: string[] = [],
    failure = new Error("literal_trickster_install_failure");
  let failed = true,
    stored: unknown;
  const container = {
    set trickster(value: unknown) {
      trace.push("set");
      if (failed) throw failure;
      stored = value;
    },
  };
  const install = () =>
    TRICKSTER_STATE_SLOT.install(() => {
      trace.push("container");
      return container;
    });
  expect(install).toThrow(failure);
  expect(trace).toEqual(["container", "set"]);
  expect(stored).toBeUndefined();
  failed = false;
  trace.length = 0;
  install();
  expect(trace).toEqual(["container", "set"]);
  expect(stored).toEqual({ policy: "awa_trickster_exile_v1", history: [] });
  expect(Object.isFrozen(stored)).toBe(false);
});

test("追加先查callee再两次读state，保choice和pair原引用与descriptor", () => {
  const state = TRICKSTER_STATE_SLOT.create(),
    pair: [number, number] = [2, 3];
  const choice = { day: 1, pair };
  const descriptor = Object.getOwnPropertyDescriptor(Object, "defineProperty")!;
  const defineProperty = Object.defineProperty;
  const trace: string[] = [],
    failure = new Error("literal_trickster_append_callee_failure");
  let failed = true;
  defineProperty(Object, "defineProperty", {
    configurable: true,
    get() {
      trace.push("callee");
      if (failed) throw failure;
      return function (this: unknown, target: object, key: PropertyKey, value: PropertyDescriptor) {
        expect(this).toBe(Object);
        trace.push("write");
        return defineProperty(target, key, value);
      };
    },
  });
  try {
    const append = () =>
      TRICKSTER_STATE_SLOT.allowedWrites.appendHistory(() => {
        trace.push("state");
        return state;
      }, choice);
    expect(append).toThrow(failure);
    expect(trace).toEqual(["callee"]);
    expect(state.history).toEqual([]);
    failed = false;
    trace.length = 0;
    append();
    expect(trace).toEqual(["callee", "state", "state", "write"]);
    expect(state.history[0]).toBe(choice);
    expect(state.history[0]!.pair).toBe(pair);
    const row = Object.getOwnPropertyDescriptor(state.history, "0")!;
    expect([row.writable, row.enumerable, row.configurable]).toEqual([true, true, true]);
  } finally {
    defineProperty(Object, "defineProperty", descriptor);
  }
});

test("历史追加后身份编码失败保原history，frame不补finished或续旧检查点", () => {
  const world = new World(),
    state = TRICKSTER_STATE_SLOT.create();
  for (let seat = 1; seat <= 4; seat++) {
    const id = world.createEntity(),
      role = createRoleComponent(seat === 1 ? Role.Trickster : Role.Villager);
    // 测试自有安装容器明确可写；未从玩家投影或 live reader 推导生产写权。
    if (seat === 1) (role.privateState as Record<string, unknown>).trickster = state;
    world.addComponent(id, COMPONENT.Role, role);
    world.addComponent(id, COMPONENT.Camp, { camp: seat === 1 ? Camp.Wolf : Camp.Good });
    world.addComponent(id, COMPONENT.Alive, createAliveComponent());
    world.addComponent(id, COMPONENT.Identity, {
      id,
      seat,
      name: `Player ${seat}`,
      sessionId: `player_${seat}`,
    });
  }
  const actor = world.getComponent(1, COMPONENT.Role)!;
  expect(TRICKSTER_STATE_SLOT.get(actor, () => world.getComponent(1, COMPONENT.Camp))).toBe(state);
  expect(TRICKSTER_STATE_SLOT.schema(actor, () => world.getComponent(1, COMPONENT.Camp))).toBe(
    state,
  );
  const view = TRICKSTER_STATE_SLOT.project(actor, () => world.getComponent(1, COMPONENT.Camp))!;
  expect(view).not.toBe(state);
  expect(view.history).not.toBe(state.history);
  expect(
    TRICKSTER_STATE_SLOT.checkpoint.identity(actor, () => world.getComponent(1, COMPONENT.Camp)),
  ).toBe('{"policy":"awa_trickster_exile_v1","history":[]}');
  installTricksterBoard(world);
  expect(beginTricksterNight(world, 1)).toBe(1);
  const descriptor = Object.getOwnPropertyDescriptor(JSON, "stringify")!,
    stringify = JSON.stringify;
  const failure = new Error("literal_trickster_identity_failure");
  let calls = 0;
  Object.defineProperty(JSON, "stringify", {
    configurable: true,
    get() {
      calls++;
      if (state.history.length) throw failure;
      return stringify;
    },
  });
  try {
    expect(() => commitTricksterExchange(world, 1, 1, [2, 3])).toThrow(failure);
    expect(calls).toBe(4);
    expect(state.history).toEqual([{ day: 1, pair: [2, 3] }]);
    expect(world.getAliveEntityIds()).toEqual([1, 2, 3, 4]);
  } finally {
    Object.defineProperty(JSON, "stringify", descriptor);
  }
  expect(() => finishTricksterNight(world, 1)).toThrow("trickster_original_state_revoked");
});
