/**
 * 单元测试验证混血儿直接归属阶段、中立目标接收与同步选择所有权。输入为语言／目标／变化矩阵和局部夜间上下文；预期为阵营、身份、胜利、隐私与陈旧选择断言，已提交前缀的重入在阶段运行前被拒绝，不执行完整周期。
 */
import { createAliveComponent } from "../../../../src/game/observation/component-presentation";
import { renderRolePrompt } from "../../../../src/game/observation/role-presentation";
import { bindNativeNightFailurePolicy } from "../../../../src/rulesets/native-night-failure-policy";
import { bindNativeNightTargetPolicy } from "../../../../src/rulesets/native-night-target-policy";
import { bindNativeNightEffects } from "../../../../src/rulesets/native-night-effects";
import { bindNightAbilityActorQuery } from "../../../../src/game/mechanisms/roles/night-ability-actors";
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  Camp,
  COMPONENT,
  Phase,
  Role,
  WinCondition,
  createVictoryComponent,
  type ActionRequest,
  type BoardConfig,
  type GameEvent,
  type RoleComponent,
  type ToolCall,
} from "../../../../src/core";
import type { VictoryComponent } from "../../../../src/core/domain/components/victory";

import { StatusMarksComponent } from "../../../../src/core/domain/components/status_marks";
import { DamageResolutionSystem } from "../../../../src/core/domain/systems/damage_resolution_system";
import { ConditionRegistry } from "../../../../src/core/domain/registries/condition_registry";
import { sixPlayerMvpConfig } from "../../../../src/runtime/scenarios/six_player_mvp";
import { HYBRID_STAGE } from "../../../../src/game/mechanisms/roles/hybrid/night_stage";
import {
  getHybridState,
  projectHybridState,
} from "../../../../src/game/mechanisms/roles/hybrid/ports";
import { getDefaultRoleCatalog } from "../../../../src/game/mechanisms/roles/role-catalog-assembly";
import { resolveInspection } from "../../../../src/game/mechanisms/roles/inspection";
import {
  knownWolfTeammates,
  wolfTeamPermissions,
  wolfChatParticipants,
  wolfKnifeHolders,
} from "../../../../src/game/mechanisms/roles/wolf_team";
import { NightStageRegistry } from "../../../../src/game/mechanisms/stages/night/night_stage_registry";
import type { NightStageContext } from "../../../../src/game/mechanisms/stages/night/contracts";
import { NightPipeline } from "../../../../src/game/engine/phase_pipeline/night_pipeline";
import { ToolGateway } from "../../../../src/game/gateway/tool_gateway";
import { GameActionRequestFactory } from "../../../../src/game/engine/action_request_factory";
import { buildAgentVisibleEventFeed } from "../../../../src/game/engine/agent_visible_event_feed";
import { PlayerPromptPolicy } from "../../../../src/ai/agents/player/player_prompt_policy";
import {
  getDefaultConfigRenderRegistry,
  getDefaultPhaseStageLocalizationRegistry,
  getDefaultTargetHintRegistry,
  getDefaultToolSpecRegistry,
} from "../../../../src/game/mechanisms";
import { WinConditionRegistry } from "../../../../src/game/mechanisms/registries/win_condition_registry";
import { getDefaultScriptEventRenderRegistry } from "../../../../src/game/mechanisms/script/event_render_registry";
import { text } from "@ai-werewolf-arena/game-text";
import { hybridEventLabel } from "@ai-werewolf-arena/game-presentation";

const deck = [Role.Hybrid, Role.Wolf, Role.HiddenWolf, Role.Seer, Role.Witch, Role.Villager];

const board = (roles = deck): BoardConfig => ({
  ...sixPlayerMvpConfig,
  boardSize: roles.length,
  roleSetups: [...new Set(roles)].map((role) => ({
    role,
    count: roles.filter((r) => r === role).length,
  })),
  winConditions: [WinCondition.SlaughterCity],
  selfDestruct: { enabledWindows: [] },
});

const fixture = (roles = deck, locale: "zh-CN" | "en" = "en") => {
  const config = board(roles);
  return { ...bootstrapGame(config, { fixedRoles: roles, locale }), config };
};

