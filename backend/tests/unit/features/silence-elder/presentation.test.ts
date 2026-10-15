/**
 * 单元测试负责用字面事实验证双语展示、逐玩家受众与观察策略，不从生产输出生成预期。
 * 输入是固定原生板及独立动作/译文；原文保留、匿名公告和God隔离是主要反例，未调用模型。
 */
import { expect, test } from "bun:test";
import { Phase, Role, type GameEvent, type ActionRequest } from "@ai-werewolf-arena/game-contract";
import { SILENCE_ELDER_POLICY as policy } from "@ai-werewolf-arena/game-contract/facts/silence-elder";
import { silenceElderEventLabel } from "@ai-werewolf-arena/game-presentation";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { silenceElderTwelveConfig } from "../../../../src/rulesets/presets/silence-elder-twelve";
import { COMPONENT } from "../../../../src/domain/components/names";
import { buildAgentVisibleEventFeed } from "../../../../src/agents/observation/event-feed";
import { getDefaultScriptEventRenderRegistry } from "../../../../src/agents/presentation/event-render-registry";
import { getDefaultRoleContributions } from "../../../../src/rulesets/roles/role-catalog-assembly";
import { getDefaultPhaseStageLocalizationRegistry } from "../../../../src/agents/presentation/phase-stage-localization-registry";
import { buildPlayerStageContextHint } from "../../../../src/agents/observation/player-prompt-directives";
import { getDefaultConfigRenderRegistry } from "../../../../src/agents/prompt/config-render-registry";
import { capturePlayerObservation } from "../../../../src/agents/observation/player-observation-projector";
import { getDefaultRoleCatalog } from "../../../../src/rulesets/mechanism-api";
import { ObservedBot } from "../../../../src/agents/providers/observed-bot";
import { silenceElderPromptState } from "../../../../src/features/silence-elder/presentation";

function fixture() {
  const f = bootstrapGame(structuredClone(silenceElderTwelveConfig));
  const actor = f.world
    .entityIds()
    .find((id) => f.world.getComponent(id, COMPONENT.Role)?.role === Role.SilenceElder)!;
  const target = f.world.entityIds().find((id) => id !== actor)!;
  const translator = f.world.entityIds().find((id) => id !== actor && id !== target)!;
  const events: GameEvent[] = [
    {
      timestamp: 1,
      type: "silence_chosen",
      payload: { policy, day: 1, actorId: actor, targetId: target, translatorId: translator },
      audience: [actor],
    },
    {
      timestamp: 2,
      type: "silence_announced",
      payload: { policy, day: 1, targetId: target, translatorId: translator },
    },
    {
      timestamp: 3,
      type: "silence_gesture",
      payload: { policy, day: 1, actorId: target, round: "day", description: "  🐺 → ?  " },
    },
    {
      timestamp: 4,
      type: "silence_translated",
      payload: {
        policy,
        day: 1,
        actorId: translator,
        targetId: target,
        round: "day",
        text: "  My interpretation.  ",
      },
    },
    {
      timestamp: 5,
      type: "silence_translation_declined",
      payload: { policy, day: 1, actorId: translator, targetId: target, round: "pk" },
      audience: [translator],
    },
    {
      timestamp: 6,
      type: "silence_expired",
      payload: { policy, day: 1, targetId: target },
      audience: [],
    },
  ];
  return { ...f, actor, target, translator, events };
}
for (const locale of ["zh-CN", "en"] as const)
  test(`双语标签、原文及终端私有开关/${locale}`, () => {
    const { events } = fixture(),
      registry = getDefaultScriptEventRenderRegistry();
    for (const [i, e] of events.entries()) {
      const label = silenceElderEventLabel(e.type, e.payload, locale)!;
      expect(label).not.toBeNull();
      expect(label).not.toMatch(/undefined|NaN|actorId|policy/);
      if (locale === "en") expect(label).not.toMatch(/\p{Script=Han}/u);
      expect(registry.toLiveRender(e, true, locale)[0]!.text).toBe(label);
      expect(registry.toLiveRender(e, false, locale)).toHaveLength([1, 2, 3].includes(i) ? 1 : 0);
      expect(
        silenceElderEventLabel(e.type, { ...e.payload, privateReceipt: "secret" }, locale),
      ).toBeNull();
    }
    expect(silenceElderEventLabel(events[2]!.type, events[2]!.payload, locale)).toContain(
      "  🐺 → ?  ",
    );
    expect(silenceElderEventLabel(events[3]!.type, events[3]!.payload, locale)).toContain(
      "  My interpretation.  ",
    );
    expect(silenceElderEventLabel(events[3]!.type, events[3]!.payload, locale)).toContain(
      locale === "en" ? "personal interpretation" : "个人解读",
    );
    const plain = silenceElderPromptState(
      { policy, history: [{ day: 1, targetId: 2, translatorId: null }] },
      locale,
    );
    expect(plain).toContain("2");
    expect(plain).not.toContain("targetId");
  });
