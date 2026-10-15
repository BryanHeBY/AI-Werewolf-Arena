/**
 * 单元测试负责赤月放逐贡献的短路、已付审计与事实失败前缀。输入为真实有限板子和事件／时钟访问器；
 * 输出为手写字面预期的读取轨迹、原库存、生命与错误，使用实际权威而非模拟转换算法。
 * 不执行完整对局或标死；事件发布失败后的延期库存仍归原权威，测试不将公开端口视作许可。
 */
import { expect, test } from "bun:test";
import type { GameEvent } from "../../../../src/domain/events";
import { COMPONENT } from "../../../../src/domain/components/names";
import {
  beginDemonHunterNight,
  closeDemonHunterNight,
  freezeDemonHunt,
  demonHunterCheckpointPlayers,
} from "../../../../src/features/demon-hunter/authority";
import { redMoonVotedOutHook } from "../../../../src/features/red-moon/voted-out-hook";
import { getRedMoonState } from "../../../../src/features/red-moon/ports";
import { redMoonCandidateWorld } from "../../../support/features/red-moon/builders/candidate-world";

function closedLastWolf() {
  const fixture = redMoonCandidateWorld();
  beginDemonHunterNight(fixture.world, 1, () => true);
  freezeDemonHunt(fixture.world);
  closeDemonHunterNight(fixture.world);
  for (const id of [1, 2, 3]) fixture.world.getComponent(id, COMPONENT.Alive)!.alive = false;
  return fixture;
}

test("无原候选或未关闭的夜不读取事件方法、不消费延期", () => {
  const fixture = redMoonCandidateWorld(),
    trace: string[] = [];
  const events: GameEvent[] = [];
  Object.defineProperty(events, "push", {
    get(): never {
      trace.push("push");
      throw new Error("literal_event_must_not_read");
    },
  });
  expect(redMoonVotedOutHook(fixture.world, 5, events)).toBeNull();
  expect(redMoonVotedOutHook(fixture.world, 4, events)).toBeNull();
  beginDemonHunterNight(fixture.world, 1, () => true);
  freezeDemonHunt(fixture.world);
  expect(redMoonVotedOutHook(fixture.world, 4, events)).toBeNull();
  expect(trace).toEqual([]);
  expect(
    getRedMoonState(fixture.world.getComponent(4, COMPONENT.Role), () =>
      fixture.world.getComponent(4, COMPONENT.Camp),
    )!.exileDay,
  ).toBeNull();
  expect(fixture.world.getComponent(4, COMPONENT.Alive)!.alive).toBe(true);
});

test("延期提交后push查找失败保留审计与生命，重试不再次发布", () => {
  const fixture = closedLastWolf(),
    events: GameEvent[] = [],
    trace: string[] = [];
  const failure = new Error("literal_red_moon_push_lookup_failed");
  Object.defineProperty(events, "push", {
    get(): never {
      trace.push("push");
      throw failure;
    },
  });
  expect(() => redMoonVotedOutHook(fixture.world, 4, events)).toThrow(failure);
  expect(
    getRedMoonState(fixture.world.getComponent(4, COMPONENT.Role), () =>
      fixture.world.getComponent(4, COMPONENT.Camp),
    )!.exileDay,
  ).toBe(1);
  expect(fixture.world.getComponent(4, COMPONENT.Alive)!.alive).toBe(true);
  // 检查完整原生审计仍接受已提交库存，不仅读某个公开字段；调用不发布事实。
  expect(demonHunterCheckpointPlayers(fixture.world, true)).toHaveLength(12);
  expect(redMoonVotedOutHook(fixture.world, 4, events)).toBeNull();
  expect(trace).toEqual(["push"]);
  expect(events).toHaveLength(0);
});

test("先取push再读时钟，时钟失败不调用已取方法且不退款", () => {
  const fixture = closedLastWolf(),
    events: GameEvent[] = [],
    trace: string[] = [];
  const failure = new Error("literal_red_moon_clock_failed");
  const descriptor = Object.getOwnPropertyDescriptor(Date, "now")!;
  Object.defineProperty(events, "push", {
    get() {
      trace.push("push_lookup");
      return function (this: GameEvent[], ..._events: GameEvent[]): number {
        trace.push("push_call");
        return this.length;
      };
    },
  });
  try {
    // 只在真实提交之后的事件表达式读取时钟；finally恢复全局描述符，不改变其它测试的时钟。
    Object.defineProperty(Date, "now", {
      configurable: true,
      get() {
        trace.push("clock_lookup");
        return function (): never {
          trace.push("clock_call");
          throw failure;
        };
      },
    });
    expect(() => redMoonVotedOutHook(fixture.world, 4, events)).toThrow(failure);
  } finally {
    Object.defineProperty(Date, "now", descriptor);
  }
  expect(trace).toEqual(["push_lookup", "clock_lookup", "clock_call"]);
  expect(
    getRedMoonState(fixture.world.getComponent(4, COMPONENT.Role), () =>
      fixture.world.getComponent(4, COMPONENT.Camp),
    )!.exileDay,
  ).toBe(1);
  expect(fixture.world.getComponent(4, COMPONENT.Alive)!.alive).toBe(true);
  expect(demonHunterCheckpointPlayers(fixture.world, true)).toHaveLength(12);
  expect(events).toHaveLength(0);
});