const role = (game: ReturnType<typeof fixture>, id = 1) =>
  game.world.getComponent(id, COMPONENT.Role)!;

const victory = (game: ReturnType<typeof fixture>, id = 1) =>
  game.world.getComponent(id, COMPONENT.Victory)!;

const choose = (target_id: number): ToolCall => ({ name: "choose_exemplar", args: { target_id } });

function context(
  game: ReturnType<typeof fixture>,
  events: GameEvent[],
  getAction: NightStageContext["actionProvider"]["getAction"],
  day = 1,
  isCurrent = () => true,
): NightStageContext {
  const factory = new GameActionRequestFactory(game.world, events, day);
  return {
    world: game.world,
    get nightActors() {
      return bindNightAbilityActorQuery(this.world);
    },
    get nativeNightFailure() {
      return bindNativeNightFailurePolicy(() => this.world);
    },
    get nativeNightTargets() {
      return bindNativeNightTargetPolicy(() => this);
    },
    get nativeNightEffects() {
      return bindNativeNightEffects(() => this);
    },
    events,
    roleCatalog: getDefaultRoleCatalog(),
    toolGateway: new ToolGateway(),
    isCurrent,
    currentDay: () => day,
    previousExile: null,
    actionProvider: { getAction },
    makeRequest: (actorId, allowedTools, extra) =>
      factory.create({
        actorId,
        allowedTools,
        phase: Phase.Night,
        stage: extra.stage,
        requiresAction: extra.requiresAction ?? true,
        summary: { key: "request.summary.night_action" },
        context: extra,
      }),
    getAliveByRole: (r) => game.world.getAliveEntityIds().filter((id) => role(game, id).role === r),
    ensureMarks: (id) => game.world.getComponent(id, COMPONENT.StatusMarks)!,
    pickMajorityTarget: () => null,
    shuffleWolves: (ids) => ids,
    state: {
      wolfChatOrder: [],
      endedWolves: new Set(),
      wolfVotes: {},
      wolfTarget: null,
      seerChecks: [],
    },
  };
}

const policy = (game: ReturnType<typeof fixture>) =>
  new PlayerPromptPolicy(game.world, {
    boardConfig: game.config,
    roleCatalog: getDefaultRoleCatalog(),
    toolSpecRegistry: getDefaultToolSpecRegistry(),
    targetHintRegistry: getDefaultTargetHintRegistry(),
    phaseStageLocalizationRegistry: getDefaultPhaseStageLocalizationRegistry(),
    configRenderRegistry: getDefaultConfigRenderRegistry(),
  });

