/**
 * 单元测试验证共用事件 owner 的两种旧模式、Node 输入安全边界及历史受众。
 * 输入为手写纯事实、畸形 audience、getter／Proxy 与显式自定义规则；预期是独立字面字段与调用序列。
 * 不运行完整对局或模型，不用生产投影生成预期；未知事实拒绝，事件 seq 不暴露隐藏事件数量。
 * 窄端口只在命中原分支时查询，不授权行动或写入库存；失败前缀仍由原入口负责。
 */
import { expect, test } from "bun:test";
import { Phase, Role, type GameEvent } from "@ai-werewolf-arena/game-contract";
import { World } from "../../../src/core/domain/world";
import { AgentEventVisibilityRegistry } from "../../../src/game/mechanisms/broadcast/agent_event_visibility_registry";
import {
  buildAgentVisibleEvent,
  buildAgentVisibleEventFeed,
} from "../../../src/game/engine/agent_visible_event_feed";
import {
  canViewAgentEvent,
  projectAgentEvent,
} from "../../../src/game/observation/agent-event-projection";
import { projectAbilitySource } from "../../../src/game/mechanisms/roles/abilities";

test("boolean visibility keeps its historical Mist audience mode while the feed rejects duplicate recipients", () => {
  const world = new World();
  const registry = new AgentEventVisibilityRegistry();
  const event: GameEvent = {
    timestamp: 1,
    type: "mist_knife_drawn",
    audience: [2, 2],
    payload: { day: 1, candidates: [4], targetId: 4 },
  };
  expect(registry.canView(world, event, 2)).toBe(true);
  expect(buildAgentVisibleEvent(world, event, 2, 1)).toBeNull();
  expect(buildAgentVisibleEvent(world, { ...event, audience: [2, 3] }, 2, 1)).toEqual({
    seq: 1,
    type: "mist_knife_drawn",
    payload: { day: 1, candidates: [4], targetId: 4 },
  });
});

test("a current empty world cannot grant or revoke captured wolf audience and hidden events leave no sequence gap", () => {
  const world = new World();
  const events: GameEvent[] = [
    { timestamp: 1, type: "god_private_game_info", payload: { boardSize: 1, players: [] } },
    {
      timestamp: 2,
      type: "wolf_discussion",
      audience: [7],
      payload: { actorId: 3, text: "原文\nraw <tag> 🐺", endChat: false, round: 1 },
    },
    { timestamp: 3, type: "phase_changed", payload: { phase: Phase.Day, day: 1 } },
  ];
  expect(buildAgentVisibleEventFeed(world, events, 7)).toEqual([
    {
      seq: 1,
      type: "wolf_discussion",
      payload: { actorId: 3, text: "原文\nraw <tag> 🐺", endChat: false, round: 1 },
    },
    { seq: 2, type: "phase_changed", payload: { phase: Phase.Day, day: 1 } },
  ]);
  expect(buildAgentVisibleEventFeed(world, events, 3)).toEqual([
    { seq: 1, type: "phase_changed", payload: { phase: Phase.Day, day: 1 } },
  ]);
});

test("Node ingress rejects accessors and Proxy before reflection and keeps the source detached", () => {
  const trace: string[] = [];
  const world = new World();
  const accessor = {
    timestamp: 1,
    type: "day_speech",
    get payload() {
      trace.push("payload");
      return { actorId: 1, text: "secret" };
    },
  } as GameEvent;
  const proxy = new Proxy(
    { timestamp: 1, type: "day_speech", payload: { actorId: 1, text: "secret" } },
    {
      getPrototypeOf() {
        trace.push("prototype");
        throw Error("should_not_reflect");
      },
      ownKeys() {
        trace.push("keys");
        throw Error("should_not_reflect");
      },
    },
  ) as GameEvent;
  expect(buildAgentVisibleEvent(world, accessor, 1, 1)).toBeNull();
  expect(buildAgentVisibleEvent(world, proxy, 1, 1)).toBeNull();
  expect(trace).toEqual([]);
  const event: GameEvent = {
    timestamp: 1,
    type: "day_speech",
    payload: { actorId: 1, text: "保留原文" },
  };
  const projected = buildAgentVisibleEvent(world, event, 1, 1)!;
  event.payload.text = "later";
  expect(projected.payload).toEqual({ actorId: 1, text: "保留原文" });
});