test("匿名公告不认证长老；私选、拒译与过期严格各自受众", () => {
  const { world, actor, target, translator, events } = fixture(),
    original = structuredClone(events);
  for (const id of world.entityIds()) {
    const types = buildAgentVisibleEventFeed(world, events, id).map((e) => e.type);
    expect(types).toEqual([
      ...(id === actor ? ["silence_chosen"] : []),
      "silence_announced",
      "silence_gesture",
      "silence_translated",
      ...(id === translator ? ["silence_translation_declined"] : []),
    ]);
  }
  expect(events).toEqual(original);
  for (const malformed of [
    { ...events[0]!, audience: [target] },
    { ...events[0]!, audience: [actor, target] },
    { ...events[1]!, payload: { ...events[1]!.payload, actorId: actor } },
    { ...events[1]!, audience: [target] },
  ])
    expect(buildAgentVisibleEventFeed(world, [malformed as GameEvent], actor)).toEqual([]);
});
test("自定义展示保持值查询；观察只含自身历史且脱离冻结", () => {
  const { world, actor, target } = fixture();
  expect(
    getDefaultRoleContributions().find((x) => x.metadata.role === Role.SilenceElder)!.presentation
      .kind,
  ).toBe("custom");
  const request: ActionRequest = {
    actorId: actor,
    phase: Phase.Night,
    allowedTools: ["silence"],
    context: {
      day: 1,
      stage: "silence_elder",
      visible_events: [],
      turn_constraints: {},
      silence_candidates: [target, actor],
    },
  };
  const queries = {
    world: () => world,
    role: (id: () => number) => world.getComponent(id(), COMPONENT.Role),
    catalog: () => getDefaultRoleCatalog(),
    wolfTeammates: () => [],
  };
  const view = capturePlayerObservation(request, queries);
  expect(view.ownState.silenceElder).toEqual({ policy, history: [] });
  expect(Object.isFrozen(view.ownState.silenceElder!.history)).toBe(true);
  expect(
    capturePlayerObservation({ ...request, actorId: target }, queries).ownState.silenceElder,
  ).toBeUndefined();
});
for (const locale of ["zh-CN", "en"] as const)
  test(`三个阶段、候选提示与bot仅用已知候选/${locale}`, async () => {
    const { world, actor, target, translator } = fixture();
    const queries = {
      world: () => world,
      role: (id: () => number) => world.getComponent(id(), COMPONENT.Role),
      catalog: () => getDefaultRoleCatalog(),
      wolfTeammates: () => [],
    };
    const base: ActionRequest = {
      actorId: actor,
      phase: Phase.Night,
      allowedTools: ["silence"],
      context: {
        day: 1,
        stage: "silence_elder",
        visible_events: [],
        turn_constraints: {},
        silence_candidates: [target, translator],
      },
    };
    const view = capturePlayerObservation(base, queries);
    const bot = new ObservedBot({ next: () => 0 }, "active", locale);
    expect(await bot.decide(view)).toEqual({
      name: "silence",
      args: { target_id: target, translator_id: translator },
    });
    expect(await new ObservedBot({ next: () => 0 }, "conservative", locale).decide(view)).toEqual({
      name: "silence",
      args: { target_id: target, translator_id: null },
    });
    for (const stage of ["silence_elder", "silence_gesture", "silence_translation"])
      expect(getDefaultPhaseStageLocalizationRegistry().stageName(stage, locale)).not.toBe(stage);
    const ports = {
      locale: () => locale,
      boardConfig: () => {
        throw new Error("unexpected_world_read");
      },
    };
    expect(buildPlayerStageContextHint(base, ports)).toContain(`${target}, ${translator}`);
    const gesture: ActionRequest = {
      ...base,
      phase: Phase.Day,
      allowedTools: ["gesture"] as ["gesture"],
      context: {
        ...base.context,
        stage: "silence_gesture",
        silence_candidates: undefined,
        silence_target_id: target,
        silence_round: "day" as const,
      },
    };
    const translation: ActionRequest = {
      ...gesture,
      allowedTools: ["translate_silence"] as ["translate_silence"],
      context: {
        ...gesture.context,
        stage: "silence_translation",
        silence_gesture_description: "  🐺 → ?  ",
      },
    };
    expect(buildPlayerStageContextHint(translation, ports)).toContain("  🐺 → ?  ");
    for (const req of [gesture, translation]) {
      const action = await bot.decide(capturePlayerObservation(req, queries));
      expect(action).not.toBeNull();
      if (locale === "en") expect(JSON.stringify(action)).not.toMatch(/\p{Script=Han}/u);
    }
    expect(
      getDefaultConfigRenderRegistry().renderBoardConfigPrompt(silenceElderTwelveConfig, locale),
    ).toContain(locale === "en" ? "Silencing Elder" : "禁言长老");
  });

import {
  prepareInertAgentEvent,
  type InertAgentEvent,
} from "../../../../src/agents/observation/agent-event-facts";
test("畸形私有受众拒绝且prepared payload不保家族wrapper", () => {
  const { world, actor, events } = fixture();
  for (const audience of [null, undefined, "wrong", {}, [actor, actor]])
    expect(
      buildAgentVisibleEventFeed(
        world,
        [{ ...events[0]!, audience } as unknown as GameEvent],
        actor,
      ),
    ).toEqual([]);
  const e = structuredClone(events[1]!) as InertAgentEvent,
    prepared = prepareInertAgentEvent(e);
  if (e.type !== "silence_announced" || prepared.projectionEvent.type !== "silence_announced")
    throw new Error("literal_silence_announced_expected");
  expect(prepared.projectionEvent.payload).toEqual({
    policy,
    day: 1,
    targetId: e.payload.targetId,
    translatorId: e.payload.translatorId,
  });
  expect(prepared.projectionEvent.payload).not.toHaveProperty("payload");
  Object.assign(e.payload, { targetId: 99 });
  expect(prepared.projectionEvent.payload.targetId).not.toBe(99);
});
