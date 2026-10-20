/**
 * 单元测试验证熊按原生命／座位采样只公布公开布尔值，并保持新鲜度和玩家历史边界。输入为原相邻位置、生命／阵营、语言及修改矩阵；有界 capture／publish／projection 的吼声、历史、隐私和原样本断言为预期，不运行完整夜或模型。
 */
import { createAliveComponent } from "../../../../src/agents/observation/component-presentation";
import { renderRolePrompt } from "../../../../src/agents/observation/role-presentation";
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  Role,
  Camp,
  Phase,
  WinCondition,
  COMPONENT,
  type BoardConfig,
  type RoleComponent,
  type ActionRequest,
  type GameEvent,
} from "../../../../src/domain";
import { sixPlayerMvpConfig } from "../../../../src/rulesets/presets/six-player-mvp";
import { BearNightFrame } from "../../../../src/features/bear/night-frame";
import { getBearState } from "../../../../src/features/bear/state";
import { RoleCatalog } from "../../../../src/rulesets/roles/catalog";
import {
  getDefaultRoleCatalog,
  getDefaultRoleContributions,
  createRoleCatalog,
} from "../../../../src/rulesets/roles/role-catalog-assembly";

import { createRoleComponent } from "../../../../src/agents/observation/role-presentation";
import type { IdentityComponent } from "../../../../src/domain/entities/player";
import { buildAgentVisibleEventFeed } from "../../../../src/agents/observation/event-feed";
import {
  getDefaultToolSpecRegistry,
  getDefaultTargetHintRegistry,
  getDefaultPhaseStageLocalizationRegistry,
  getDefaultConfigRenderRegistry,
} from "../../../../src/rulesets/mechanism-api";
import { PlayerPromptPolicy } from "../../../../src/agents/player/player-prompt-policy";
import { ActionReception } from "../../../../src/engine/actions/action-reception";

const deck = [Role.Bear, Role.Wolf, Role.Witch, Role.Hunter, Role.Villager, Role.Villager];

const config = (roles = deck): BoardConfig => ({
  ...sixPlayerMvpConfig,
  boardSize: roles.length,
  roleSetups: [...new Set(roles)].map((role) => ({
    role,
    count: roles.filter((r) => r === role).length,
  })),
  winConditions: [WinCondition.SlaughterSide],
  selfDestruct: { enabledWindows: [] },
});

const role = (game: ReturnType<typeof bootstrapGame>, id: number) =>
  game.world.getComponent(id, COMPONENT.Role)!;

function publish(game: ReturnType<typeof bootstrapGame>) {
  const events: GameEvent[] = [];
  BearNightFrame.capture(game.world, 1)!.publish(game.world, events, () => true);
  return events;
}

for (const [kind, expected] of [
  ["right", true],
  ["left", true],
  ["both", true],
  ["quiet", false],
  ["dead_skip", false],
  ["seat_order", false],
  ["single", true],
  ["empty", false],
] as const)
  test(`${kind}: night-start adjacency uses the unique living seat ring and publishes only the public boolean`, () => {
    const fixed =
      kind === "left"
        ? [Role.Bear, Role.Witch, Role.Hunter, Role.Villager, Role.Villager, Role.Wolf]
        : kind === "both"
          ? [Role.Bear, Role.Wolf, Role.Witch, Role.Hunter, Role.Villager, Role.Wolf]
          : kind === "quiet"
            ? [Role.Bear, Role.Witch, Role.Wolf, Role.Hunter, Role.Villager, Role.Villager]
            : deck;
    const game = bootstrapGame(config(fixed), { fixedRoles: fixed });
    if (kind === "dead_skip") game.world.getComponent(2, COMPONENT.Alive)!.alive = false;
    if (kind === "seat_order") {
      game.world.getComponent(2, COMPONENT.Identity)!.seat = 4;
      game.world.getComponent(4, COMPONENT.Identity)!.seat = 2;
    }
    if (kind === "single" || kind === "empty")
      for (const id of game.world.entityIds())
        if (id !== 1 && (kind === "empty" || id !== 2))
          game.world.getComponent(id, COMPONENT.Alive)!.alive = false;
    const events = publish(game);
    expect(events.map((event) => [event.type, event.payload])).toEqual([
      ["bear_roared", { day: 1, roared: expected }],
    ]);
    expect(getBearState(role(game, 1))).toEqual({ history: [{ day: 1, roared: expected }] });
    for (const actor of game.world.entityIds())
      expect(
        buildAgentVisibleEventFeed(game.world, events, actor).map((event) => event.payload),
      ).toEqual([{ day: 1, roared: expected }]);
  });

