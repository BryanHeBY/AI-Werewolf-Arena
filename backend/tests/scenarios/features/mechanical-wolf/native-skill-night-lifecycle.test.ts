/**
 * 场景验证机械狼的学习、模式、库存及原身体撤权。每个用例至少完成一次真实 PhaseManager 夜；原资源回执、引用／getter／错误轨迹和事实为预期，不拆去前置夜后假称单元测试。受控 provider 保留原引擎时序，不生成新 golden。
 */
import { createAliveComponent } from "../../../../src/game/observation/component-presentation";
import { renderRolePrompt } from "../../../../src/game/observation/role-presentation";
import { bindNativeNightFailurePolicy } from "../../../../src/rulesets/native-night-failure-policy";
import { bindNativeNightTargetPolicy } from "../../../../src/rulesets/native-night-target-policy";
import { bindNativeNightEffects } from "../../../../src/rulesets/native-night-effects";
import { bindNightAbilityActorQuery } from "../../../../src/game/mechanisms/roles/night-ability-actors";
import { PotionType } from "../../../../src/core";
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  COMPONENT,
  Camp,
  Role,
  Phase,
  WinCondition,
  type BoardConfig,
  type RoleComponent,
  type ToolCall,
  type ActionRequest,
} from "../../../../src/core";
import { sixPlayerMvpConfig } from "../../../../src/runtime/scenarios/six_player_mvp";
import {
  getMechanicalState,
  projectMechanicalState,
} from "../../../../src/game/mechanisms/roles/mechanical_wolf/state";
import { getDefaultRoleCatalog } from "../../../../src/game/mechanisms/roles/role-catalog-assembly";
import { resolveInspection } from "../../../../src/game/mechanisms/roles/inspection";
import { canMechanicalKnife } from "../../../../src/game/mechanisms/roles/mechanical_wolf/inheritance";
import { buildAgentVisibleEventFeed } from "../../../../src/game/engine/agent_visible_event_feed";
import { ToolGateway } from "../../../../src/game/gateway/tool_gateway";
import { NightStageRegistry } from "../../../../src/game/mechanisms/stages/night/night_stage_registry";
import { ActionReception } from "../../../../src/game/gateway/action-reception";
import { MECHANICAL_NIGHT_STAGES } from "../../../../src/game/mechanisms/roles/mechanical_wolf/night_stages";
import { GameActionRequestFactory } from "../../../../src/game/engine/action_request_factory";
import type { NightStageContext } from "../../../../src/game/mechanisms/stages/night/contracts";

import { StatusMarksComponent } from "../../../../src/core/domain/components/status_marks";
import { DeathCause } from "../../../../src/core/domain/deaths";
import { grantNightAbility } from "../../../../src/game/mechanisms/roles/ability_changes";

const deck = [Role.MechanicalWolf, Role.Wolf, Role.Psychic, Role.Witch, Role.Guard, Role.Villager];

function board(roles = deck): BoardConfig {
  return {
    ...sixPlayerMvpConfig,
    boardSize: roles.length,
    roleSetups: [...new Set(roles)].map((role) => ({
      role,
      count: roles.filter((r) => r === role).length,
    })),
    winConditions: [WinCondition.SlaughterCity],
    selfDestruct: { enabledWindows: [] },
  };
}

function fixture(locale: "zh-CN" | "en" = "zh-CN", roles = deck) {
  const config = board(roles),
    game = bootstrapGame(config, { fixedRoles: roles, locale });
  const role = game.world.getComponent(1, COMPONENT.Role)!;
  return { ...game, config, role, state: getMechanicalState(role)! };
}

type Game = ReturnType<typeof fixture>;

