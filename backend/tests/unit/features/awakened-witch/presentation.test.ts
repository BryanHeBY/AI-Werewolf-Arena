/**
 * 单元测试负责秘密调毒两语展示、五类受众及本人DTO白名单。输入是固定原板和手写事实，输出逐玩家可见矩阵。
 * 不由运行输出生成预期；God私态可含完整秘密，玩家观察和提示不得获得票、结果或其它组记录。
 */
import { expect, test } from "bun:test";
import { Role, Phase, type GameEvent, type ActionRequest } from "@ai-werewolf-arena/game-contract";
import { AWAKENED_WITCH_POLICY as policy } from "@ai-werewolf-arena/game-contract/facts/awakened-witch";
import { awakenedWitchEventLabel } from "@ai-werewolf-arena/game-presentation";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { awakenedWitchTwelveConfig } from "../../../../src/rulesets/presets/awakened-witch-twelve";
import { COMPONENT } from "../../../../src/domain/components/names";
import { buildAgentVisibleEventFeed } from "../../../../src/agents/observation/event-feed";
import { getDefaultScriptEventRenderRegistry } from "../../../../src/agents/presentation/event-render-registry";
import { capturePlayerObservation } from "../../../../src/agents/observation/player-observation-projector";
import {
  getDefaultRoleCatalog,
  getDefaultPhaseStageLocalizationRegistry,
} from "../../../../src/rulesets/mechanism-api";
import { buildPlayerStageContextHint } from "../../../../src/agents/observation/player-prompt-directives";
import { getDefaultConfigRenderRegistry } from "../../../../src/agents/prompt/config-render-registry";
import {
  getAwakenedWitchState,
  prepareAwakenedWitchState,
  replaceAwakenedWitchState,
} from "../../../../src/features/awakened-witch/state";
import { awakenedWitchPromptState } from "../../../../src/features/awakened-witch/presentation";
import { ObservedBot } from "../../../../src/agents/providers/observed-bot";
import {
  prepareInertAgentEvent,
  type InertAgentEvent,
} from "../../../../src/agents/observation/agent-event-facts";
function fixture() {
  const config = structuredClone(awakenedWitchTwelveConfig),
    roles = config.roleSetups.flatMap(({ role, count }) => Array<Role>(count).fill(role)),
    f = bootstrapGame(config, { fixedRoles: roles }),
    actor = 12,
    group = [6, 9],
    target = 2;
  const events: GameEvent[] = [
    {
      timestamp: 1,
      type: "awakened_brew_chosen",
      payload: {
        policy,
        day: 2,
        actorId: actor,
        mode: "poison",
        targetId: target,
        assistantIds: group,
        ordinal: 2,
      },
      audience: [actor],
    },
    {
      timestamp: 2,
      type: "brew_started",
      payload: { policy, day: 2, ordinal: 2, targetId: target, assistantIds: group },
      audience: group,
    },
    {
      timestamp: 3,
      type: "brew_discussion",
      payload: { policy, day: 2, ordinal: 2, actorId: 6, text: " RAW 🐺 " },
      audience: group,
    },
    {
      timestamp: 4,
      type: "brew_approval",
      payload: { policy, day: 2, ordinal: 2, actorId: 6, approve: false },
      audience: [6],
    },
    {
      timestamp: 5,
      type: "brew_resolved",
      payload: {
        policy,
        day: 2,
        ordinal: 2,
        actorId: actor,
        targetId: target,
        assistantIds: group,
        outcome: "vetoed",
      },
      audience: [],
    },
  ];
  const queries = {
    world: () => f.world,
    role: (id: () => number) => f.world.getComponent(id(), COMPONENT.Role),
    catalog: () => getDefaultRoleCatalog(),
    wolfTeammates: () => [],
  };
  return { ...f, actor, group, target, events, queries };
}
for (const locale of ["zh-CN", "en"] as const)
  test(`五类秘密事实标签和终端开关/${locale}`, () => {
    const f = fixture(),
      registry = getDefaultScriptEventRenderRegistry();
    for (const [i, e] of f.events.entries()) {
      const label = awakenedWitchEventLabel(e.type, e.payload, locale)!;
      expect(label).not.toBeNull();
      expect(label).not.toMatch(/targetId|undefined|NaN|policy/);
      if (locale === "en") expect(label).not.toMatch(/\p{Script=Han}/u);
      expect(registry.toLiveRender(e, false, locale)).toEqual([]);
      expect(registry.toLiveRender(e, true, locale)).toEqual([
        { kind: i === 4 ? "god" : "private", text: label },
      ]);
      expect(
        awakenedWitchEventLabel(e.type, { ...e.payload, actorRole: "seer" }, locale),
      ).toBeNull();
    }
    expect(awakenedWitchEventLabel("brew_discussion", f.events[2]!.payload, locale)).toContain(
      " RAW 🐺 ",
    );
    for (const stage of ["awakened_witch", "brew_discussion", "brew_approval"])
      expect(getDefaultPhaseStageLocalizationRegistry().stageName(stage, locale)).not.toBe(stage);
    expect(
      getDefaultConfigRenderRegistry().renderBoardConfigPrompt(awakenedWitchTwelveConfig, locale),
    ).toContain(locale === "en" ? "three-brew policy" : "觉醒女巫");
  });