test("Bear sensing requires true Wolf faction, ignores Seer disguise, and respects its independent explicit role policy", () => {
  const game = bootstrapGame(config(), { fixedRoles: deck }),
    profiles = getDefaultRoleContributions(),
    wolf = profiles.find((p) => p.metadata.role === Role.Wolf)!;
  for (const [camp, sense, expected] of [
    [Camp.Wolf, undefined, true],
    [Camp.Wolf, () => false, false],
    [Camp.Good, () => true, false],
  ] as const) {
    game.world.getComponent(2, COMPONENT.Camp)!.camp = camp;
    const catalog = createRoleCatalog({
        contributions: profiles.map((p) =>
          p === wolf
            ? {
                ...p,
                runtime: {
                  ...p.runtime,
                  inspectionLabels: { camp: Camp.Good },
                  detectableByBear: sense,
                },
              }
            : p,
        ),
      }),
      events: GameEvent[] = [];
    (
      getBearState(role(game, 1))! as unknown as { history: { day: number; roared: boolean }[] }
    ).history = [];
    BearNightFrame.capture(game.world, 1, catalog)!.publish(game.world, events, () => true);
    expect(events[0].payload).toEqual({ day: 1, roared: expected });
  }
});

for (const mutation of [
  "clock",
  "life_replace",
  "revive",
  "role_replace",
  "state_replace",
  "faction",
] as const)
  test(`${mutation}: a revoked original Bear sample cannot publish or mutate old/new state`, () => {
    const game = bootstrapGame(config(), { fixedRoles: deck }),
      old = getBearState(role(game, 1))!,
      frame = BearNightFrame.capture(game.world, 1)!,
      events: GameEvent[] = [];
    if (mutation === "life_replace")
      game.world.addComponent(1, COMPONENT.Alive, createAliveComponent());
    if (mutation === "revive") {
      const life = game.world.getComponent(1, COMPONENT.Alive)!;
      life.alive = false;
      life.alive = true;
    }
    if (mutation === "role_replace") {
      const fresh = createRoleComponent(Role.Bear);
      getDefaultRoleCatalog().applyRuntime(fresh, {
        initialCamp: { camp: Camp.Good },
        currentCamp: () => game.world.getComponent(1, COMPONENT.Camp),
      });
      game.world.addComponent(1, COMPONENT.Role, fresh);
    }
    if (mutation === "state_replace")
      (role(game, 1).privateState as Record<string, unknown>).bear = { history: [] };
    if (mutation === "faction") game.world.getComponent(1, COMPONENT.Camp)!.camp = Camp.Wolf;
    frame.publish(game.world, events, () => mutation !== "clock");
    expect(events).toEqual([]);
    expect(old.history).toEqual([]);
    expect(getBearState(role(game, 1))!.history).toEqual([]);
  });

test("a sampled neighbor's later death does not resample; next night skips its dead seat and duplicate publication changes nothing", () => {
  const game = bootstrapGame(config(), { fixedRoles: deck }),
    frame = BearNightFrame.capture(game.world, 1)!,
    events: GameEvent[] = [];
  game.world.getComponent(2, COMPONENT.Alive)!.alive = false;
  frame.publish(game.world, events, () => true);
  frame.publish(game.world, events, () => true);
  BearNightFrame.capture(game.world, 1)!.publish(game.world, events, () => true);
  BearNightFrame.capture(game.world, 2)!.publish(game.world, events, () => true);
  expect(events.map((event) => event.payload)).toEqual([
    { day: 1, roared: true },
    { day: 2, roared: false },
  ]);
  expect(getBearState(role(game, 1))!.history).toEqual(
    events.filter((event) => event.type === "bear_roared").map((event) => event.payload),
  );
});