function play(
  game: Game,
  options: {
    learn?: number;
    mode?: "kill" | "skill" | null;
    skill?: ToolCall | null;
    day?: number;
    witch?: ToolCall;
    knife?: number | null;
    exile?: number | null;
    shot?: number | null;
    learnDay?: number;
  },
) {
  const requests: ActionRequest[] = [];
  return {
    requests,
    async getAction(request: ActionRequest): Promise<ToolCall | null> {
      requests.push(structuredClone(request));
      const { day, stage } = request.context;
      if (stage === "mechanical_mimic")
        return options.learn !== undefined && day === (options.learnDay ?? 1)
          ? { name: "mimic_role", args: { target_id: options.learn } }
          : null;
      if (stage === "mechanical_mode")
        return options.mode === null
          ? null
          : { name: "mechanical_mode", args: { mode: options.mode ?? "skill" } };
      if (stage === "mechanical_skill" || stage === "mechanical_attack")
        return options.skill ?? null;
      if (request.allowedTools.includes("speak_to_wolves"))
        return { name: "speak_to_wolves", args: { text: "End", end_chat: true } };
      if (request.allowedTools.includes("kill_vote"))
        return {
          name: "kill_vote",
          args: { target_id: options.knife ?? null, abstain: options.knife == null },
        };
      if (request.allowedTools.includes("guard"))
        return { name: "guard", args: { target_id: null, abstain: true } };
      if (request.allowedTools.includes("use_potion"))
        return (
          options.witch ?? {
            name: "use_potion",
            args: { target_id: request.actorId, potion_type: PotionType.None },
          }
        );
      if (request.allowedTools.includes("inspect_role"))
        return { name: "inspect_role", args: { target_id: 1 } };
      if (request.allowedTools.includes("speak"))
        return { name: "speak", args: { text: "Raw text" } };
      if (request.allowedTools.includes("vote"))
        return {
          name: "vote",
          args: { target_id: options.exile ?? null, abstain: options.exile == null },
        };
      if (request.allowedTools.includes("shoot"))
        return { name: "shoot", args: { target_id: options.shot ?? null } };
      throw new Error(`unexpected:${request.actorId}:${stage}`);
    },
  };
}

function stageContext(
  game: Game,
  day: number,
  getAction: NightStageContext["actionProvider"]["getAction"],
  isCurrent = () => true,
): NightStageContext {
  const events = [] as ReturnType<Game["phaseManager"]["getEvents"]>,
    factory = new GameActionRequestFactory(game.world, events, day);
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
    currentDay: () => day,
    isCurrent,
    previousExile: null,
    roleCatalog: getDefaultRoleCatalog(),
    toolGateway: new ToolGateway(),
    actionProvider: { getAction },
    makeRequest: (actorId, allowedTools, extras) =>
      factory.create({
        actorId,
        allowedTools,
        phase: Phase.Night,
        stage: extras.stage,
        requiresAction: extras.requiresAction ?? true,
        summary: { key: "request.summary.night_action" },
        context: extras,
      }),
    getAliveByRole: (role) =>
      game.world
        .getAliveEntityIds()
        .filter((id) => game.world.getComponent(id, COMPONENT.Role)?.role === role),
    ensureMarks: (id) => game.world.getComponent(id, COMPONENT.StatusMarks)!,
    pickMajorityTarget: () => null,
    shuffleWolves: (ids) => ids,
    state: {
      wolfChatOrder: [],
      endedWolves: new Set(),
      wolfVotes: {},
      wolfTarget: null,
      seerChecks: [],
      dreamLinks: [],
      poisonClaims: [],
      mechanicalEffects: { shields: [], attacks: [], failures: [] },
    },
  };
}

