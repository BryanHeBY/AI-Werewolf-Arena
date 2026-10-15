/**
 * 单元测试负责双语与受众，以字面狼爪事实核双方私有、本人消费及God失效，不使用生产输出生成预期。
 * 实际固定板与一次原窗口传授用于核自己库存投影，其他狼不会复制获赠信息或持爪来源。
 */
import { expect, test } from "bun:test";
import { Role, Phase, type GameEvent, type ActionRequest } from "@ai-werewolf-arena/game-contract";
import { AWAKENED_CLAW_POLICY as policy } from "@ai-werewolf-arena/game-contract/facts/awakened-claws";
import { awakenedClawEventLabel } from "@ai-werewolf-arena/game-presentation";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { awakenedWolfKingTenConfig } from "../../../../src/rulesets/presets/awakened-wolf-king";
import { COMPONENT } from "../../../../src/domain/components/names";
import { buildAgentVisibleEventFeed } from "../../../../src/agents/observation/event-feed";
import { getDefaultScriptEventRenderRegistry } from "../../../../src/agents/presentation/event-render-registry";
import {
  getDefaultRoleCatalog,
  getDefaultPhaseStageLocalizationRegistry,
} from "../../../../src/rulesets/mechanism-api";
import { getDefaultRoleContributions } from "../../../../src/rulesets/roles/role-catalog-assembly";
import {
  openClawBequest,
  commitClawBequest,
} from "../../../../src/features/awakened-wolf-king/bequest-authority";
import { awakenedClawPromptState } from "../../../../src/features/awakened-wolf-king/presentation";
import { capturePlayerObservation } from "../../../../src/agents/observation/player-observation-projector";
import {
  buildPlayerStageContextHint,
  buildPlayerStatusDirective,
} from "../../../../src/agents/observation/player-prompt-directives";
import { getDefaultConfigRenderRegistry } from "../../../../src/agents/prompt/config-render-registry";
import {
  prepareInertAgentEvent,
  type InertAgentEvent,
} from "../../../../src/agents/observation/agent-event-facts";
function fixture() {
  const config = structuredClone(awakenedWolfKingTenConfig),
    roles = config.roleSetups.flatMap(({ role, count }) => Array<Role>(count).fill(role)),
    game = bootstrapGame(config, { fixedRoles: roles }),
    king = game.world.getEntityIdsByRole(Role.AwakenedWolfKing)[0]!,
    wolves = game.world.getEntityIdsByRole(Role.Wolf),
    target = wolves[0]!,
    other = wolves[1]!;
  const unitId = "awakened_claw:native:1",
    receivedUnitId = `awakened_claw:bequest:${king}:1:1`;
  const events: GameEvent[] = [
    {
      timestamp: 1,
      type: "awakened_claw_bequeathed",
      payload: { policy, day: 1, actorId: king, targetId: target, unitId, receivedUnitId },
      audience: [king, target].sort((a, b) => a - b),
    },
    {
      timestamp: 2,
      type: "awakened_claw_spent",
      payload: { policy, day: 1, actorId: target, targetId: null, unitId: receivedUnitId },
      audience: [target],
    },
    {
      timestamp: 3,
      type: "awakened_claws_expired",
      payload: { policy, day: 1, actorId: king, unitIds: ["awakened_claw:native:2"] },
      audience: [],
    },
  ];
  return { ...game, king, target, other, events, config };
}
for (const locale of ["zh-CN", "en"] as const)
  test(`消费不等于死亡，两语自然文案及终端受众/${locale}`, () => {
    const { events } = fixture(),
      registry = getDefaultScriptEventRenderRegistry();
    for (const [index, e] of events.entries()) {
      const label = awakenedClawEventLabel(e.type, e.payload, locale)!;
      expect(label).not.toBeNull();
      expect(label).not.toMatch(/awakened_claw:|unitId|source|undefined|NaN/);
      if (locale === "en") expect(label).not.toMatch(/\p{Script=Han}/u);
      expect(registry.toLiveRender(e, true, locale)).toEqual([
        { kind: index === 2 ? "god" : "private", text: label },
      ]);
      expect(registry.toLiveRender(e, false, locale)).toEqual([]);
      expect(
        awakenedClawEventLabel(e.type, { ...e.payload, privateReceipt: "secret" }, locale),
      ).toBeNull();
    }
    const shoot = awakenedClawEventLabel(
      "awakened_claw_spent",
      { ...events[1]!.payload, targetId: 8 },
      locale,
    )!;
    expect(shoot).toContain(
      locale === "en" ? "actual death resolves separately" : "实际死亡另行结算",
    );
    expect(
      getDefaultPhaseStageLocalizationRegistry().stageName("awakened_claw_bequest", locale),
    ).not.toBe("awakened_claw_bequest");
    expect(
      getDefaultConfigRenderRegistry().renderBoardConfigPrompt(awakenedWolfKingTenConfig, locale),
    ).toContain(locale === "en" ? "Awakened Wolf King" : "觉醒狼王");
  });
