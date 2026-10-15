/**
 * 单元测试以原学习模板、激活、scope 与已付款效果矩阵验证觉醒原生运行。原字面回执、引用／
 * getter／错误轨迹、事实和状态是预期；有界具体阶段／请求／reader／死亡 hook 检查激活、库存
 * 及原 scope 撤销，不运行完整流水线、PhaseManager 周期或计费模型，保留局部窗口和拒绝探针。
 */
import { createAliveComponent } from "../../../../src/agents/observation/component-presentation";
import { bindNativeNightFailurePolicy } from "../../../../src/rulesets/native-night-failure-policy";
import { bindNativeNightTargetPolicy } from "../../../../src/rulesets/native-night-target-policy";
import { bindNativeNightEffects } from "../../../../src/rulesets/native-night-effects";
import type { AwakenedTemplateRole } from "@ai-werewolf-arena/game-contract";
import { bindNightAbilityActorQuery } from "../../../../src/features/night-abilities/night-ability-actors";
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  COMPONENT,
  Camp,
  DeathCause,
  Phase,
  Role,
  type ActionProvider,
  type BoardConfig,
  type GameEvent,
  type RoleComponent,
  type ToolCall,
} from "../../../../src/domain";
import { type AliveComponent } from "../../../../src/domain/components/alive";
import { GameActionRequestFactory } from "../../../../src/engine/actions/action-request-factory";
import { buildAgentVisibleEventFeed } from "../../../../src/agents/observation/event-feed";
import { ToolGateway } from "../../../../src/engine/actions/tool-gateway";
import type { NightStageContext } from "../../../../src/engine/night/contracts";
import { NightStageRegistry } from "../../../../src/rulesets/night-stage-plan";
import {
  allNightAbilities,
  findNightAbility,
} from "../../../../src/features/night-abilities/abilities";
import { resolveInspection } from "../../../../src/engine/inspection";
import { RoleCatalog } from "../../../../src/rulesets/roles/catalog";
import {
  getDefaultRoleCatalog,
  getDefaultRoleContributions,
  createRoleCatalog,
} from "../../../../src/rulesets/roles/role-catalog-assembly";
import { MIRROR_INSPECTION_STAGE } from "../../../../src/features/role-inspection/contribution-ports";
import { awakenedDeathHook } from "../../../../src/features/awakened-hidden-wolf/death-hook";
import {
  canAwakenedKnife,
  refreshAwakenedInheritance,
} from "../../../../src/features/awakened-hidden-wolf/inheritance";
import { AWAKENED_NIGHT_STAGES } from "../../../../src/features/awakened-hidden-wolf/night-stages";
import { currentAwakenedNight } from "../../../../src/features/awakened-hidden-wolf/night-scope";
import {
  activateAwakenedLearning,
  canAwakenedMimic,
  freshAwakenedState,
  getAwakenedState,
  learnAwakenedRole,
  setAwakenedState,
} from "../../../../src/features/awakened-hidden-wolf/state";
import { sixPlayerMvpConfig } from "../../../../src/rulesets/presets/six-player-mvp";

const fixture = (targetRole = Role.Hunter) => {
  const roles = [
    Role.AwakenedHiddenWolf,
    Role.Wolf,
    targetRole,
    Role.Witch,
    Role.Guard,
    Role.Villager,
  ];
  const config: BoardConfig = {
    ...sixPlayerMvpConfig,
    roleSetups: [...new Set(roles)].map((role) => ({
      role,
      count: roles.filter((r) => r === role).length,
    })),
  };
  return { ...bootstrapGame(config, { fixedRoles: roles }), config };
};

type Game = ReturnType<typeof fixture>;

const role = (game: Game, id = 1) => game.world.getComponent(id, COMPONENT.Role)!;

const state = (game: Game) => getAwakenedState(role(game))!;

const stage = (id: string) => AWAKENED_NIGHT_STAGES.find((stage) => stage.id === id)!;

