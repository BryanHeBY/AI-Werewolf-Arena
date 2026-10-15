/**
 * 单元测试验证幽灵新娘死亡波发布的晚读取和失败前缀。输入为真实婚礼设置、原名单与手写死因，
 * 输出用独立字面顺序、事件和状态断言核对原地扩张、私密受众及发布失败后的关系去重。
 * 设置只执行五个固定请求，不运行完整日夜或模型；事实发布不被当作实际标死或付款许可。
 */
import { expect, spyOn, test } from "bun:test";
import {
  DeathCause,
  Phase,
  type DeathSources,
  type GameEvent,
} from "@ai-werewolf-arena/game-contract";
import { World } from "../../../../src/domain/world";
import { COMPONENT } from "../../../../src/domain/components/names";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { GhostBrideSetupWindow } from "../../../../src/features/ghost-bride/setup";
import { bindWeddingDeathWavePublication } from "../../../../src/features/ghost-bride/ports";
import { ToolGateway } from "../../../../src/engine/actions/tool-gateway";
import { GameActionRequestFactory } from "../../../../src/engine/actions/action-request-factory";
import {
  ghostBrideBoard,
  ghostBrideDeck,
} from "../../../support/features/ghost-bride/builders/scenario";

async function marriedWorld() {
  const config = ghostBrideBoard();
  const { world, boardConfig } = bootstrapGame(config, { fixedRoles: ghostBrideDeck });
  await new GhostBrideSetupWindow(world, new ToolGateway(), [], {
    get requestFactory() {
      return GameActionRequestFactory;
    },
  }).execute(
    boardConfig,
    {
      getAction: async (request) => {
        if (request.allowedTools.includes("choose_bridegroom"))
          return { name: "choose_bridegroom", args: { target_id: 2 } };
        if (request.allowedTools.includes("speak_to_partner"))
          return { name: "speak_to_partner", args: { text: "" } };
        return { name: "choose_wedding_witness", args: { target_id: 3 } };
      },
    },
    1,
    () => true,
  );
  return world;
}

test("without a wedding no event, date or phase query is read", () => {
  const world = new World(),
    ids = [8],
    sources: DeathSources = { 8: [DeathCause.Shot] };
  let worldReads = 0;
  const publisher = bindWeddingDeathWavePublication({
    get world() {
      worldReads++;
      return world;
    },
    get events(): GameEvent[] {
      throw Error("unexpected_events");
    },
    get day(): number {
      throw Error("unexpected_day");
    },
    get phase(): Phase {
      throw Error("unexpected_phase");
    },
  });
  expect(publisher.expand(ids, sources, new Set([8]), new Set())).toEqual([]);
  expect(ids).toEqual([8]);
  expect(worldReads).toBe(1);
});

test("real relation expands in place and reads publication queries in the original order", async () => {
  const world = await marriedWorld(),
    ids = [1],
    sources: DeathSources = { 1: [DeathCause.Shot] },
    nightOrigin = new Set([1]),
    trace: string[] = [],
    events: GameEvent[] = [];
  Object.defineProperty(events, "push", {
    get() {
      trace.push("push-callee");
      return function (this: GameEvent[], event: GameEvent) {
        trace.push("append");
        return Array.prototype.push.call(this, event);
      };
    },
  });
  const clock = spyOn(Date, "now").mockImplementation(() => {
    trace.push("clock");
    return 456;
  });
  try {
    const publisher = bindWeddingDeathWavePublication({
      get world() {
        trace.push("world");
        return world;
      },
      get events() {
        trace.push("events");
        return events;
      },
      get day() {
        trace.push("day");
        return 2;
      },
      get phase() {
        trace.push("phase");
        return Phase.Night;
      },
    });
    expect(publisher.expand(ids, sources, new Set([1]), nightOrigin)).toEqual([2]);
    expect(trace).toEqual([
      "world",
      "world",
      "events",
      "push-callee",
      "clock",
      "day",
      "phase",
      "append",
    ]);
    expect(ids).toEqual([1, 2]);
    expect(sources[2]).toEqual([DeathCause.Lovers]);
    expect([...nightOrigin]).toEqual([1, 2]);
    expect(events).toEqual([
      {
        timestamp: 456,
        type: "ghost_bride_partner_death",
        payload: {
          policy: "awa_melbourne_ghost_bride_v1",
          groupId: "ghost-bride:1:1",
          day: 2,
          phase: Phase.Night,
          actorId: 1,
          targetId: 2,
        },
        audience: [],
      },
    ]);
    expect(
      Object.isFrozen(
        (events[0]! as Extract<GameEvent, { type: "ghost_bride_partner_death" }>).audience,
      ),
    ).toBe(true);
    expect(world.getComponent(2, COMPONENT.Alive)!.alive).toBe(true);
  } finally {
    clock.mockRestore();
  }
});

test("publication failure keeps relation mutation and consumed edge deduplication", async () => {
  const world = await marriedWorld(),
    ids = [1],
    sources: DeathSources = { 1: [DeathCause.Shot] },
    nightOrigin = new Set([1]);
  let eventReads = 0,
    dateReads = 0;
  const publisher = bindWeddingDeathWavePublication({
    get world() {
      return world;
    },
    get events(): GameEvent[] {
      eventReads++;
      throw Error("publication_unavailable");
    },
    get day() {
      dateReads++;
      return 2;
    },
    get phase() {
      dateReads++;
      return Phase.Night;
    },
  });
  expect(() => publisher.expand(ids, sources, new Set([1]), nightOrigin)).toThrow(
    "publication_unavailable",
  );
  expect(ids).toEqual([1, 2]);
  expect(sources[2]).toEqual([DeathCause.Lovers]);
  expect([...nightOrigin]).toEqual([1, 2]);
  // 去重归原关系权威，发布失败不恢复边；重试不再构造事实，也没有提前读取日期／阶段。
  expect(publisher.expand(ids, sources, new Set([1]), nightOrigin)).toEqual([]);
  expect(eventReads).toBe(1);
  expect(dateReads).toBe(0);
  expect(world.getComponent(1, COMPONENT.Alive)!.alive).toBe(true);
  expect(world.getComponent(2, COMPONENT.Alive)!.alive).toBe(true);
});
