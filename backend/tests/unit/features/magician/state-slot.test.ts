/**
 * 单元测试验证魔术师状态槽的真实初始化左值、历史写入和身份检查点失败前缀。
 * 输入为测试自有容器／callee getter、原状态和真实内存 frame；原引用、读取顺序、
 * 字面 JSON 与明确错误是独立预期。不运行整局或模型，不把直接 writer 调用当作已获行动许可。
 */
import { expect, test } from "bun:test";
import { Camp, Role } from "@ai-werewolf-arena/game-contract";
import { World } from "../../../../src/domain/world";
import { COMPONENT } from "../../../../src/domain/components/names";
import { createAliveComponent } from "../../../../src/domain/components/alive";
import { createRoleComponent } from "../../../../src/domain/components/role";
import { MAGICIAN_STATE_SLOT } from "../../../../src/features/magician/state-slot";
import {
  installMagicianBoard,
  beginMagicianNight,
  commitMagicianExchange,
  resolveMagicianNightTarget,
} from "../../../../src/features/magician/night-frame";

test("状态初始化先读左值容器和原参数，setter失败不补写或提前查询", () => {
  const trace: string[] = [],
    failure = new Error("literal_magician_install_failure");
  let fail = true,
    stored: unknown;
  const container = {
    set magician(value: unknown) {
      trace.push("set");
      if (fail) throw failure;
      stored = value;
    },
  };
  const parameters = {
    get firstNight(): 1 | 2 {
      trace.push("firstNight");
      return 2;
    },
    get deathShotTargetPolicy(): "original" | "exchanged" {
      trace.push("shot");
      return "exchanged";
    },
  };
  const install = () =>
    MAGICIAN_STATE_SLOT.install(() => {
      trace.push("container");
      return container;
    }, parameters);
  expect(install).toThrow(failure);
  expect(trace).toEqual(["container", "firstNight", "shot", "set"]);
  expect(stored).toBeUndefined();
  fail = false;
  trace.length = 0;
  install();
  expect(trace).toEqual(["container", "firstNight", "shot", "set"]);
  expect(stored).toEqual({
    policy: "awa_magician_wolf_king_v1",
    firstNight: 2,
    deathShotTargetPolicy: "exchanged",
    history: [],
  });
  expect(Object.isFrozen(stored)).toBe(false);
});

test("历史写先查callee再两次读state，原pair引用与可写descriptor保持", () => {
  const state = MAGICIAN_STATE_SLOT.create(1),
    pair: [number, number] = [2, 3];
  const descriptor = Object.getOwnPropertyDescriptor(Object, "defineProperty")!;
  const defineProperty = Object.defineProperty;
  const trace: string[] = [],
    failure = new Error("literal_magician_history_callee_failure");
  let fail = true;
  defineProperty(Object, "defineProperty", {
    configurable: true,
    get() {
      trace.push("callee");
      if (fail) throw failure;
      return function (this: unknown, target: object, key: PropertyKey, value: PropertyDescriptor) {
        expect(this).toBe(Object);
        trace.push("write");
        return defineProperty(target, key, value);
      };
    },
  });
  try {
    const append = () =>
      MAGICIAN_STATE_SLOT.allowedWrites.appendHistory(
        () => {
          trace.push("state");
          return state;
        },
        1,
        pair,
      );
    expect(append).toThrow(failure);
    expect(trace).toEqual(["callee"]);
    expect(state.history).toEqual([]);
    fail = false;
    trace.length = 0;
    append();
    expect(trace).toEqual(["callee", "state", "state", "write"]);
    expect(state.history).toEqual([{ day: 1, pair: [2, 3] }]);
    expect(state.history[0]!.pair).toBe(pair);
    const row = Object.getOwnPropertyDescriptor(state.history, "0")!;
    expect([row.writable, row.enumerable, row.configurable]).toEqual([true, true, true]);
  } finally {
    defineProperty(Object, "defineProperty", descriptor);
  }
});

test("frame在历史之后刷新原身份JSON，编码失败保留历史并撤销旧检查点", () => {
  const world = new World(),
    state = MAGICIAN_STATE_SLOT.create(1);
  for (let seat = 1; seat <= 4; seat++) {
    const id = world.createEntity(),
      role = createRoleComponent(seat === 1 ? Role.Magician : Role.Villager);
    // 测试自己的初始化容器明确可写；不经 reader 或玩家观察取得写权。
    if (seat === 1) (role.privateState as Record<string, unknown>).magician = state;
    world.addComponent(id, COMPONENT.Role, role);
    world.addComponent(id, COMPONENT.Camp, { camp: Camp.Good });
    world.addComponent(id, COMPONENT.Alive, createAliveComponent());
    world.addComponent(id, COMPONENT.Identity, {
      id,
      seat,
      name: `Player ${seat}`,
      sessionId: `player_${seat}`,
    });
  }
  const actor = world.getComponent(1, COMPONENT.Role)!;
  expect(MAGICIAN_STATE_SLOT.get(actor, () => world.getComponent(1, COMPONENT.Camp))).toBe(state);
  expect(MAGICIAN_STATE_SLOT.schema(actor, () => world.getComponent(1, COMPONENT.Camp))).toBe(
    state,
  );
  const view = MAGICIAN_STATE_SLOT.project(actor, () => world.getComponent(1, COMPONENT.Camp))!;
  expect(view).not.toBe(state);
  expect(view.history).not.toBe(state.history);
  expect(
    MAGICIAN_STATE_SLOT.checkpoint.identity(actor, () => world.getComponent(1, COMPONENT.Camp)),
  ).toBe(
    '{"policy":"awa_magician_wolf_king_v1","firstNight":1,"deathShotTargetPolicy":"original","history":[]}',
  );
  installMagicianBoard(world);
  expect(beginMagicianNight(world, 1)).toBe(1);
  const descriptor = Object.getOwnPropertyDescriptor(JSON, "stringify")!,
    stringify = JSON.stringify;
  const failure = new Error("literal_magician_identity_encoding_failure");
  let calls = 0;
  Object.defineProperty(JSON, "stringify", {
    configurable: true,
    get() {
      if (++calls === 2) throw failure;
      return stringify;
    },
  });
  try {
    expect(() => commitMagicianExchange(world, 1, 1, [2, 3])).toThrow(failure);
    expect(calls).toBe(2);
    expect(state.history).toEqual([{ day: 1, pair: [2, 3] }]);
    expect(world.getAliveEntityIds()).toEqual([1, 2, 3, 4]);
  } finally {
    Object.defineProperty(JSON, "stringify", descriptor);
  }
  expect(() => resolveMagicianNightTarget(world, 1, 2)).toThrow("magician_original_state_revoked");
});
