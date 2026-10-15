/**
 * 单元测试负责暗夜星辰两族纯展示、五事实受众和本人知识白名单。输入手写原数据，输出两语标签/独立可见矩阵。
 * 用既有十二席World只承载事件投影，不运行新角色规则；付款不冒充实际死亡，God原伤害不进入本人DTO。
 */
import { expect, test } from "bun:test";
import { Phase, DeathCause, type GameEvent } from "@ai-werewolf-arena/game-contract";
import { AWAKENED_BEAUTY_POLICY as beautyPolicy } from "@ai-werewolf-arena/game-contract/facts/awakened-beauty";
import { AWAKENED_PATROL_POLICY as patrolPolicy } from "@ai-werewolf-arena/game-contract/facts/awakened-patrol";
import {
  awakenedBeautyEventLabel,
  awakenedPatrolEventLabel,
} from "@ai-werewolf-arena/game-presentation";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { awakenedWitchTwelveConfig } from "../../../../src/rulesets/presets/awakened-witch-twelve";
import { buildAgentVisibleEventFeed } from "../../../../src/agents/observation/event-feed";
import { getDefaultScriptEventRenderRegistry } from "../../../../src/agents/presentation/event-render-registry";
import { getDefaultPhaseStageLocalizationRegistry } from "../../../../src/rulesets/mechanism-api";
import {
  awakenedBeautyKnowledge,
  awakenedBeautyPromptState,
} from "../../../../src/features/awakened-wolf-beauty/presentation";
import { awakenedPatrolPromptState } from "../../../../src/features/awakened-hunter/presentation";
import {
  prepareInertAgentEvent,
  type InertAgentEvent,
} from "../../../../src/agents/observation/agent-event-facts";
const events: GameEvent[] = [
  {
    timestamp: 1,
    type: "awakened_charm_chosen",
    payload: { policy: beautyPolicy, day: 1, actorId: 3, targetId: 8, nextAllowedNight: 3 },
    audience: [3],
  },
  {
    timestamp: 2,
    type: "awakened_beauty_replacement_paid",
    payload: {
      policy: beautyPolicy,
      day: 1,
      actorId: 3,
      targetId: 8,
      phase: Phase.Voting,
      rootPhase: Phase.Voting,
      preventedCauses: [DeathCause.Exile],
    },
    audience: [],
  },
  {
    timestamp: 3,
    type: "awakened_beauty_replaced",
    payload: { policy: beautyPolicy, day: 1, actorId: 3, targetId: 8, targetDied: true },
  },
  {
    timestamp: 4,
    type: "awakened_patrol_paid",
    payload: {
      policy: patrolPolicy,
      day: 1,
      actorId: 8,
      rootPhase: Phase.Voting,
      direction: "counter_clockwise",
      targetId: 3,
    },
    audience: [8],
  },
  {
    timestamp: 5,
    type: "awakened_patrol_resolved",
    payload: {
      policy: patrolPolicy,
      day: 1,
      actorId: 8,
      direction: "counter_clockwise",
      targetId: 3,
    },
  },
];
for (const locale of ["zh-CN", "en"] as const)
  test(`五事实两语文案/终端私有开关/${locale}`, () => {
    const registry = getDefaultScriptEventRenderRegistry();
    for (const [i, e] of events.entries()) {
      const label = (i < 3 ? awakenedBeautyEventLabel : awakenedPatrolEventLabel)(
        e.type,
        e.payload,
        locale,
      )!;
      expect(label).not.toBeNull();
      expect(label).not.toMatch(/policy|targetId|undefined|NaN/);
      if (locale === "en") expect(label).not.toMatch(/\p{Script=Han}/u);
      expect(registry.toLiveRender(e, false, locale)).toEqual(
        i === 2 || i === 4 ? [{ kind: "system", text: label }] : [],
      );
      expect(registry.toLiveRender(e, true, locale)).toEqual([
        { kind: i === 1 ? "god" : i === 2 || i === 4 ? "system" : "private", text: label },
      ]);
      expect(
        (i < 3 ? awakenedBeautyEventLabel : awakenedPatrolEventLabel)(
          e.type,
          { ...e.payload, secret: true },
          locale,
        ),
      ).toBeNull();
    }
    for (const stage of ["awakened_charm", "awakened_patrol"])
      expect(getDefaultPhaseStageLocalizationRegistry().stageName(stage, locale)).not.toBe(stage);
  });