for (const locale of ["zh-CN", "en"] as const)
  for (const [target, faction] of [
    [2, "wolf"],
    [3, "wolf"],
    [4, "good"],
  ] as const)
    test(`${locale}/${target}: Hybrid commits true camp, keeps Good villager identity and exposes only its own choice`, async () => {
      const game = fixture(deck, locale),
        events: GameEvent[] = [],
        old = victory(game);
      expect(old.affiliations).toEqual([]);
      game.world.addComponent(
        target,
        COMPONENT.Victory,
        createVictoryComponent([
          { kind: "faction", faction: faction === "wolf" ? "good" : "wolf" },
        ]),
      );
      await HYBRID_STAGE.execute(
        context(game, events, async (request) => {
          expect(request.context.turn_constraints.min_valid_actions).toBe(1);
          expect(request.context.stage).toBe("hybrid");
          return choose(target);
        }),
      );
      expect(victory(game)).not.toBe(old);
      expect(old.affiliations).toEqual([]);
      expect(victory(game).affiliations).toEqual([{ kind: "faction", faction }]);
      expect(projectHybridState(getHybridState(role(game))!)).toEqual({
        remaining: 0,
        choice: { day: 1, targetId: target },
      });
      expect(role(game)).toMatchObject({ role: Role.Hybrid, camp: Camp.Good });
      expect(getDefaultRoleCatalog().requireMetadata(Role.Hybrid).goodSide).toBe("villager");
      expect(resolveInspection(game.world, 1, "camp", getDefaultRoleCatalog())).toEqual({
        kind: "camp",
        camp: "good",
      });
      expect(resolveInspection(game.world, 1, "role", getDefaultRoleCatalog())).toEqual({
        kind: "role",
        role: "hybrid",
      });
      expect(knownWolfTeammates(game.world, 1, getDefaultRoleCatalog())).toEqual([]);
      expect(knownWolfTeammates(game.world, 2, getDefaultRoleCatalog())).not.toContain(1);
      expect(wolfTeamPermissions(role(game), getDefaultRoleCatalog(), game.world)).toEqual({
        recognizedByPack: false,
        recognizes: "none",
        canChat: false,
        canVoteForKill: false,
      });
      expect(wolfChatParticipants(game.world, getDefaultRoleCatalog())).not.toContain(1);
      expect(wolfKnifeHolders(game.world, getDefaultRoleCatalog())).not.toContain(1);
      for (const actor of game.world.entityIds()) {
        const feed = buildAgentVisibleEventFeed(game.world, events, actor);
        expect(feed).toEqual(
          actor === 1
            ? [
                {
                  seq: 1,
                  type: "hybrid_exemplar_chosen",
                  payload: { actorId: 1, day: 1, targetId: target },
                },
              ]
            : [],
        );
        const request = context(game, events, async () => null).makeRequest(actor, ["speak"], {
          stage: "day_speech",
        });
        const observation = policy(game).buildObservation(request);
        expect(observation.ownState.hybrid).toEqual(
          actor === 1 ? { remaining: 0, choice: { day: 1, targetId: target } } : undefined,
        );
        expect(JSON.stringify(observation)).not.toContain('"affiliations"');
        expect(JSON.stringify(observation)).not.toContain('"faction"');
      }
      expect(events.find((e) => e.type === "hybrid_affiliation_resolved")!.payload).toEqual({
        actorId: 1,
        day: 1,
        targetId: target,
        faction,
      });
      const order = new NightStageRegistry().getStages(game.config, game.world);
      expect(order.find((s) => s.id === "hybrid")!.priority).toBe(110);
      expect(order.findIndex((s) => s.id === "hybrid")).toBeLessThan(
        order.findIndex((s) => s.id === "wolf_kill_vote"),
      );
      if (locale === "en")
        expect(renderRolePrompt(role(game), locale)).not.toMatch(/[\u4e00-\u9fff]/);
      role(game, target).camp = faction === "wolf" ? Camp.Good : Camp.Wolf;
      game.world.getComponent(target, COMPONENT.Alive)!.alive = false;
      game.world.getComponent(1, COMPONENT.Alive)!.alive = false;
      expect(victory(game).affiliations).toEqual([{ kind: "faction", faction }]);
      await HYBRID_STAGE.execute(
        context(
          game,
          events,
          async () => {
            throw new Error("no_reselect");
          },
          2,
        ),
      );
    });

test("invalid preflights are read-only and camp-neutral; a later valid retry spends exactly once", async () => {
  const game = fixture(),
    gateway = new ToolGateway(),
    state = getHybridState(role(game))!,
    asks: ActionRequest[] = [],
    events: GameEvent[] = [];
  for (const target of [2, 3, 4, 5, 6])
    expect(
      gateway.validateAndSanitize(game.world, 1, choose(target), { phase: Phase.Night, day: 1 }).ok,
    ).toBe(true);
  for (const target of [1, 0, 99, 2.5])
    expect(
      gateway.validateAndSanitize(game.world, 1, choose(target), { phase: Phase.Night, day: 1 }).ok,
    ).toBe(false);
  expect(
    gateway.validateAndSanitize(game.world, 1, choose(2), { phase: Phase.Day, day: 1 }).ok,
  ).toBe(false);
  expect(
    gateway.validateAndSanitize(game.world, 1, choose(2), { phase: Phase.Night, day: 2 }).ok,
  ).toBe(false);
  expect(state).toEqual({ remaining: 1, choice: null });
  expect(victory(game).affiliations).toEqual([]);
  await HYBRID_STAGE.execute(
    context(game, events, async (request) => {
      asks.push(request);
      return asks.length === 1 ? choose(1) : asks.length === 2 ? null : choose(2);
    }),
  );
  expect(asks.map((r) => r.context.retry_attempt ?? 0)).toEqual([0, 1, 2]);
  expect(state).toEqual({ remaining: 0, choice: { day: 1, targetId: 2 } });
  expect(
    gateway.validateAndSanitize(game.world, 1, choose(4), { phase: Phase.Night, day: 1 }).error,
  ).toBe("hybrid_unavailable");
  await HYBRID_STAGE.execute(
    context(game, events, async () => {
      throw new Error("spent");
    }),
  );
  expect(events.filter((e) => e.type === "hybrid_exemplar_chosen")).toHaveLength(1);
});