test("a manager frame belongs to its original World even if another controller reuses the same component references", () => {
  const first = bootstrapGame(config(), { fixedRoles: deck }),
    second = bootstrapGame(config(), { fixedRoles: deck }),
    frame = BearNightFrame.capture(first.world, 1)!,
    events: GameEvent[] = [];
  second.world.addComponent(1, COMPONENT.Role, role(first, 1));
  second.world.addComponent(1, COMPONENT.Alive, first.world.getComponent(1, COMPONENT.Alive)!);
  frame.publish(second.world, events, () => true);
  expect(events).toEqual([]);
  expect(getBearState(role(first, 1))!.history).toEqual([]);
  frame.publish(first.world, events, () => true);
  expect(events.map((e) => e.payload)).toEqual([{ day: 1, roared: true }]);
});

test("night role/state/faction or seat changes of neighbors do not rewrite the captured sample", () => {
  const game = bootstrapGame(config(), { fixedRoles: deck }),
    frame = BearNightFrame.capture(game.world, 1)!,
    events: GameEvent[] = [];
  game.world.getComponent(2, COMPONENT.Camp)!.camp = Camp.Good;
  game.world.getComponent(2, COMPONENT.Identity)!.seat = 4;
  frame.publish(game.world, events, () => true);
  BearNightFrame.capture(game.world, 2)!.publish(game.world, events, () => true);
  expect(events.map((event) => event.payload)).toEqual([
    { day: 1, roared: true },
    { day: 2, roared: false },
  ]);
});

for (const killedBefore of [false, true])
  test(`dead/${killedBefore}: the original dead Bear announces quiet, but a revived life never inherits that sample`, () => {
    const game = bootstrapGame(config(), { fixedRoles: deck }),
      life = game.world.getComponent(1, COMPONENT.Alive)!,
      events: GameEvent[] = [];
    if (killedBefore) life.alive = false;
    const frame = BearNightFrame.capture(game.world, 1)!;
    life.alive = false;
    frame.publish(game.world, events, () => true);
    expect(events.map((event) => event.payload)).toEqual([{ day: 1, roared: false }]);
    const next = BearNightFrame.capture(game.world, 2)!;
    life.alive = true;
    next.publish(game.world, events, () => true);
    expect(events).toHaveLength(1);
  });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: no active Bear tool or pack permission, no pending observation/history, and only already-public history reaches its own prompt`, () => {
    const game = bootstrapGame(config(), { locale, fixedRoles: deck }),
      policy = new PlayerPromptPolicy(game.world, {
        boardConfig: config(),
        roleCatalog: getDefaultRoleCatalog(),
        toolSpecRegistry: getDefaultToolSpecRegistry(),
        targetHintRegistry: getDefaultTargetHintRegistry(),
        phaseStageLocalizationRegistry: getDefaultPhaseStageLocalizationRegistry(),
        configRenderRegistry: getDefaultConfigRenderRegistry(),
      }),
      request: ActionRequest = {
        actorId: 1,
        phase: Phase.Day,
        allowedTools: ["speak"],
        context: { day: 1, stage: "day_speech", visible_events: [], turn_constraints: {} },
      },
      frame = BearNightFrame.capture(game.world, 1)!;
    expect(policy.buildObservation(request).ownState.bear).toEqual({ history: [] });
    expect(renderRolePrompt(role(game, 1), locale)).toContain(
      locale === "en" ? "No Bear announcement has been published" : "尚无已公布的熊公告",
    );
    expect(getDefaultRoleCatalog().requireRuntime(Role.Bear).toolSpecs ?? []).toEqual([]);
    expect(
      new ActionReception(game.world).validate(
        { ...request, phase: Phase.Night, allowedTools: ["kill_vote"] },
        "kill_vote",
        { target_id: 2, abstain: false },
      ).ok,
    ).toBe(false);
    const events: GameEvent[] = [];
    frame.publish(game.world, events, () => true);
    request.context.visible_events = buildAgentVisibleEventFeed(game.world, events, 1);
    expect(policy.buildObservation(request).ownState.bear).toEqual({
      history: [{ day: 1, roared: true }],
    });
    expect(renderRolePrompt(role(game, 1), locale)).toContain(
      locale === "en"
        ? "Latest public announcement: day 1, Bear roared."
        : "最近公开公告：第1天，熊咆哮了。",
    );
    expect(policy.buildObservation({ ...request, actorId: 3 }).ownState.bear).toBeUndefined();
  });