test("其余狼也不能看传爪，公开player_shot不附库存或角色", () => {
  const { world, king, target, other, events } = fixture();
  expect(buildAgentVisibleEventFeed(world, events, king).map((e) => e.type)).toEqual([
    "awakened_claw_bequeathed",
  ]);
  expect(buildAgentVisibleEventFeed(world, events, target).map((e) => e.type)).toEqual([
    "awakened_claw_bequeathed",
    "awakened_claw_spent",
  ]);
  expect(buildAgentVisibleEventFeed(world, events, other)).toEqual([]);
  const publicShot: GameEvent = {
    timestamp: 4,
    type: "player_shot",
    payload: { actorId: target, targetId: 8 },
  };
  expect(buildAgentVisibleEventFeed(world, [publicShot], other)).toEqual([
    { seq: 1, type: "player_shot", payload: { actorId: target, targetId: 8 } },
  ]);
  for (const audience of [null, [], [king], [king, target, other], [king, target]])
    expect(
      buildAgentVisibleEventFeed(
        world,
        [{ ...events[0]!, audience } as unknown as GameEvent],
        king,
      ),
    ).toEqual([]);
  const prepared = prepareInertAgentEvent(structuredClone(events[0]!) as InertAgentEvent);
  expect(prepared.projectionEvent.payload).toEqual(events[0]!.payload);
  expect(prepared.projectionEvent.payload).not.toHaveProperty("payload");
});
for (const locale of ["zh-CN", "en"] as const)
  test(`原狼受传仅展示自己单位，不改变身份/${locale}`, () => {
    const f = fixture(),
      catalog = getDefaultRoleCatalog();
    openClawBequest(f.world, f.king, 1, catalog);
    commitClawBequest(f.world, f.king, 1, f.target, () => true);
    const request: ActionRequest = {
      actorId: f.target,
      phase: Phase.Night,
      allowedTools: ["kill_vote"],
      context: { day: 1, stage: "wolf_vote", visible_events: [], turn_constraints: {} },
    };
    const queries = {
      world: () => f.world,
      role: (id: () => number) => f.world.getComponent(id(), COMPONENT.Role),
      catalog: () => catalog,
      wolfTeammates: () => [f.king, f.other],
    };
    const view = capturePlayerObservation(request, queries);
    expect(view.identity.role).toBe(Role.Wolf);
    expect(view.ownState.awakenedClaws?.units).toHaveLength(1);
    expect(view.ownState.awakenedClaws?.bequests).toEqual([]);
    expect(Object.isFrozen(view.ownState.awakenedClaws!.units)).toBe(true);
    expect(
      capturePlayerObservation({ ...request, actorId: f.other }, queries).ownState.awakenedClaws,
    ).toBeUndefined();
    const description = awakenedClawPromptState(view.ownState.awakenedClaws!, locale);
    expect(description).toContain(locale === "en" ? "received claw" : "亲传狼爪");
    expect(description).not.toContain(
      locale === "en" ? "The Awakened Wolf King is" : "觉醒狼王属于",
    );
    const directive = buildPlayerStatusDirective(
      request,
      f.world.getComponent(f.target, COMPONENT.Role),
      {
        world: () => f.world,
        locale: () => locale,
        catalog: () => catalog,
        wolfTeammates: () => [f.king, f.other],
      },
    );
    expect(directive).toContain(description);
    expect(
      getDefaultRoleContributions().find((c) => c.metadata.role === Role.AwakenedWolfKing)!
        .presentation.kind,
    ).toBe("custom");
    const hint = buildPlayerStageContextHint(
      {
        ...request,
        allowedTools: ["bequeath_claw"],
        context: {
          ...request.context,
          stage: "awakened_claw_bequest",
          claw_bequest_candidates: [1, 4],
        },
      },
      {
        locale: () => locale,
        boardConfig: () => {
          throw new Error("unexpected_world_knowledge");
        },
      },
    );
    expect(hint).toContain("1, 4");
  });
