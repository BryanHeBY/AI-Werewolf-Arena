/**
 * 单元测试以固定公开板子及委托 getter 故障为输入，核对 Radiant 已获取的夜及原终态参数读取。字面轨迹、错误对象和 lease-closed 事实为独立预期；正常关闭或事实发表失败后，原生 frame 空操作仍不能跳过参数求值。不运行整局、传输或计费模型。
 */
import { expect, test } from "bun:test";
import type { GameEvent } from "@ai-werewolf-arena/game-contract";
import rawBoard from "../../../../../../configs.example/boards/awa_radiant_eclipse_12_v1.json";
import { parseBoardDefinition } from "../../../../src/app/config/board-definition";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { Role } from "../../../../src/domain/identity";
import { RadiantNightUnit } from "../../../../src/features/radiant-eclipse/ports";
import { beginRadiantNight } from "../../../../src/features/radiant-eclipse/night-frame";

function closeStatus(event: GameEvent | undefined) {
  return event?.type === "eclipse_lease_closed" ? event.payload.status : undefined;
}

function fixture() {
  const board = parseBoardDefinition(rawBoard),
    game = bootstrapGame(board.config, {
      fixedRoles: board.config.roleSetups.flatMap((r) => Array<Role>(r.count).fill(r.role)),
    }),
    events: GameEvent[] = [],
    trace: string[] = [];
  let worldFailure: Error | undefined, eventFailure: Error | undefined;
  const unit = new RadiantNightUnit(
    {
      get world() {
        trace.push("world");
        if (worldFailure) throw worldFailure;
        return game.world;
      },
      get events() {
        trace.push("events");
        if (eventFailure) throw eventFailure;
        return events;
      },
    },
    2,
  );
  return {
    ...game,
    unit,
    events,
    trace,
    failWorld(error?: Error) {
      worldFailure = error;
    },
    failEvents(error?: Error) {
      eventFailure = error;
    },
  };
}

test("normal close retains acquired finally arguments and the native single committed fact", () => {
  const f = fixture();
  expect(f.trace).toEqual([]);
  f.unit.open();
  f.unit.closeNormally();
  f.unit.abortIfAcquired();
  expect(f.trace).toEqual(["world", "world", "events", "world", "events"]);
  expect(f.events.map((e) => [e.type, closeStatus(e)])).toEqual([
    ["eclipse_lease_closed", "committed"],
  ]);
});

test("normal authority closure cannot hide a later finally World getter error", () => {
  const f = fixture(),
    error = new Error("radiant_final_world_rejected");
  f.unit.open();
  f.unit.closeNormally();
  f.failWorld(error);
  expect(() => f.unit.abortIfAcquired()).toThrow(error);
  expect(f.trace).toEqual(["world", "world", "events", "world"]);
  expect(f.events).toHaveLength(1);
  expect(closeStatus(f.events[0])).toBe("committed");
});

test("failed begin never acquires an extra cleanup getter or terminal fact", () => {
  const f = fixture(),
    error = new Error("radiant_open_world_rejected");
  f.failWorld(error);
  expect(() => f.unit.open()).toThrow(error);
  f.unit.abortIfAcquired();
  expect(f.trace).toEqual(["world"]);
  expect(f.events).toEqual([]);
});

test("failed normal argument read retains acquired abort and its original aborted fact", () => {
  const f = fixture(),
    error = new Error("radiant_close_events_rejected");
  f.unit.open();
  f.failEvents(error);
  expect(() => f.unit.closeNormally()).toThrow(error);
  f.failEvents();
  f.unit.abortIfAcquired();
  expect(f.trace).toEqual(["world", "world", "events", "world", "events"]);
  expect(f.events.map((e) => [e.type, closeStatus(e)])).toEqual([
    ["eclipse_lease_closed", "aborted"],
  ]);
});

test("failed publication keeps native closed-before-push and still evaluates finally arguments", () => {
  const f = fixture();
  f.unit.open();
  Object.seal(f.events);
  expect(() => f.unit.closeNormally()).toThrow(TypeError);
  expect(() => f.unit.abortIfAcquired()).not.toThrow();
  expect(f.trace).toEqual(["world", "world", "events", "world", "events"]);
  expect(f.events).toEqual([]);
  expect(() => beginRadiantNight(f.world, 3)).not.toThrow();
});
