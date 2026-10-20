/**
 * 负责典狱长秘密事实、主持知识与终端/Web共用文案的独立边界验收；使用手写事实，不取生产结果充当oracle。
 * 特别核普通队友不能看到pair，参与者仅获对方座位与本人choice，God结算不进入任意玩家feed。
 * 验证层级为纯事实／投影单元与终端装配测试，不将God档席位筛选当权限过滤。
 */
import {
  prepareInertAgentEvent,
  type InertAgentEvent,
} from "../../../../src/agents/observation/agent-event-facts";
import { expect, test } from "bun:test";
import { Role, type GameEvent } from "@ai-werewolf-arena/game-contract";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { wardenTwelveConfig } from "../../../../src/rulesets/presets/warden-twelve";
import { WARDEN_POLICY } from "@ai-werewolf-arena/game-contract/facts/warden";
import { wardenEventLabel } from "@ai-werewolf-arena/game-presentation";
import { buildAgentVisibleEventFeed } from "../../../../src/agents/observation/event-feed";
import { getWardenState } from "../../../../src/features/warden/state";
import { projectWardenKnowledge } from "../../../../src/features/warden/presentation";
import {
  openWardenNight,
  commitWardenPair,
  commitWardenDecision,
} from "../../../../src/features/warden/authority";
import { COMPONENT } from "../../../../src/domain/components/names";
test("手写秘密受众与God边界，标签两语自然语言无JSON", () => {
  const f = bootstrapGame(wardenTwelveConfig),
    actor = f.world.getEntityIdsByRole(Role.Warden)[0]!,
    [a, b] = f.world.getEntityIdsByRole(Role.Villager) as [number, number];
  const events: GameEvent[] = [
    {
      timestamp: 1,
      type: "warden_pair_chosen",
      payload: { policy: WARDEN_POLICY, actorId: actor, day: 2, pair: [a, b] },
      audience: [actor],
    },
    {
      timestamp: 2,
      type: "warden_partner_notified",
      payload: { policy: WARDEN_POLICY, actorId: a, day: 2, partnerId: b },
      audience: [a],
    },
    {
      timestamp: 3,
      type: "warden_decision",
      payload: { policy: WARDEN_POLICY, actorId: a, day: 2, choice: "trade" },
      audience: [a],
    },
    {
      timestamp: 4,
      type: "warden_resolved",
      payload: {
        policy: WARDEN_POLICY,
        actorId: actor,
        day: 2,
        pair: [a, b],
        choices: ["trade", "betray"],
        outcome: "deal",
        dealIds: [a],
      },
      audience: [],
    },
  ];
  for (const id of f.playerIds) {
    const feed = buildAgentVisibleEventFeed(f.world, events, id);
    expect(feed.map((e) => e.type)).toEqual(
      id === actor
        ? ["warden_pair_chosen"]
        : id === a
          ? ["warden_partner_notified", "warden_decision"]
          : [],
    );
    expect(feed.every((e, i) => e.seq === i + 1)).toBe(true);
  }
  for (const locale of ["zh-CN", "en"] as const)
    for (const e of events) {
      const label = wardenEventLabel(e.type, e.payload, locale);
      expect(label).toBeTruthy();
      expect(label).not.toContain('{"');
    }
});
test("主持者自身知识不含他人choice/resolved；自己入局只带本人回执", () => {
  const f = bootstrapGame(wardenTwelveConfig),
    actor = f.world.getEntityIdsByRole(Role.Warden)[0]!,
    target = f.world.getEntityIdsByRole(Role.Villager)[0]!;
  openWardenNight(f.world, actor, 2);
  commitWardenPair(f.world, actor, 2, [actor, target], () => true);
  commitWardenDecision(f.world, actor, 2, "betray", () => true);
  commitWardenDecision(f.world, target, 2, "trade", () => true);
  const state = getWardenState(f.world.getComponent(actor, COMPONENT.Role))!;
  expect(projectWardenKnowledge(state, actor)).toEqual({
    policy: WARDEN_POLICY,
    forcePolicy: "awa_warden_partner_native_v1",
    history: [{ day: 2, pair: [actor, target], ownChoice: "betray" }],
  });
  expect(JSON.stringify(projectWardenKnowledge(state, actor))).not.toContain('"trade"');
  expect(JSON.stringify(projectWardenKnowledge(state, actor))).not.toContain("resolved");
});

test("prepared Warden协议payload保持原事实形状，不嵌套fact envelope", () => {
  const event: GameEvent = {
    timestamp: 1,
    type: "warden_partner_notified",
    payload: { policy: WARDEN_POLICY, day: 2, actorId: 2, partnerId: 3 },
    audience: [2],
  };
  const prepared = prepareInertAgentEvent(structuredClone(event) as InertAgentEvent);
  expect(prepared.projectionEvent).toEqual(event);
  expect(prepared.projectionEvent.payload).toEqual({
    policy: WARDEN_POLICY,
    day: 2,
    actorId: 2,
    partnerId: 3,
  });
  expect(prepared.projectionEvent.payload).not.toHaveProperty("payload");
  expect(prepared.fact?.reader).toBe("readWardenFact");
});