for (const invalid of ["pass", "dead", "no_targets"] as const)
  test(`${invalid}: missing required choice fails explicitly without default affiliation`, async () => {
    const game = fixture(),
      events: GameEvent[] = [];
    let calls = 0;
    game.world.getComponent(2, COMPONENT.Alive)!.alive = false;
    if (invalid === "no_targets")
      for (const id of [3, 4, 5, 6])
        game.world.getComponent(id, COMPONENT.Alive)!.alive = false;
    await expect(
      HYBRID_STAGE.execute(
        context(game, events, async () => {
          calls++;
          return invalid === "dead" ? choose(2) : null;
        }),
      ),
    ).rejects.toThrow("hybrid_valid_action_missing");
    expect(calls).toBe(invalid === "no_targets" ? 0 : 3);
    expect(victory(game).affiliations).toEqual([]);
    expect(getHybridState(role(game))).toEqual({ remaining: 1, choice: null });
    expect(events).toEqual([]);
  });

for (const point of ["await", "gateway"] as const)
  for (const change of [
    "clock",
    "actor_life",
    "actor_role",
    "actor_state",
    "actor_camp",
    "victory_component",
    "victory_push",
    "victory_array",
    "target_life",
    "target_role",
    "target_camp",
  ] as const)
    test(`${point}/${change}: stale Hybrid ownership cannot assign a new body or silently reveal target camp`, async () => {
      const game = fixture(),
        events: GameEvent[] = [],
        state = getHybridState(role(game))!,
        beforeVictory = victory(game);
      let current = true,
        calls = 0;
      const mutate = () => {
        if (change === "clock") current = false;
        if (change === "actor_life")
          game.world.addComponent(1, COMPONENT.Alive, createAliveComponent());
        if (change === "actor_role") game.world.addComponent(1, COMPONENT.Role, { ...role(game) });
        if (change === "actor_state")
          (role(game).privateState as Record<string, unknown>).hybrid = { ...state };
        if (change === "actor_camp") role(game).camp = Camp.Wolf;
        if (change === "victory_component")
          game.world.addComponent(1, COMPONENT.Victory, createVictoryComponent([]));
        if (change === "victory_push")
          beforeVictory.affiliations.push({ kind: "faction", faction: "wolf" });
        if (change === "victory_array") beforeVictory.affiliations = [];
        if (change === "target_life")
          game.world.addComponent(6, COMPONENT.Alive, createAliveComponent());
        if (change === "target_role")
          game.world.addComponent(6, COMPONENT.Role, { ...role(game, 6) });
        if (change === "target_camp")
          role(game, 6).camp = role(game, 6).camp === Camp.Good ? Camp.Wolf : Camp.Good;
      };
      const ctx = context(
        game,
        events,
        async () => {
          calls++;
          if (point === "await") mutate();
          return choose(6);
        },
        1,
        () => current,
      );
      if (point === "gateway") {
        const validate = ctx.toolGateway.validateAndSanitize.bind(ctx.toolGateway);
        ctx.toolGateway.validateAndSanitize = (world, actorId, call, validationContext) => {
          const result = validate(world, actorId, call, validationContext);
          mutate();
          return result;
        };
      }
      if (change.startsWith("target"))
        await expect(HYBRID_STAGE.execute(ctx)).rejects.toThrow("hybrid_valid_action_missing");
      else await HYBRID_STAGE.execute(ctx);
      expect(calls).toBe(change.startsWith("target") ? 3 : 1);
      expect(state).toEqual({ remaining: 1, choice: null });
      expect(events).toEqual([]);
    });

