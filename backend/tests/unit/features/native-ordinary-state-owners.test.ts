/**
 * 单元测试：验证普通五族数据初始化的原安装失败前缀，以及熊黎明事件已写后历史失败的边界。
 * 输入为测试自有组件容器／setter 和既有内存原体 fixture；字面访问顺序、原错误身份与历史／事件为预期。
 * 数据初始化不提供角色资格，受控反射只在本例 finally 内恢复；不运行完整对局或模型，不重新生成旧 oracle。
 */
import { expect, test } from "bun:test";
import type { GameEvent } from "@ai-werewolf-arena/game-contract";
import type { RoleComponent } from "../../../src/core/domain/components/role";
import { initializeKnightState } from "../../../src/game/mechanisms/roles/knight/state";
import { initializeIdiotState } from "../../../src/game/mechanisms/roles/idiot/state";
import { initializeWhiteWolfKingState } from "../../../src/game/mechanisms/roles/white_wolf_king/state";
import { initializeBearState, getBearState } from "../../../src/game/mechanisms/roles/bear/state";
import { initializeGravekeeperState } from "../../../src/game/mechanisms/roles/gravekeeper/state";
import { BearNightFrame } from "../../../src/game/mechanisms/roles/bear/night_frame";
import { animalRosterFixture } from "../../support/features/animal-dream/builders/roster";

test("ordinary initializers retain the original container and installation setter failure", () => {
  const cases: Array<{
    key: string;
    initialize: (role: RoleComponent) => void;
    expected: Record<string, unknown>;
  }> = [
    { key: "knight", initialize: initializeKnightState, expected: { canDuel: true } },
    { key: "idiot", initialize: initializeIdiotState, expected: { revealed: false } },
    { key: "white_wolf_king", initialize: initializeWhiteWolfKingState, expected: { canDetonate: true } },
    { key: "bear", initialize: initializeBearState, expected: { history: [] } },
    { key: "gravekeeper", initialize: initializeGravekeeperState, expected: { history: [] } },
  ];
  for (const item of cases) {
    const trace: string[] = [],
      failure = new Error("initial_owner_field_failed"),
      container = {},
      role = {} as RoleComponent;
    let installed: unknown;
    Object.defineProperty(role, "privateState", {
      get() {
        trace.push("container");
        return container;
      },
    });
    Object.defineProperty(container, item.key, {
      set(value: unknown) {
        trace.push(`install:${item.key}`);
        installed = value;
        throw failure;
      },
    });
    let caught: unknown;
    try {
      item.initialize(role);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBe(failure);
    expect(trace).toEqual(["container", `install:${item.key}`]);
    expect(installed).toEqual(item.expected);
  }
});

test("dawn history write failure retains the preceding event and revokes the publication", () => {
  const fixture = animalRosterFixture(),
    frame = BearNightFrame.capture(fixture.world, 1, undefined, "netease_dawn_live_v1")!,
    history = getBearState(fixture.role(11))!.history,
    events: GameEvent[] = [],
    trace: string[] = [],
    failure = new Error("dawn_history_write_failed"),
    define = Object.defineProperty;
  let caught: unknown;
  // 原受控数组校验保持真实执行；只在两个实际写目标处记录／阻断，始终恢复全局 callee。
  Object.defineProperty = ((target: object, key: PropertyKey, descriptor: PropertyDescriptor) => {
    if (target === events) trace.push(`event:${String(key)}`);
    if (target === history) {
      trace.push(`history:${String(key)}`);
      throw failure;
    }
    return define(target, key, descriptor);
  }) as typeof Object.defineProperty;
  try {
    frame.publish(fixture.world, events, () => true);
  } catch (error) {
    caught = error;
  } finally {
    Object.defineProperty = define;
  }
  expect(caught).toBe(failure);
  expect(trace).toEqual(["event:0", "history:0"]);
  expect(history).toEqual([]);
  expect(events.map((event) => event.type)).toEqual(["bear_roared"]);
  expect((events[0]! as Extract<GameEvent, { type: "bear_roared" }>).payload.day).toBe(1);
  // finally 的原撤销状态阻止同 frame 补写；不删掉已经成功追加的事件。
  frame.publish(fixture.world, events, () => true);
  expect(history).toEqual([]);
  expect(events).toHaveLength(1);
});