const mechanicalStage = (id: string) => MECHANICAL_NIGHT_STAGES.find((s) => s.id === id)!;

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: independent true-Wolf identity and strict stages with next-night learning`, async () => {
    const game = fixture(locale),
      provider = play(game, { learn: 5, exile: 2 });
    const stages = new NightStageRegistry().getStages(game.config, game.world);
    expect(
      stages.filter((s) => s.id.startsWith("mechanical_")).map((s) => [s.id, s.priority]),
    ).toEqual([
      ["mechanical_mode", 250],
      ["mechanical_mimic", 580],
      ["mechanical_skill", 650],
      ["mechanical_attack", 660],
    ]);
    await game.phaseManager.runSingleCycle(provider);
    expect(
      provider.requests
        .filter((r) => r.actorId === 1 && r.phase === Phase.Night)
        .map((r) => r.context.stage),
    ).toEqual(["mechanical_mimic"]);
    expect(game.role.role).toBe(Role.MechanicalWolf);
    expect(game.role.camp).toBe(Camp.Wolf);
    expect(game.state.learned).toEqual({
      targetId: 5,
      role: Role.Guard,
      day: 1,
      readyOnNight: 2,
      skill: { kind: "guard", lastTarget: null, lastGuardDay: null },
    });
    expect(game.state.firstKnifeNight).toBe(2);
    expect(game.state.hasInheritedKnife).toBe(true);
    expect(resolveInspection(game.world, 1, "role", getDefaultRoleCatalog())).toEqual({
      kind: "role",
      role: Role.Guard,
    });
    expect(resolveInspection(game.world, 1, "camp", getDefaultRoleCatalog())).toEqual({
      kind: "camp",
      camp: Camp.Wolf,
    });
    expect(canMechanicalKnife(game.role, game.world)).toBe(false);
    const events = game.phaseManager.getEvents();
    expect(events.filter((e) => e.type === "role_inspected").map((e) => e.payload)).toContainEqual({
      actorId: 3,
      targetId: 1,
      day: 1,
      result: { kind: "role", role: Role.Guard },
    });
    for (const id of game.world.entityIds()) {
      const feed = buildAgentVisibleEventFeed(game.world, events, id);
      expect(feed.filter((e) => e.type === "mechanical_mimicked")).toHaveLength(id === 1 ? 1 : 0);
      if (id === 1)
        expect(feed.some((e) => ["wolf_discussion", "wolf_tactical_order"].includes(e.type))).toBe(
          false,
        );
    }
    if (locale === "en") expect(renderRolePrompt(game.role, locale)).not.toMatch(/[\u4e00-\u9fff]/);
  });

test("default skill mode has no knife, while late learning in kill mode remains independent and waits until next night", async () => {
  const game = fixture();
  await game.phaseManager.runSingleCycle(play(game, { exile: 2 }));
  const second = play(game, { learn: 4, learnDay: 2, mode: "kill", knife: 6 });
  await game.phaseManager.runSingleCycle(second);
  expect(
    second.requests
      .filter((r) => r.actorId === 1 && r.phase === Phase.Night)
      .map((r) => r.context.stage),
  ).toEqual(["mechanical_mode", "wolf_vote", "mechanical_mimic"]);
  expect(game.state.learned?.readyOnNight).toBe(3);
  const third = play(game, { mode: null });
  await game.phaseManager.runSingleCycle(third);
  expect(game.state.mode).toEqual({ day: 3, kind: "skill" });
  expect(
    third.requests
      .filter((r) => r.actorId === 1 && r.phase === Phase.Night)
      .map((r) => r.context.stage),
  ).toEqual(["mechanical_mode", "mechanical_skill"]);
  expect(game.state.learned?.skill).toEqual({ kind: "poison", remaining: 1 });
});

test("one mechanical poison is source-bound, closes its turn and never creates an antidote or Witch knife prompt", async () => {
  const game = fixture();
  await game.phaseManager.runSingleCycle(play(game, { learn: 4, exile: 2 }));
  const second = play(game, {
    mode: "skill",
    skill: { name: "mechanical_poison", args: { target_id: 3 } },
  });
  await game.phaseManager.runSingleCycle(second);
  expect(game.state.learned?.skill).toEqual({ kind: "poison", remaining: 0 });
  expect(game.world.getAliveEntityIds()).toEqual([1, 4, 5, 6]);
  const request = second.requests.find((r) => r.context.stage === "mechanical_skill")!;
  expect(request.allowedTools).toEqual(["mechanical_poison"]);
  expect(request.context.wolf_target).toBeUndefined();
  expect(
    new ToolGateway().validateAndSanitize(
      game.world,
      1,
      { name: "mechanical_poison", args: { target_id: 5 } },
      { phase: Phase.Night, day: 2 },
    ),
  ).toMatchObject({ ok: false, error: "mechanical_unavailable" });
  const third = play(game, { mode: "skill" });
  await game.phaseManager.runSingleCycle(third);
  expect(third.requests.some((r) => r.context.stage === "mechanical_skill")).toBe(false);
});

test("mechanical Guard reflects a real Witch toxin to its original caster, with no player causal leak", async () => {
  const game = fixture();
  await game.phaseManager.runSingleCycle(play(game, { learn: 5, exile: 2 }));
  await game.phaseManager.runSingleCycle(
    play(game, {
      mode: "skill",
      skill: { name: "mechanical_guard", args: { target_id: 3 } },
      witch: { name: "use_potion", args: { target_id: 3, potion_type: PotionType.Poison } },
    }),
  );
  expect(game.world.getAliveEntityIds()).toEqual([1, 3, 5, 6]);
  const events = game.phaseManager.getEvents();
  expect(
    events.filter((e) => e.type === "mechanical_poison_reflected").map((e) => e.payload),
  ).toEqual([{ actorId: 1, day: 2, protectedTargetId: 3, casterId: 4 }]);
  for (const id of game.world.entityIds())
    expect(
      buildAgentVisibleEventFeed(game.world, events, id).some(
        (e) => e.type === "mechanical_poison_reflected",
      ),
    ).toBe(false);
  expect(JSON.stringify(projectMechanicalState(game.state))).not.toContain("casterId");
});

test("a legal consecutive mechanical guard fails at dawn and never skips the complete death resolution", async () => {
  const game = fixture();
  await game.phaseManager.runSingleCycle(play(game, { learn: 5, exile: 2 }));
  const choice = {
    mode: "skill" as const,
    skill: { name: "mechanical_guard" as const, args: { target_id: 3 } },
  };
  await game.phaseManager.runSingleCycle(play(game, choice));
  const provider = play(game, choice);
  await game.phaseManager.runSingleCycle(provider);
  expect(
    game.phaseManager
      .getEvents()
      .filter((e) => e.type === "mechanical_guard_chosen")
      .map((e) => e.payload.failed),
  ).toEqual([false, true]);
  expect(game.world.getAliveEntityIds()).toEqual([3, 4, 5, 6]);
  expect(game.phaseManager.getSnapshot().result?.winner).toBe(Camp.Good);
  expect(provider.requests.filter((r) => r.allowedTools.includes("shoot"))).toEqual([]);
});

test("an inherited extra knife can target independently and pierces ordinary Guard without changing Witch's base knife", async () => {
  const game = fixture();
  await game.phaseManager.runSingleCycle(play(game, { learn: 2, exile: 2 }));
  const provider = play(game, {
    mode: "kill",
    knife: 6,
    skill: { name: "mechanical_attack", args: { target_id: 3 } },
  });
  const action = provider.getAction.bind(provider);
  provider.getAction = async (request) =>
    request.allowedTools.includes("guard")
      ? { name: "guard", args: { target_id: 3, abstain: false } }
      : action(request);
  await game.phaseManager.runSingleCycle(provider);
  expect(game.world.getAliveEntityIds()).toEqual([1, 4, 5]);
  expect(
    provider.requests.find((r) => r.allowedTools.includes("use_potion"))?.context.wolf_target,
  ).toBe(6);
  expect(game.state.learned?.skill).toEqual({ kind: "wolf", extraKnife: "spent" });
});

test("learning Hunter gives a private passive gun next night, and actual exile gun resolves before final judgment", async () => {
  const roles = [
      Role.MechanicalWolf,
      Role.Wolf,
      Role.Hunter,
      Role.Witch,
      Role.Guard,
      Role.Villager,
    ],
    game = fixture("en", roles);
  await game.phaseManager.runSingleCycle(play(game, { learn: 3, exile: 2 }));
  expect(game.state.learned?.skill).toEqual({ kind: "hunter", armed: false, canShoot: true });
  const provider = play(game, { mode: "kill", exile: 1, shot: 4 });
  await game.phaseManager.runSingleCycle(provider);
  expect(
    provider.requests
      .filter((r) => r.actorId === 1 && r.allowedTools.includes("shoot"))
      .map((r) => [r.context.stage, r.context.death_sources]),
  ).toEqual([["death_shot", [DeathCause.Exile]]]);
  expect(
    game.phaseManager
      .getEvents()
      .filter((e) => e.type === "mechanical_shot")
      .map((e) => e.payload),
  ).toEqual([{ actorId: 1, targetId: 4 }]);
  expect(game.state.learned?.skill).toEqual({ kind: "hunter", armed: true, canShoot: false });
  expect(game.phaseManager.getSnapshot().result?.winner).toBe(Camp.Good);
  expect(game.world.getAliveEntityIds()).toEqual([3, 5, 6]);
  expect(game.world.activeDeathActionCount).toBe(0);
});

test("mechanical skills cannot preflight leak unsupported targets, mutate inventory or evade consecutive guard", async () => {
  const game = fixture();
  await game.phaseManager.runSingleCycle(play(game, { learn: 5, exile: 2 }));
  const request: ActionRequest = {
    actorId: 1,
    phase: Phase.Night,
    allowedTools: ["mechanical_guard"],
    context: { day: 2, stage: "mechanical_skill", visible_events: [], turn_constraints: {} },
  };
  const before = structuredClone(game.state);
  expect(
    new ActionReception(game.world).validate(request, "mechanical_guard", { target_id: 3 }),
  ).toMatchObject({ ok: false, error: "mechanical_unavailable" });
  expect(game.state).toEqual(before);
});

for (const forge of ["serialized", "revive", "switch_mode"] as const)
  test(`${forge}: active skill requires the original live accepted mode authority`, async () => {
    const game = fixture();
    await game.phaseManager.runSingleCycle(play(game, { learn: 5, exile: 2 }));
    const ctx = stageContext(game, 2, async () => ({
      name: "mechanical_guard",
      args: { target_id: 3 },
    }));
    if (forge === "serialized")
      (
        game.state as {
          mode: {
            day: number;
            kind: import("@ai-werewolf-arena/game-contract").MechanicalMode;
          } | null;
        }
      ).mode = { day: 2, kind: "skill" };
    else {
      ctx.actionProvider = {
        async getAction() {
          return {
            name: "mechanical_mode",
            args: { mode: forge === "switch_mode" ? "kill" : "skill" },
          };
        },
      };
      await mechanicalStage("mechanical_mode").execute(ctx);
      if (forge === "switch_mode")
        (
          game.state.mode! as { kind: import("@ai-werewolf-arena/game-contract").MechanicalMode }
        ).kind = "skill";
      else {
        const life = game.world.getComponent(1, COMPONENT.Alive)!;
        life.alive = false;
        life.alive = true;
      }
    }
    ctx.actionProvider = {
      async getAction() {
        throw new Error("revoked_mode_no_skill_request");
      },
    };
    await mechanicalStage("mechanical_skill").execute(ctx);
    expect(ctx.state.mechanicalEffects!.shields).toEqual([]);
    expect(
      new ToolGateway().validateAndSanitize(
        game.world,
        1,
        { name: "mechanical_guard", args: { target_id: 3 } },
        { phase: Phase.Night, day: 2 },
      ),
    ).toMatchObject({ ok: false, error: "mechanical_unavailable" });
  });

for (const revoke of [
  "cancel",
  "actor_life",
  "actor_state",
  "learning",
  "mode",
  "target_life",
  "gateway_target",
  "await_spent",
  "gateway_spent",
] as const)
  test(`${revoke}: await/gateway cannot spend a mechanical poison through a revoked scope`, async () => {
    const game = fixture();
    await game.phaseManager.runSingleCycle(play(game, { learn: 4, exile: 2 }));
    let current = true,
      attempts = 0;
    const ctx = stageContext(
      game,
      2,
      async () => ({ name: "mechanical_mode", args: { mode: "skill" } }),
      () => current,
    );
    await mechanicalStage("mechanical_mode").execute(ctx);
    const original = game.state.learned!.skill;
    const replaceTarget = () => game.world.addComponent(3, COMPONENT.Alive, createAliveComponent());
    const gateway = ctx.toolGateway,
      validate = gateway.validateAndSanitize.bind(gateway);
    if (revoke === "gateway_target")
      gateway.validateAndSanitize = (world, actorId, call, validationContext) => {
        const result = validate(world, actorId, call, validationContext);
        replaceTarget();
        return result;
      };
    if (revoke === "gateway_spent")
      gateway.validateAndSanitize = (world, actorId, call, validationContext) => {
        const result = validate(world, actorId, call, validationContext);
        if (original.kind === "poison") (original as { remaining: 0 | 1 }).remaining = 0;
        return result;
      };
    ctx.actionProvider = {
      async getAction() {
        attempts++;
        if (revoke === "cancel") current = false;
        if (revoke === "actor_life")
          game.world.addComponent(1, COMPONENT.Alive, createAliveComponent());
        if (revoke === "actor_state")
          (game.role.privateState as Record<string, unknown>).mechanical_wolf = structuredClone(
            game.state,
          );
        if (revoke === "learning")
          (
            game.state as {
              learned: import("@ai-werewolf-arena/game-contract").MechanicalReadLearning | null;
            }
          ).learned = { ...game.state.learned! };
        if (revoke === "mode")
          (
            game.state as {
              mode: {
                day: number;
                kind: import("@ai-werewolf-arena/game-contract").MechanicalMode;
              } | null;
            }
          ).mode = { ...game.state.mode! };
        if (revoke === "target_life") replaceTarget();
        if (revoke === "await_spent" && original.kind === "poison")
          (original as { remaining: 0 | 1 }).remaining = 0;
        return { name: "mechanical_poison", args: { target_id: 3 } };
      },
    };
    if (revoke.endsWith("target") || revoke === "target_life")
      await expect(mechanicalStage("mechanical_skill").execute(ctx)).rejects.toThrow(
        "mechanical_skill_valid_action_missing",
      );
    else await mechanicalStage("mechanical_skill").execute(ctx);
    expect(attempts).toBe(revoke === "target_life" || revoke === "gateway_target" ? 3 : 1);
    expect(original).toEqual({ kind: "poison", remaining: revoke.endsWith("spent") ? 0 : 1 });
    expect(ctx.state.poisonClaims).toEqual([]);
    expect(ctx.events.some((e) => e.type === "mechanical_poison_used")).toBe(false);
  });

test("new integer gameplay schemas retain numeric-string repair and read-only preflight", async () => {
  const game = fixture();
  await game.phaseManager.runSingleCycle(play(game, { learn: 5, exile: 2 }));
  const ctx = stageContext(game, 2, async () => ({
    name: "mechanical_mode",
    args: { mode: "skill" },
  }));
  await mechanicalStage("mechanical_mode").execute(ctx);
  const request = ctx.makeRequest(1, ["mechanical_guard"], {
      stage: "mechanical_skill",
      requiresAction: false,
    }),
    before = structuredClone(game.state);
  const reception = new ActionReception(game.world);
  expect(reception.validate(request, "mechanical_guard", { target_id: "3" })).toEqual({
    ok: true,
    action: { name: "mechanical_guard", args: { target_id: 3 } },
  });
  for (const target_id of [true, 3.5, -1, 999])
    expect(reception.validate(request, "mechanical_guard", { target_id }).ok).toBe(false);
  expect(reception.validate(request, "mechanical_guard", { target_id: null }).ok).toBe(true);
  expect(game.state).toEqual(before);
});

test("player state and prompt discard injected God causal fields at all native resource/history levels", async () => {
  const game = fixture("en");
  await game.phaseManager.runSingleCycle(play(game, { learn: 5 }));
  const state = game.state as unknown as Record<string, unknown>,
    learning = game.state.learned as unknown as Record<string, unknown>,
    skill = game.state.learned!.skill as unknown as Record<string, unknown>;
  state.casterId = 90001;
  learning.reflectTargetId = 90002;
  skill.casterId = 90003;
  const projected = JSON.stringify(projectMechanicalState(game.state)),
    prompt = renderRolePrompt(game.role, "en");
  for (const value of ["casterId", "reflectTargetId", "90001", "90002", "90003"]) {
    expect(projected).not.toContain(value);
    expect(prompt).not.toContain(value);
  }
});

for (const sameBatch of [true, false])
  test(`${sameBatch}: actual death owner distinguishes a same-proposal death from an inherited prefix before a later Hunter shot`, async () => {
    const roles = [
        Role.MechanicalWolf,
        Role.Wolf,
        Role.Hunter,
        Role.Witch,
        Role.Guard,
        Role.Villager,
      ],
      game = fixture("en", roles);
    const provider = play(game, {
      learn: sameBatch ? 3 : 2,
      knife: sameBatch ? 2 : 3,
      witch: {
        name: "use_potion",
        args: { target_id: sameBatch ? 1 : 2, potion_type: PotionType.Poison },
      },
      shot: 1,
    });
    await game.phaseManager.runSingleCycle(provider);
    expect(game.world.getAliveEntityIds()).toEqual(sameBatch ? [3, 4, 5, 6] : [4, 5, 6]);
    const events = game.phaseManager.getEvents();
    expect(events.filter((e) => e.type === "mechanical_awakened").map((e) => e.payload)).toEqual(
      sameBatch ? [] : [{ actorId: 1, day: 1, firstKnifeNight: 2 }],
    );
    expect(game.state.hasInheritedKnife).toBe(!sameBatch);
    expect(game.state.firstKnifeNight).toBe(sameBatch ? null : 2);
    expect(
      provider.requests.filter((r) => r.allowedTools.includes("shoot")).map((r) => r.actorId),
    ).toEqual(sameBatch ? [] : [3]);
    if (sameBatch)
      expect(game.state.learned?.skill).toEqual({ kind: "hunter", canShoot: true, armed: false });
    else
      expect(events.findIndex((e) => e.type === "mechanical_awakened")).toBeLessThan(
        events.findIndex((e) => e.type === "hunter_shot"),
      );
    expect(game.phaseManager.getSnapshot().result?.decidedAt).toEqual({
      day: 1,
      phase: Phase.Day,
      checkpoint: "night_settled",
    });
    expect(game.world.activeDeathActionCount).toBe(0);
  });

test("external ordinary G02 guard follows its own instance while mechanical night-one learning and kill mode keep their native restrictions", async () => {
  const game = fixture(),
    events = [] as ReturnType<Game["phaseManager"]["getEvents"]>;
  const gift = grantNightAbility(
    game.world,
    1,
    {
      id: "gift:mechanical-ordinary-guard",
      kind: "guard",
      state: { lastTarget: null },
      source: { kind: "gift", actorId: 3 },
      startsOnDay: 1,
      maxUses: null,
    },
    events,
  );
  for (const day of [1, 2]) {
    const provider = play(
      game,
      day === 1 ? { learn: 3, knife: 6, exile: 2 } : { mode: "kill", knife: 6 },
    );
    const original = provider.getAction.bind(provider);
    provider.getAction = async (request) =>
      request.actorId === 1 && request.allowedTools.includes("guard")
        ? { name: "guard", args: { target_id: day === 1 ? 6 : 5, abstain: false } }
        : original(request);
    await game.phaseManager.runSingleCycle(provider);
    if (day === 1) expect(game.world.getAliveEntityIds()).toEqual([1, 3, 4, 5, 6]);
    else
      expect(
        provider.requests.filter((r) => r.actorId === 1 && r.context.stage === "mechanical_skill"),
      ).toEqual([]);
  }
  expect(gift.uses).toBe(2);
  expect(gift.state.lastTarget).toBe(5);
  expect(game.state.learned?.skill).toEqual({ kind: "inspection", history: [] });
  expect(game.world.getAliveEntityIds()).toEqual([1, 3, 4, 5]);
  expect(game.role.role).toBe(Role.MechanicalWolf);
  expect(renderRolePrompt(game.role, "en")).toContain(
    "External ordinary G02 abilities follow this turn's bound instance rules independently",
  );
});