test("two pending Hybrid replies have one synchronous winner, and a committed full pipeline reentry is rejected", async () => {
  const game = fixture(),
    events: GameEvent[] = [],
    replies: Array<(action: ToolCall) => void> = [];
  const ctx = context(game, events, () => new Promise((resolve) => replies.push(resolve)));
  const first = HYBRID_STAGE.execute(ctx),
    second = HYBRID_STAGE.execute(ctx);
  expect(replies).toHaveLength(2);
  replies[0](choose(2));
  await first;
  replies[1](choose(6));
  await second;
  expect(getHybridState(role(game))).toEqual({ remaining: 0, choice: { day: 1, targetId: 2 } });
  expect(victory(game).affiliations).toEqual([{ kind: "faction", faction: "wolf" }]);
  expect(events).toHaveLength(2);
  const pipeline = new NightPipeline({
    world: game.world,
    events,
    toolGateway: new ToolGateway(),
    damageResolutionSystem: new DamageResolutionSystem(),
  });
  await expect(
    pipeline.execute(
      game.config,
      {
        async getAction() {
          throw new Error("must_not_ask");
        },
      },
      1,
    ),
  ).rejects.toThrow("hybrid_night_reentry_after_commit");
  expect(events).toHaveLength(2);
});

test("a Wolf-affiliated Hybrid still fills the villager side and true Good count; dead affiliation stays in final winners", async () => {
  const game = fixture(),
    events: GameEvent[] = [],
    registry = new ConditionRegistry(new WinConditionRegistry());
  await HYBRID_STAGE.execute(context(game, events, async () => choose(2)));
  const dead = (ids: number[]) =>
    ids.forEach((id) => {
      game.world.getComponent(id, COMPONENT.Alive)!.alive = false;
    });
  dead([6]);
  expect(registry.evaluate(game.world, WinCondition.SlaughterSide)).toBeNull();
  expect(registry.evaluate(game.world, WinCondition.WolfReachHalf)).toBeNull();
  dead([1]);
  const side = registry.evaluate(game.world, WinCondition.SlaughterSide)!;
  expect(side.reason).toBe("slaughter_side_completed");
  expect(side.outcome).toMatchObject({ winningPlayerIds: [1, 2, 3] });
  expect(registry.evaluate(game.world, WinCondition.SlaughterCity)).toBeNull();
  dead([4, 5]);
  expect(registry.evaluate(game.world, WinCondition.SlaughterCity)?.reason).toBe(
    "all_good_eliminated",
  );
  dead([2, 3]);
  for (const mode of [
    WinCondition.SlaughterCity,
    WinCondition.SlaughterSide,
    WinCondition.WolfReachHalf,
  ])
    expect(registry.evaluate(game.world, mode)).toMatchObject({
      winner: Camp.Good,
      reason: "all_wolves_eliminated",
      outcome: { winningPlayerIds: [4, 5, 6] },
    });
});

test("Hybrid labels are closed, bilingual and private-console gated; choice never implies physical faction change", () => {
  for (const locale of ["zh-CN", "en"] as const) {
    const event: GameEvent = {
        timestamp: 1,
        type: "hybrid_exemplar_chosen",
        payload: { actorId: 1, day: 1, targetId: 2 },
      },
      renderer = getDefaultScriptEventRenderRegistry();
    expect(renderer.toLiveRender(event, false, locale)).toEqual([]);
    expect(renderer.toLiveRender(event, true, locale)).toEqual([
      { kind: "private", text: hybridEventLabel(event.type, event.payload, locale)! },
    ]);
    for (const payload of [
      { ...event.payload, faction: "wolf" },
      { ...event.payload, day: 2 },
      { ...event.payload, targetId: 1 },
    ])
      expect(hybridEventLabel(event.type, payload, locale)).toBe(text(locale, "replay.unknown"));
    let reads = 0;
    const accessor = { ...event.payload };
    Object.defineProperty(accessor, "targetId", {
      enumerable: true,
      get() {
        reads++;
        return 2;
      },
    });
    expect(hybridEventLabel(event.type, accessor, locale)).toBe(text(locale, "replay.unknown"));
    expect(reads).toBe(0);
  }
});
