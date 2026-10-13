/**
 * 单元测试：验证四类狼人继承检查点的原有序装配和失败前缀。输入为原 World、
 * 字面隐狼状态、带日志的现场参数读取和明确错误；手写读取次序、原事件及对象身份为预期。
 * 只执行同步继承贡献，不推进阶段、完整对局、模型或录制；继承标记不代替当前刀权资格。
 */
import { expect, test } from "bun:test";
import { Camp, Role, type GameEvent } from "@ai-werewolf-arena/game-contract";
import { World } from "../../../src/core/domain/world";
import { COMPONENT } from "../../../src/core/domain/components/names";
import { createAliveComponent } from "../../../src/game/observation/component-presentation";
import { createRoleComponent } from "../../../src/game/observation/role-presentation";
import { getHiddenWolfState } from "../../../src/game/mechanisms/roles/hidden_wolf/ports";
import { refreshWolfKnifeInheritanceAtCheckpoint } from "../../../src/rulesets/wolf-knife-inheritance-plan";

test("four concrete checks read their original WED and WDE argument sequences without roster caching", () => {
  const trace: string[] = [],
    world = new World(),
    events: GameEvent[] = [];
  world.getAliveEntityIds = () => {
    trace.push("roster");
    return [];
  };
  refreshWolfKnifeInheritanceAtCheckpoint({
    world: () => {
      trace.push("world");
      return world;
    },
    events: () => {
      trace.push("events");
      return events;
    },
    day: () => {
      trace.push("day");
      return 4;
    },
  });
  expect(trace).toEqual([
    "world",
    "events",
    "day",
    "roster",
    "world",
    "events",
    "day",
    "roster",
    "world",
    "day",
    "events",
    "roster",
    "world",
    "day",
    "events",
    "roster",
  ]);
  expect(events).toEqual([]);
});

test("later role failure retains the earlier real hidden-wolf inheritance and stops all subsequent reads", () => {
  const trace: string[] = [],
    world = new World(),
    events: GameEvent[] = [],
    failure = new Error("literal_second_role_failure");
  const actorId = world.createEntity(),
    role = createRoleComponent(Role.HiddenWolf, Camp.Wolf);
  // 原机制状态直接作为手写输入，不由被测组合推导自己的预期。
  (role.privateState as Record<string, unknown>).hidden_wolf = { hasInheritedKnife: false };
  world.addComponent(actorId, COMPONENT.Role, role);
  world.addComponent(actorId, COMPONENT.Alive, createAliveComponent());
  let rosterReads = 0;
  world.getAliveEntityIds = () => {
    trace.push("roster");
    if (++rosterReads === 2) throw failure;
    return [actorId];
  };
  const original = getHiddenWolfState(role)!;
  expect(() =>
    refreshWolfKnifeInheritanceAtCheckpoint({
      world: () => {
        trace.push("world");
        return world;
      },
      events: () => {
        trace.push("events");
        return events;
      },
      day: () => {
        trace.push("day");
        return 3;
      },
    }),
  ).toThrow(failure);
  expect(trace).toEqual(["world", "events", "day", "roster", "world", "events", "day", "roster"]);
  expect(getHiddenWolfState(role)).toBe(original);
  expect(original.hasInheritedKnife).toBe(true);
  expect(events.map((event) => ({ type: event.type, payload: event.payload }))).toEqual([
    { type: "hidden_wolf_awakened", payload: { actorId, day: 3 } },
  ]);
});

test("a first day supplier failure stops before any native roster check or role write", () => {
  const trace: string[] = [],
    world = new World(),
    events: GameEvent[] = [],
    failure = new Error("literal_day_supplier_failure");
  world.getAliveEntityIds = () => {
    trace.push("unexpected_roster");
    return [];
  };
  expect(() =>
    refreshWolfKnifeInheritanceAtCheckpoint({
      world: () => {
        trace.push("world");
        return world;
      },
      events: () => {
        trace.push("events");
        return events;
      },
      day: () => {
        trace.push("day");
        throw failure;
      },
    }),
  ).toThrow(failure);
  expect(trace).toEqual(["world", "events", "day"]);
  expect(events).toEqual([]);
});