test("source disclosure and summarized ballots keep their exact authorized fields", () => {
  const world = new World();
  const event: GameEvent = {
    timestamp: 1,
    type: "ability_changed",
    payload: {
      actorId: 1,
      abilityId: "native:seer_check",
      kind: "seer_check",
      operation: "granted",
      source: { kind: "native", role: Role.Seer },
      sourceDisclosed: false,
      startsOnDay: 1,
      maxUses: null,
    },
  };
  expect(buildAgentVisibleEvent(world, event, 1, 1)?.payload).toEqual({
    actorId: 1,
    abilityId: "native:seer_check",
    kind: "seer_check",
    operation: "granted",
    source: { kind: "native" },
    startsOnDay: 1,
    maxUses: null,
  });
  expect(buildAgentVisibleEvent(world, event, 2, 1)).toBeNull();
  const votes: GameEvent = {
    timestamp: 2,
    type: "vote_summary",
    payload: {
      votes: [{ actorId: 1, targetId: 2, abstain: false, weight: 1 }],
      tally: { 2: 1 },
      target: 2,
    },
  };
  expect(buildAgentVisibleEvent(world, votes, 1, 1)?.payload).toEqual({
    votes: [{ actorId: 1, targetId: 2, abstain: false, weight: 1 }],
    target: 2,
  });
});

test("custom lookup and callback stay after family policy, with the original receiver and result", () => {
  const trace: string[] = [];
  const world = new World();
  const event: GameEvent = {
    timestamp: 1,
    type: "phase_changed",
    payload: { phase: Phase.Day, day: 1 },
  };
  const rules = {
    get phase_changed() {
      trace.push("rule");
      return function (
        this: unknown,
        observedWorld: World,
        observedEvent: GameEvent,
        actorId: number,
      ) {
        trace.push("callback");
        expect(this).toBeUndefined();
        expect(observedWorld).toBe(world);
        expect(observedEvent).toBe(event);
        expect(actorId).toBe(2);
        return false;
      };
    },
    get wolf_discussion(): (world: World, event: GameEvent, actorId: number) => boolean {
      throw Error("historical_rule_must_precede_custom");
    },
  };
  const registry = new AgentEventVisibilityRegistry(rules);
  expect(registry.canView(world, event, 2)).toBe(false);
  expect(trace).toEqual(["rule", "callback"]);
  expect(
    registry.canView(
      world,
      {
        timestamp: 2,
        type: "wolf_discussion",
        audience: [2],
        payload: { actorId: 3, text: "raw", endChat: false, round: 1 },
      },
      2,
    ),
  ).toBe(true);
});

test("Demon identity query remains deferred and rejects before audience reads when the actor does not match", () => {
  const trace: string[] = [];
  const event = {
    timestamp: 1,
    type: "demon_hunter_chosen",
    get audience() {
      trace.push("audience");
      return [2];
    },
    payload: { actorId: 2 },
  } as unknown as GameEvent;
  const queries = {
    demonHunterActorId() {
      trace.push("identity");
      return 3;
    },
    custom() {
      trace.push("custom");
      return { handled: false } as const;
    },
  };
  expect(canViewAgentEvent(event, 2, queries)).toBe(false);
  expect(trace).toEqual(["identity"]);
  expect(
    canViewAgentEvent(
      { timestamp: 2, type: "phase_changed", payload: { phase: Phase.Day, day: 1 } },
      2,
      queries,
    ),
  ).toBe(true);
  expect(trace).toEqual(["identity", "custom"]);
});

// 自定义可见性回调得到既有同一个副本，允许的原回调副作用仍在字段投影之前可见。
test("the same event reaches custom visibility before projection and source fields follow the original callee lookup", () => {
  const trace: string[] = [];
  const event: GameEvent = {
    timestamp: 1,
    type: "ability_changed",
    payload: {
      actorId: 1,
      abilityId: "native:seer_check",
      kind: "seer_check",
      operation: "granted",
      source: { kind: "native", role: Role.Seer },
      sourceDisclosed: true,
      startsOnDay: 1,
      maxUses: null,
    },
  };
  const actual = projectAgentEvent(event, 1, 1, {
    canView(observed) {
      expect(observed).toBe(event);
      trace.push("visibility");
      Object.defineProperty(event.payload, "source", {
        enumerable: true,
        get() {
          trace.push("source");
          return { kind: "native", role: Role.Seer };
        },
      });
      Object.defineProperty(event.payload, "sourceDisclosed", {
        enumerable: true,
        get() {
          trace.push("disclosed");
          return false;
        },
      });
      return true;
    },
    projectAbilitySource(origin, disclosed) {
      trace.push("callee");
      return projectAbilitySource(origin(), disclosed());
    },
  });
  expect(trace).toEqual(["visibility", "callee", "source", "disclosed"]);
  expect(actual?.payload.source).toEqual({ kind: "native" });
});