test("Witch仅看本人选择，组只看聊天，批准只本人，God结果不入玩家feed", () => {
  const f = fixture();
  expect(buildAgentVisibleEventFeed(f.world, f.events, 12).map((e) => e.type)).toEqual([
    "awakened_brew_chosen",
  ]);
  expect(buildAgentVisibleEventFeed(f.world, f.events, 6).map((e) => e.type)).toEqual([
    "brew_started",
    "brew_discussion",
    "brew_approval",
  ]);
  expect(buildAgentVisibleEventFeed(f.world, f.events, 9).map((e) => e.type)).toEqual([
    "brew_started",
    "brew_discussion",
  ]);
  for (const id of [1, 2, 4, 5, 7, 8, 10, 11])
    expect(buildAgentVisibleEventFeed(f.world, f.events, id)).toEqual([]);
  for (const audience of [null, undefined, [], [9, 6], [6, 6], [6, 9, 12]])
    expect(
      buildAgentVisibleEventFeed(
        f.world,
        [{ ...f.events[1]!, audience } as unknown as GameEvent],
        6,
      ),
    ).toEqual([]);
  const prepared = prepareInertAgentEvent(structuredClone(f.events[1]!) as InertAgentEvent);
  expect(prepared.projectionEvent.payload).toEqual(f.events[1]!.payload);
  expect(prepared.projectionEvent.payload).not.toHaveProperty("payload");
});
for (const locale of ["zh-CN", "en"] as const)
  test(`本人资源只投已付选择，不投秘密聊天/票/结果/${locale}`, () => {
    const f = fixture(),
      role = f.world.getComponent(12, COMPONENT.Role)!,
      old = getAwakenedWitchState(role)!;
    const full = prepareAwakenedWitchState([
      {
        day: 1,
        mode: "poison",
        ordinal: 1,
        targetId: 2,
        assistantIds: [9],
        discussions: [{ actorId: 9, text: "INTERNAL_SECRET" }],
        approvals: [{ actorId: 9, approve: false }],
        outcome: "vetoed",
      },
    ]);
    replaceAwakenedWitchState(role, old, full);
    const request: ActionRequest = {
      actorId: 12,
      phase: Phase.Night,
      allowedTools: ["awakened_brew"],
      context: { day: 2, stage: "awakened_witch", visible_events: [], turn_constraints: {} },
    };
    const view = capturePlayerObservation(request, f.queries),
      k = view.ownState.awakenedWitch!;
    expect(k).toEqual({
      policy,
      healRemaining: 1,
      brewRemaining: 2,
      usedAssistantIds: [9],
      history: [{ day: 1, mode: "poison", ordinal: 1, targetId: 2, assistantIds: [9] }],
    });
    expect(Object.isFrozen(k.history)).toBe(true);
    expect(JSON.stringify(k)).not.toMatch(/INTERNAL_SECRET|approve|outcome|discussion|vetoed/);
    expect(awakenedWitchPromptState(full, locale)).not.toContain("INTERNAL_SECRET");
    const alternate = prepareAwakenedWitchState([
      {
        day: 1,
        mode: "poison",
        ordinal: 1,
        targetId: 2,
        assistantIds: [9],
        discussions: [{ actorId: 9, text: "DIFFERENT_SECRET" }],
        approvals: [{ actorId: 9, approve: true }],
        outcome: "poison",
      },
    ]);
    expect(awakenedWitchPromptState(full, locale)).toBe(
      awakenedWitchPromptState(alternate, locale),
    );
    expect(
      capturePlayerObservation({ ...request, actorId: 9 }, f.queries).ownState.awakenedWitch,
    ).toBeUndefined();
  });
for (const locale of ["zh-CN", "en"] as const)
  test(`候选提示与受限bot仅用已告知选项/${locale}`, async () => {
    const f = fixture(),
      request: ActionRequest = {
        actorId: 12,
        phase: Phase.Night,
        allowedTools: ["awakened_brew"],
        context: {
          day: 2,
          stage: "awakened_witch",
          visible_events: [],
          turn_constraints: {},
          awakened_brew_options: {
            healRemaining: 0,
            brewRemaining: 2,
            usedAssistantIds: [9],
            targetIds: [5, 8],
            assistantIds: [6, 7],
            requiredAssistants: 2,
            canHeal: false,
            canPoison: true,
          },
        },
      };
    const view = capturePlayerObservation(request, f.queries),
      bot = new ObservedBot({ next: () => 0 }, "active", locale);
    expect(await bot.decide(view)).toEqual({
      name: "awakened_brew",
      args: { mode: "poison", target_id: 5, assistant_ids: [6, 7] },
    });
    expect(await new ObservedBot({ next: () => 0 }, "conservative", locale).decide(view)).toEqual({
      name: "awakened_brew",
      args: { mode: "pass", target_id: null, assistant_ids: [] },
    });
    const ports = {
      locale: () => locale,
      boardConfig: () => {
        throw Error("unexpected_world_read");
      },
    };
    expect(buildPlayerStageContextHint(request, ports)).toContain("5, 8");
    const group = { ordinal: 2 as const, targetId: 5, assistantIds: [6, 7] };
    for (const [stage, tool] of [
      ["brew_discussion", "brew_discuss"],
      ["brew_approval", "brew_approve"],
    ] as const) {
      const req: ActionRequest = {
        actorId: 6,
        phase: Phase.Night,
        allowedTools: [tool],
        context: {
          day: 2,
          stage,
          visible_events: [],
          turn_constraints: {},
          brew_collaboration: group,
        },
      };
      const action = await bot.decide(capturePlayerObservation(req, f.queries));
      expect(action?.name).toBe(tool);
      expect(buildPlayerStageContextHint(req, ports)).toContain("6, 7");
    }
  });