test("选择只本人、替死付款只God、真实替死及巡猎结果公开", () => {
  const f = bootstrapGame(structuredClone(awakenedWitchTwelveConfig));
  for (let id = 1; id <= 12; id++)
    expect(buildAgentVisibleEventFeed(f.world, events, id).map((e) => e.type)).toEqual([
      ...(id === 3 ? ["awakened_charm_chosen"] : []),
      "awakened_beauty_replaced",
      ...(id === 8 ? ["awakened_patrol_paid"] : []),
      "awakened_patrol_resolved",
    ]);
  for (const at of [0, 3])
    for (const audience of [undefined, null, [], [3, 8], [8, 3], [8, 8]]) {
      const malformed = { ...events[at], audience } as unknown as GameEvent;
      expect(buildAgentVisibleEventFeed(f.world, [malformed], at === 0 ? 3 : 8)).toEqual([]);
    }
  for (const at of [2, 4])
    for (const audience of [null, [], [3]])
      expect(
        buildAgentVisibleEventFeed(
          f.world,
          [{ ...events[at], audience } as unknown as GameEvent],
          3,
        ),
      ).toEqual([]);
  const prepared = prepareInertAgentEvent(structuredClone(events[0]) as InertAgentEvent);
  expect(prepared.projectionEvent.payload).toEqual(events[0]!.payload);
});
test("本人DTO逐字段白名单，不把God原伤害/根阶段投影出去", () => {
  const source = {
    policy: beautyPolicy,
    choices: [{ day: 1, targetId: 8 }],
    replacement: {
      day: 1,
      phase: Phase.Voting,
      rootPhase: Phase.Voting,
      targetId: 8,
      preventedCauses: [DeathCause.Exile],
    },
  };
  const k = awakenedBeautyKnowledge(source);
  expect(k).toEqual({
    policy: beautyPolicy,
    choices: [{ day: 1, targetId: 8 }],
    replacementUsed: true,
  });
  expect(JSON.stringify(k)).not.toMatch(/preventedCauses|rootPhase|replacement\"/);
  source.choices[0]!.targetId = 9;
  expect(k.choices[0]!.targetId).toBe(8);
  for (const locale of ["zh-CN", "en"] as const) {
    const beauty = awakenedBeautyPromptState(source, locale),
      patrol = awakenedPatrolPromptState(
        {
          policy: patrolPolicy,
          payment: { day: 1, rootPhase: Phase.Night, direction: "clockwise", targetId: 3 },
        },
        locale,
      );
    expect(beauty).not.toMatch(/preventedCauses|rootPhase|undefined/);
    expect(patrol).not.toMatch(/targetId|undefined|NaN/);
    if (locale === "en") {
      expect(beauty).not.toMatch(/\p{Script=Han}/u);
      expect(patrol).not.toMatch(/\p{Script=Han}/u);
    }
  }
});
test("受限bot只用显式魅惑候选，巡猎只选方向不获取狼位", async () => {
  const { ObservedBot } = await import("../../../../src/agents/providers/observed-bot");
  const { Role } = await import("@ai-werewolf-arena/game-contract");
  const base = {
    actorId: 3,
    phase: Phase.Night,
    allowedTools: ["awakened_charm"],
    context: {
      day: 1,
      stage: "awakened_charm",
      visible_events: [],
      awakened_charm_candidates: [8],
    },
  } as const;
  const observation = {
    request: base,
    self: { playerId: 3, role: Role.Wolf, camp: "wolf" },
    knownAliveIds: [3, 8, 9],
    teammateIds: [9],
    abilities: [],
    ownState: {},
  };
  const bot = new ObservedBot({ next: () => 0.1 }, "active");
  expect(await bot.decide(observation as never)).toEqual({
    name: "awakened_charm",
    args: { target_id: 8 },
  });
  const request = {
    ...base,
    phase: Phase.Voting,
    allowedTools: ["patrol"],
    context: { day: 1, stage: "awakened_patrol", visible_events: [], patrol_seat_order: [3, 8, 9] },
  };
  expect(await bot.decide({ ...observation, request } as never)).toEqual({
    name: "patrol",
    args: { direction: "clockwise" },
  });
  const conservative = new ObservedBot({ next: () => 0.1 }, "conservative");
  expect(await conservative.decide({ ...observation, request } as never)).toEqual({
    name: "patrol",
    args: { direction: null },
  });
});
test("原板本人观察冻结纯值且不把替死原伤害给队友或目标", async () => {
  const { awakenedDarkStarsTenConfig } =
    await import("../../../../src/rulesets/presets/awakened-dark-stars");
  const { COMPONENT } = await import("../../../../src/domain/components/names");
  const { capturePlayerObservation } =
    await import("../../../../src/agents/observation/player-observation-projector");
  const { getDefaultRoleCatalog } = await import("../../../../src/rulesets/mechanism-api");
  const stock = await import("../../../../src/features/awakened-wolf-beauty/state");
  const patrol = await import("../../../../src/features/awakened-hunter/state");
  const config = structuredClone(awakenedDarkStarsTenConfig),
    roles = config.roleSetups.flatMap(({ role, count }) => Array(count).fill(role));
  const f = bootstrapGame(config, { fixedRoles: roles });
  const role = f.world.getComponent(3, COMPONENT.Role)!;
  let old = stock.getAwakenedBeautyState(role)!;
  const choice = stock.prepareAwakenedBeautyState({
    policy: beautyPolicy,
    choices: [{ day: 1, targetId: 8 }],
    replacement: null,
  });
  stock.replaceAwakenedBeautyState(role, old, choice);
  old = choice;
  stock.replaceAwakenedBeautyState(
    role,
    old,
    stock.prepareAwakenedBeautyState({
      ...old,
      replacement: {
        day: 1,
        phase: Phase.Voting,
        rootPhase: Phase.Voting,
        targetId: 8,
        preventedCauses: [DeathCause.Exile],
      },
    }),
  );
  const hunterRole = f.world.getComponent(10, COMPONENT.Role)!,
    hOld = patrol.getAwakenedPatrolState(hunterRole)!;
  patrol.replaceAwakenedPatrolState(
    hunterRole,
    hOld,
    patrol.prepareAwakenedPatrolState({
      policy: patrolPolicy,
      payment: { day: 1, rootPhase: Phase.Voting, direction: "clockwise", targetId: 1 },
    }),
  );
  const queries = {
    world: () => f.world,
    role: (actor: () => number) => f.world.getComponent(actor(), COMPONENT.Role),
    catalog: () => getDefaultRoleCatalog(),
    wolfTeammates: () => [],
  };
  const request = {
    actorId: 3,
    phase: Phase.Voting,
    allowedTools: ["speak"],
    context: { day: 1, stage: "day_speech", visible_events: [], turn_constraints: {} },
  } as const;
  const b = capturePlayerObservation(request as never, queries).ownState.awakenedBeauty!;
  expect(b).toEqual({
    policy: beautyPolicy,
    choices: [{ day: 1, targetId: 8 }],
    replacementUsed: true,
  });
  expect(Object.isFrozen(b.choices)).toBe(true);
  expect(JSON.stringify(b)).not.toMatch(/preventedCauses|rootPhase|"phase"/);
  const h = capturePlayerObservation({ ...request, actorId: 10 } as never, queries).ownState
    .awakenedPatrol!;
  expect(h).toEqual({
    policy: patrolPolicy,
    payment: { day: 1, rootPhase: Phase.Voting, direction: "clockwise", targetId: 1 },
  });
  expect(Object.isFrozen(h.payment)).toBe(true);
  for (const id of [1, 8]) {
    const own = capturePlayerObservation({ ...request, actorId: id } as never, queries).ownState;
    expect(own.awakenedBeauty).toBeUndefined();
    expect(own.awakenedPatrol).toBeUndefined();
  }
});
test("原55原生捕获不扩中央分派，两新族custom仅消费脱离stateData", async () => {
  const { getDefaultRoleContributions } =
    await import("../../../../src/rulesets/roles/role-catalog-assembly");
  const all = getDefaultRoleContributions();
  expect(all.filter((c) => c.presentation.kind === "native")).toHaveLength(55);
  for (const [id, slot, state] of [
    [
      "awakened_wolf_beauty",
      "awakenedBeauty",
      { policy: beautyPolicy, choices: [], replacement: null },
    ],
    ["awakened_hunter", "awakenedPatrol", { policy: patrolPolicy, payment: null }],
  ] as const) {
    const contribution = all.find((c) => c.metadata.role === id)!;
    expect(contribution.presentation.kind).toBe("custom");
    if (contribution.presentation.kind !== "custom" || !contribution.presentation.renderPrompt)
      throw Error("expected_custom");
    const queries = new Proxy(
      { stateData: () => ({ [slot]: structuredClone(state) }) },
      {
        get(target, key) {
          if (key !== "stateData") throw Error("unexpected_runtime_query");
          return target.stateData;
        },
      },
    );
    expect(contribution.presentation.renderPrompt(queries as never, "en")).not.toMatch(
      /World|undefined|\p{Script=Han}/u,
    );
  }
});