function context(
  game: Game,
  day: number,
  getAction: ActionProvider["getAction"],
  clock = { day, open: true },
): NightStageContext {
  const events: GameEvent[] = [],
    requests = new GameActionRequestFactory(game.world, events, day);
  return {
    world: game.world,
    get requestFactory() {
      return GameActionRequestFactory;
    },
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
    isCurrent: () => clock.open,
    currentDay: () => clock.day,
    previousExile: null,
    actionProvider: { getAction },
    makeRequest: (actorId, allowedTools, extra) =>
      requests.create({
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
      poisonClaims: [],
      guardClaims: [],
      merchantBacklashes: [],
      awakenedEffects: { shields: [], attacks: [] },
      mechanicalEffects: { shields: [], attacks: [], failures: [] },
    },
  };
}

const ready = (game: Game, template: AwakenedTemplateRole) => {
  learnAwakenedRole(state(game), 3, template, 1);
  activateAwakenedLearning(state(game), 1);
};

test("registered finite stages put immediate role masking before native Mirror and actual activation last", async () => {
  const game = fixture(Role.MirrorGirl),
    ctx = context(game, 1, async (request) => {
      expect(request.allowedTools).toEqual(["awakened_mimic"]);
      expect(request.context.allow_fallback).toBe(false);
      return { name: "awakened_mimic", args: { target_id: 3 } };
    });
  expect(
    new NightStageRegistry()
      .getStages(game.config, game.world)
      .filter((s) => s.id.startsWith("awakened_"))
      .map((s) => [s.id, s.priority]),
  ).toEqual([
    ["awakened_opening", 250],
    ["awakened_mimic", 580],
    ["awakened_skill", 650],
    ["awakened_attack", 660],
    ["awakened_activation", 900],
  ]);
  await stage("awakened_opening").execute(ctx);
  expect(resolveInspection(game.world, 1, "role", getDefaultRoleCatalog())).toEqual({
    kind: "role",
    role: "awakened_hidden_wolf",
  });
  await stage("awakened_mimic").execute(ctx);
  expect(resolveInspection(game.world, 1, "role", getDefaultRoleCatalog())).toEqual({
    kind: "role",
    role: "mirror_girl",
  });
  expect(resolveInspection(game.world, 1, "camp", getDefaultRoleCatalog())).toEqual({
    kind: "camp",
    camp: "wolf",
  });
  expect(state(game).learned).toMatchObject({
    activationNight: null,
    activeFromNight: null,
    skill: { kind: "inspection", abilityId: null },
  });
  expect(allNightAbilities(role(game))).toEqual([]);
  await stage("awakened_activation").execute(ctx);
  expect(state(game).learned).toMatchObject({
    activationNight: 1,
    activeFromNight: 2,
    skill: { kind: "inspection", abilityId: "native:role_check" },
  });
  expect(findNightAbility(role(game), "role_check")).toMatchObject({
    startsOnDay: 2,
    uses: 0,
    lastUsedDay: null,
    state: { policy: "mirror", history: [] },
    source: { kind: "native", role: "awakened_hidden_wolf" },
  });
  for (const id of game.world.entityIds())
    expect(buildAgentVisibleEventFeed(game.world, ctx.events, id)).toHaveLength(id === 1 ? 2 : 0);
});

test("Mirror template whose own capability was removed is still learnable; own activation never replenishes a transferred copy", async () => {
  const game = fixture(Role.MirrorGirl);
  (role(game, 3).privateState as Record<string, unknown>).abilities = {};
  (role(game, 3).privateState as Record<string, unknown>).retiredAbilityIds = ["native:role_check"];
  const ctx = context(game, 1, async () => ({ name: "awakened_mimic", args: { target_id: 3 } }));
  await stage("awakened_opening").execute(ctx);
  await stage("awakened_mimic").execute(ctx);
  await stage("awakened_activation").execute(ctx);
  (role(game).privateState as Record<string, unknown>).abilities = {};
  (role(game).privateState as Record<string, unknown>).retiredAbilityIds = ["native:role_check"];
  const next = context(game, 2, async () => {
    throw new Error("unexpected_action");
  });
  await stage("awakened_opening").execute(next);
  await stage("awakened_activation").execute(next);
  expect(allNightAbilities(role(game))).toEqual([]);
  expect(state(game).learned!.skill).toEqual({
    kind: "inspection",
    abilityId: "native:role_check",
  });
  expect(next.events).toEqual([]);
});

for (const boundary of ["await", "gateway", "label"] as const)
  for (const mutation of [
    "state",
    "learning",
    "skill",
    "ability_id",
    "role",
    "target",
    "day",
    "activation",
    "active_from",
  ] as const)
    test(`${boundary}/${mutation}: copied native Mirror remains bound to its original Aw learning owner`, async () => {
      const game = fixture(Role.MirrorGirl),
        first = context(game, 1, async () => ({ name: "awakened_mimic", args: { target_id: 3 } }));
      await stage("awakened_opening").execute(first);
      await stage("awakened_mimic").execute(first);
      await stage("awakened_activation").execute(first);
      const original = state(game),
        learned = original.learned!,
        skill = learned.skill,
        ability = findNightAbility(role(game), "role_check")!;
      const mutate = () => {
        if (mutation === "state") setAwakenedState(role(game), freshAwakenedState());
        if (mutation === "learning")
          (
            original as {
              learned: import("@ai-werewolf-arena/game-contract").AwakenedReadLearning | null;
            }
          ).learned = structuredClone(learned);
        if (mutation === "skill") Object.assign(learned, { skill: structuredClone(skill) });
        if (mutation === "ability_id") Object.assign(skill, { abilityId: "unrelated-id" });
        if (mutation === "role") Object.assign(learned, { role: "witch" });
        if (mutation === "target") Object.assign(learned, { targetId: 5 });
        if (mutation === "day") Object.assign(learned, { day: 9 });
        if (mutation === "activation")
          (learned as { activationNight: number | null }).activationNight = 9;
        if (mutation === "active_from")
          (learned as { activeFromNight: number | null }).activeFromNight = 9;
      };
      const next = context(game, 2, async (request) => {
        if (request.actorId !== 1) return null;
        if (boundary === "await") mutate();
        return { name: "inspect_role", args: { target_id: 6 } };
      });
      if (boundary === "gateway") {
        const validate = next.toolGateway.validateAndSanitize.bind(next.toolGateway);
        next.toolGateway.validateAndSanitize = (world, actorId, call, validationContext) => {
          const result = validate(world, actorId, call, validationContext);
          if (actorId === 1) mutate();
          return result;
        };
      }
      if (boundary === "label")
        next.roleCatalog = createRoleCatalog({
          contributions: getDefaultRoleContributions().map((profile) =>
            profile.metadata.role === Role.Villager
              ? {
                  ...profile,
                  runtime: {
                    ...profile.runtime,
                    inspectionLabels: () => {
                      mutate();
                      return { role: Role.Villager };
                    },
                  },
                }
              : profile,
          ),
        });
      await stage("awakened_opening").execute(next);
      await MIRROR_INSPECTION_STAGE.execute(next);
      expect(ability.uses).toBe(0);
      expect(ability.lastUsedDay).toBeNull();
      expect(ability.state.history).toEqual([]);
      expect(
        next.events.filter((e) => e.type === "role_inspected" && e.payload.actorId === 1),
      ).toEqual([]);
    });

test("an independent gifted Mirror instance on Aw does not depend on its native learning state", async () => {
  const game = fixture();
  (role(game).privateState as Record<string, unknown>).abilities = {
    "gift:test": {
      id: "gift:test",
      kind: "role_check",
      state: { policy: "mirror", lastTarget: null, lastDay: null, history: [] },
      source: { kind: "gift", actorId: 3 },
      sourceDisclosed: false,
      startsOnDay: 1,
      maxUses: 1,
      uses: 0,
      lastUsedDay: null,
      disabled: false,
    },
  };
  const ctx = context(game, 1, async (request) => {
    expect(request.context.ability_id).toBe("gift:test");
    setAwakenedState(role(game), freshAwakenedState());
    return { name: "inspect_role", args: { target_id: 6 } };
  });
  await MIRROR_INSPECTION_STAGE.execute(ctx);
  expect(ctx.events.filter((e) => e.type === "role_inspected").map((e) => e.payload)).toEqual([
    {
      actorId: 1,
      abilityId: "gift:test",
      targetId: 6,
      day: 1,
      result: { kind: "role", role: "villager" },
    },
  ]);
  expect(findNightAbility(role(game), "role_check", "gift:test")!.uses).toBe(1);
});

test("interruption before 900 preserves learning but later activation uses the later actual night", async () => {
  const game = fixture(),
    clock = { day: 1, open: true },
    ctx = context(game, 1, async () => ({ name: "awakened_mimic", args: { target_id: 3 } }), clock);
  await stage("awakened_opening").execute(ctx);
  await stage("awakened_mimic").execute(ctx);
  clock.open = false;
  await stage("awakened_activation").execute(ctx);
  expect(state(game).learned).toMatchObject({
    activationNight: null,
    skill: { kind: "hunter", armed: false },
  });
  const next = context(game, 3, async () => {
    throw new Error("unexpected_action");
  });
  await stage("awakened_opening").execute(next);
  await stage("awakened_activation").execute(next);
  expect(state(game).learned).toMatchObject({
    activationNight: 3,
    activeFromNight: 4,
    skill: { kind: "hunter", armed: true },
  });
});

test("no other living target closes mimic without a request or spending the once opportunity", async () => {
  const game = fixture();
  for (const id of [2, 3, 4, 5, 6]) game.world.getComponent(id, COMPONENT.Alive)!.alive = false;
  const ctx = context(game, 1, async () => {
    throw new Error("must_not_request");
  });
  await stage("awakened_opening").execute(ctx);
  await stage("awakened_mimic").execute(ctx);
  expect(state(game).learned).toBeNull();
  expect(state(game).mimicClosedDay).toBe(1);
  expect(ctx.events.map((e) => e.type)).toEqual(["awakened_mimic_skipped"]);
});

test("three invalid mimic actions with living candidates fail explicitly instead of becoming wait", async () => {
  const game = fixture();
  let requests = 0;
  const ctx = context(game, 1, async () => {
    requests++;
    return { name: "awakened_mimic", args: { target_id: 1 } };
  });
  await stage("awakened_opening").execute(ctx);
  await expect(stage("awakened_mimic").execute(ctx)).rejects.toThrow(
    "awakened_mimic_valid_action_missing",
  );
  expect(requests).toBe(3);
  expect(state(game).learned).toBeNull();
  expect(state(game).mimicClosedDay).toBeNull();
  expect(ctx.events).toEqual([]);
});

test("last candidate disappearing during the third attempt becomes a legal wait without spending learning", async () => {
  const game = fixture(Role.MirrorGirl);
  for (const id of [2, 4, 5, 6]) game.world.getComponent(id, COMPONENT.Alive)!.alive = false;
  let requests = 0;
  const ctx = context(game, 1, async () => {
    requests++;
    if (requests < 3) return { name: "awakened_mimic", args: { target_id: 1 } };
    game.world.getComponent(3, COMPONENT.Alive)!.alive = false;
    return { name: "awakened_mimic", args: { target_id: 3 } };
  });
  await stage("awakened_opening").execute(ctx);
  await stage("awakened_mimic").execute(ctx);
  expect(requests).toBe(3);
  expect(state(game).learned).toBeNull();
  expect(state(game).mimicClosedDay).toBe(1);
  expect(canAwakenedMimic(state(game), 2)).toBe(true);
  expect(ctx.events.map((e) => e.type)).toEqual(["awakened_mimic_skipped"]);
});

for (const mutation of [
  "life",
  "revival",
  "private",
  "state",
  "role",
  "camp",
  "phase",
  "day",
] as const)
  test(`${mutation}: late mimic never commits to a replacement owner`, async () => {
    const game = fixture(),
      clock = { day: 1, open: true },
      original = state(game),
      ctx = context(
        game,
        1,
        async () => {
          if (mutation === "life")
            game.world.addComponent(1, COMPONENT.Alive, createAliveComponent());
          if (mutation === "revival") {
            const life = game.world.getComponent(1, COMPONENT.Alive)!;
            life.alive = false;
            life.alive = true;
          }
          if (mutation === "private")
            (role(game) as { privateState: Readonly<Record<string, unknown>> }).privateState = {
              ...role(game).privateState,
            };
          if (mutation === "state")
            (role(game).privateState as Record<string, unknown>).awakened_hidden_wolf =
              structuredClone(original);
          if (mutation === "role") role(game).role = Role.Wolf;
          if (mutation === "camp") game.world.getComponent(1, COMPONENT.Camp)!.camp = Camp.Good;
          if (mutation === "phase") clock.open = false;
          if (mutation === "day") clock.day = 2;
          return { name: "awakened_mimic", args: { target_id: 3 } };
        },
        clock,
      );
    await stage("awakened_opening").execute(ctx);
    await stage("awakened_mimic").execute(ctx);
    expect(original.learned).toBeNull();
    expect(original.mimicClosedDay).toBeNull();
    expect(ctx.events).toEqual([]);
    expect(currentAwakenedNight(game.world, role(game))).toBeNull();
  });

for (const boundary of ["spent", "await", "gateway"] as const)
  test(`${boundary}: poison resource exhaustion neither requests again nor creates a new paid claim`, async () => {
    const game = fixture(Role.Witch);
    ready(game, "witch");
    const skill = state(game).learned!.skill;
    if (skill.kind !== "poison") throw new Error("wrong fixture");
    let requests = 0;
    if (boundary === "spent") (skill as { remaining: 0 | 1 }).remaining = 0;
    const ctx = context(game, 2, async () => {
      requests++;
      if (boundary === "await") (skill as { remaining: 0 | 1 }).remaining = 0;
      return { name: "awakened_poison", args: { target_id: 6 } };
    });
    if (boundary === "gateway") {
      const validate = ctx.toolGateway.validateAndSanitize.bind(ctx.toolGateway);
      ctx.toolGateway.validateAndSanitize = (world, actorId, call, validationContext) => {
        const result = validate(world, actorId, call, validationContext);
        (skill as { remaining: 0 | 1 }).remaining = 0;
        return result;
      };
    }
    await stage("awakened_opening").execute(ctx);
    await stage("awakened_skill").execute(ctx);
    expect(requests).toBe(boundary === "spent" ? 0 : 1);
    expect(ctx.state.poisonClaims).toEqual([]);
    expect(ctx.events).toEqual([]);
    expect(state(game).skillClosedDay).toBeNull();
  });

for (const skillKind of ["poison", "guard"] as const)
  test(`${skillKind}: paid effects survive close/consumption and first actor death, but revoke after revival or learning replacement`, async () => {
    const game = fixture();
    ready(game, skillKind === "poison" ? "witch" : "guard");
    const call: ToolCall =
      skillKind === "poison"
        ? { name: "awakened_poison", args: { target_id: 6 } }
        : { name: "awakened_guard", args: { target_id: 6 } };
    const ctx = context(game, 2, async () => call);
    await stage("awakened_opening").execute(ctx);
    await stage("awakened_skill").execute(ctx);
    const effect =
      skillKind === "poison" ? ctx.state.poisonClaims![0] : ctx.state.awakenedEffects!.shields[0];
    expect(effect.isCurrent!()).toBe(true);
    expect(state(game).skillClosedDay).toBe(2);
    const life = game.world.getComponent(1, COMPONENT.Alive)!;
    life.alive = false;
    expect(effect.isCurrent!()).toBe(true);
    life.alive = true;
    expect(effect.isCurrent!()).toBe(false);
    expect(ctx.events).toHaveLength(1);
    expect(JSON.stringify(ctx.events)).not.toContain('"life"');
    expect(JSON.stringify(role(game).privateState)).not.toContain('"life"');
  });

for (const field of ["role", "targetId", "day", "activeFromNight", "activationNight"] as const)
  test(`${field}: same-reference learned metadata changes during gun choice never spend stock or publish a hit`, async () => {
    const game = fixture();
    ready(game, "hunter");
    const learned = state(game).learned!,
      gun = learned.skill;
    if (gun.kind !== "hunter") throw new Error("wrong fixture");
    game.world.getComponent(1, COMPONENT.Alive)!.alive = false;
    const permit = game.world.openDeathAction(1, "shoot", Phase.Day, 1),
      events: GameEvent[] = [];
    try {
      const result = await awakenedDeathHook(
        game.world,
        [1],
        { 1: [DeathCause.WolfKill] },
        async () => {
          Object.assign(learned, {
            [field]: field === "role" ? "witch" : field === "targetId" ? 5 : 9,
          });
          return { kind: "shot", targetId: 6, deathActionId: permit.id };
        },
        events,
      );
      expect(result.extraDeaths).toEqual([]);
      expect(events).toEqual([]);
      expect(gun.canShoot).toBe(true);
    } finally {
      permit.close();
    }
  });

test("same-night opening cannot replace a revoked original-body knife permission after revival", async () => {
  const game = fixture();
  ready(game, "villager");
  game.world.getComponent(2, COMPONENT.Alive)!.alive = false;
  refreshAwakenedInheritance(game.world, 1, []);
  const ctx = context(game, 2, async () => {
    throw new Error("must_not_request");
  });
  await stage("awakened_opening").execute(ctx);
  expect(
    canAwakenedKnife(role(game), game.world, () => game.world.getComponent(1, COMPONENT.Camp)),
  ).toBe(true);
  const life = game.world.getComponent(1, COMPONENT.Alive)!;
  life.alive = false;
  life.alive = true;
  expect(
    canAwakenedKnife(role(game), game.world, () => game.world.getComponent(1, COMPONENT.Camp)),
  ).toBe(false);
  await expect(stage("awakened_opening").execute(ctx)).rejects.toThrow(
    "awakened_night_reentry_after_commit",
  );
  expect(
    canAwakenedKnife(role(game), game.world, () => game.world.getComponent(1, COMPONENT.Camp)),
  ).toBe(false);
});

test("another Wolf revival temporarily removes a current knife without resetting its inheritance or extra stock", async () => {
  const game = fixture();
  ready(game, "wolf");
  const other = game.world.getComponent(2, COMPONENT.Alive)!;
  other.alive = false;
  refreshAwakenedInheritance(game.world, 1, []);
  const ctx = context(game, 2, async () => {
    throw new Error("unexpected_request");
  });
  await stage("awakened_opening").execute(ctx);
  expect(
    canAwakenedKnife(role(game), game.world, () => game.world.getComponent(1, COMPONENT.Camp)),
  ).toBe(true);
  other.alive = true;
  expect(
    canAwakenedKnife(role(game), game.world, () => game.world.getComponent(1, COMPONENT.Camp)),
  ).toBe(false);
  other.alive = false;
  refreshAwakenedInheritance(game.world, 9, []);
  expect(
    canAwakenedKnife(role(game), game.world, () => game.world.getComponent(1, COMPONENT.Camp)),
  ).toBe(true);
  expect(state(game).firstKnifeNight).toBe(2);
  expect(state(game).learned!.skill).toEqual({ kind: "wolf", extraKnife: "available" });
});
