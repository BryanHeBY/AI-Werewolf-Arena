/**
 * Mechanism integration tests for Awakened Hidden Wolf learning, activation and original-life native/extra authority.
 * Inputs are literal rosters, actions and targeted owner/life edits; outputs are
 * checked against the original explicit resource, event and rejection assertions.
 * Controlled contexts bind read-only actor queries at the original World read
 * position. No billed agent, fixture rewrite or production-generated oracle runs.
 */
import { bindNightAbilityActorQuery } from "../../../src/game/mechanisms/roles/night-ability-actors";
import { PotionType } from "../../../src/core";
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import {
  COMPONENT,
  Camp,
  DeathCause,
  Phase,
  Role,
  StatusMark,
  type ActionProvider,
  type BoardConfig,
  type GameEvent,
  type RoleComponent,
  type ToolCall,
} from "../../../src/core";
import {
  createAliveComponent,
  type AliveComponent,
} from "../../../src/core/domain/components/alive";
import { captureNightLife } from "../../../src/core/domain/night_effects";
import { DamageResolutionSystem } from "../../../src/core/domain/systems/damage_resolution_system";
import { GameActionRequestFactory } from "../../../src/game/engine/action_request_factory";
import { buildAgentVisibleEventFeed } from "../../../src/game/engine/agent_visible_event_feed";
import { NightPipeline } from "../../../src/game/engine/phase_pipeline/night_pipeline";
import { ToolGateway } from "../../../src/game/gateway/tool_gateway";
import type { NightStageContext } from "../../../src/game/mechanisms/stages/night/contracts";
import { NightStageRegistry } from "../../../src/game/mechanisms/stages/night/night_stage_registry";
import { allNightAbilities, findNightAbility } from "../../../src/game/mechanisms/roles/abilities";
import { resolveInspection } from "../../../src/game/mechanisms/roles/inspection";
import { getDefaultRoleCatalog, RoleCatalog } from "../../../src/game/mechanisms/roles/catalog";
import { MIRROR_INSPECTION_STAGE } from "../../../src/game/mechanisms/roles/role_inspection/night_stages";
import { awakenedDeathHook } from "../../../src/game/mechanisms/roles/awakened_hidden_wolf/death_hook";
import {
  canAwakenedKnife,
  refreshAwakenedInheritance,
} from "../../../src/game/mechanisms/roles/awakened_hidden_wolf/inheritance";
import { AWAKENED_NIGHT_STAGES } from "../../../src/game/mechanisms/roles/awakened_hidden_wolf/night_stages";
import {
  captureAwakenedOwner,
  currentAwakenedNight,
} from "../../../src/game/mechanisms/roles/awakened_hidden_wolf/night_scope";
import {
  activateAwakenedLearning,
  canAwakenedMimic,
  freshAwakenedState,
  getAwakenedState,
  learnAwakenedRole,
  setAwakenedState,
  type AwakenedTemplateRole,
} from "../../../src/game/mechanisms/roles/awakened_hidden_wolf/state";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";

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
const role = (game: Game, id = 1) => game.world.getComponent<RoleComponent>(id, COMPONENT.Role)!;
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
    get nightActors() {
      return bindNightAbilityActorQuery(this.world);
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
      dreamLinks: [],
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
  role(game, 3).privateState.abilities = {};
  role(game, 3).privateState.retiredAbilityIds = ["native:role_check"];
  const ctx = context(game, 1, async () => ({ name: "awakened_mimic", args: { target_id: 3 } }));
  await stage("awakened_opening").execute(ctx);
  await stage("awakened_mimic").execute(ctx);
  await stage("awakened_activation").execute(ctx);
  role(game).privateState.abilities = {};
  role(game).privateState.retiredAbilityIds = ["native:role_check"];
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
        if (mutation === "learning") original.learned = structuredClone(learned);
        if (mutation === "skill") Object.assign(learned, { skill: structuredClone(skill) });
        if (mutation === "ability_id") Object.assign(skill, { abilityId: "unrelated-id" });
        if (mutation === "role") Object.assign(learned, { role: "witch" });
        if (mutation === "target") Object.assign(learned, { targetId: 5 });
        if (mutation === "day") Object.assign(learned, { day: 9 });
        if (mutation === "activation") learned.activationNight = 9;
        if (mutation === "active_from") learned.activeFromNight = 9;
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
        next.roleCatalog = new RoleCatalog(
          next.roleCatalog.all().map((profile) =>
            profile.role === Role.Villager
              ? {
                  ...profile,
                  inspectionLabels: () => {
                    mutate();
                    return { role: Role.Villager };
                  },
                }
              : profile,
          ),
        );
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
  role(game).privateState.abilities = {
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
  for (const id of [2, 3, 4, 5, 6])
    game.world.getComponent<AliveComponent>(id, COMPONENT.Alive)!.alive = false;
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
  for (const id of [2, 4, 5, 6])
    game.world.getComponent<AliveComponent>(id, COMPONENT.Alive)!.alive = false;
  let requests = 0;
  const ctx = context(game, 1, async () => {
    requests++;
    if (requests < 3) return { name: "awakened_mimic", args: { target_id: 1 } };
    game.world.getComponent<AliveComponent>(3, COMPONENT.Alive)!.alive = false;
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
            const life = game.world.getComponent<AliveComponent>(1, COMPONENT.Alive)!;
            life.alive = false;
            life.alive = true;
          }
          if (mutation === "private") role(game).privateState = { ...role(game).privateState };
          if (mutation === "state")
            role(game).privateState.awakened_hidden_wolf = structuredClone(original);
          if (mutation === "role") role(game).role = Role.Wolf;
          if (mutation === "camp") role(game).camp = Camp.Good;
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
    if (boundary === "spent") skill.remaining = 0;
    const ctx = context(game, 2, async () => {
      requests++;
      if (boundary === "await") skill.remaining = 0;
      return { name: "awakened_poison", args: { target_id: 6 } };
    });
    if (boundary === "gateway") {
      const validate = ctx.toolGateway.validateAndSanitize.bind(ctx.toolGateway);
      ctx.toolGateway.validateAndSanitize = (world, actorId, call, validationContext) => {
        const result = validate(world, actorId, call, validationContext);
        skill.remaining = 0;
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
    const life = game.world.getComponent<AliveComponent>(1, COMPONENT.Alive)!;
    life.alive = false;
    expect(effect.isCurrent!()).toBe(true);
    life.alive = true;
    expect(effect.isCurrent!()).toBe(false);
    expect(ctx.events).toHaveLength(1);
    expect(JSON.stringify(ctx.events)).not.toContain('"life"');
    expect(JSON.stringify(role(game).privateState)).not.toContain('"life"');
  });

test("revoked paid copied poison does not fall through its old PoisonMark or erase another valid poison source", async () => {
  for (const other of [false, true]) {
    const game = fixture();
    ready(game, "witch");
    const ctx = context(game, 2, async () => ({ name: "awakened_poison", args: { target_id: 6 } }));
    await stage("awakened_opening").execute(ctx);
    await stage("awakened_skill").execute(ctx);
    role(game).privateState.awakened_hidden_wolf = structuredClone(state(game));
    if (other)
      ctx.state.poisonClaims!.push({
        source: captureNightLife(game.world, 4)!,
        target: captureNightLife(game.world, 6)!,
      });
    expect(
      new DamageResolutionSystem().resolve(game.world, { poisonClaims: ctx.state.poisonClaims }),
    ).toEqual(
      other
        ? { deaths: [6], deathSources: { 6: [DeathCause.Poison] } }
        : { deaths: [], deathSources: {} },
    );
  }
});

test("an extra knife remains current after its stock is spent and the slot closes, and the base knife remains independent", async () => {
  const game = fixture();
  ready(game, "wolf");
  game.world.getComponent<AliveComponent>(2, COMPONENT.Alive)!.alive = false;
  refreshAwakenedInheritance(game.world, 1, []);
  const ctx = context(game, 2, async () => ({ name: "awakened_attack", args: { target_id: 6 } }));
  await stage("awakened_opening").execute(ctx);
  expect(canAwakenedKnife(role(game), game.world)).toBe(true);
  await stage("awakened_attack").execute(ctx);
  expect(state(game).learned!.skill).toEqual({ kind: "wolf", extraKnife: "spent" });
  expect(ctx.state.awakenedEffects!.attacks[0].isCurrent()).toBe(true);
  ctx.ensureMarks(5).add(StatusMark.WolfKillMark);
  expect(
    new DamageResolutionSystem().resolve(game.world, {
      awakenedEffects: ctx.state.awakenedEffects,
    }),
  ).toEqual({
    deaths: [5, 6],
    deathSources: { 5: [DeathCause.WolfKill], 6: [DeathCause.AwakenedHiddenKnife] },
  });
});

for (const field of ["role", "targetId", "day", "activeFromNight", "activationNight"] as const)
  test(`${field}: same-reference learned metadata changes during gun choice never spend stock or publish a hit`, async () => {
    const game = fixture();
    ready(game, "hunter");
    const learned = state(game).learned!,
      gun = learned.skill;
    if (gun.kind !== "hunter") throw new Error("wrong fixture");
    game.world.getComponent<AliveComponent>(1, COMPONENT.Alive)!.alive = false;
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

test("whole night reentry after a paid mimic is explicit and preserves the learned prefix", async () => {
  const game = fixture(),
    ctx = context(game, 1, async () => ({ name: "awakened_mimic", args: { target_id: 3 } }));
  await stage("awakened_opening").execute(ctx);
  await stage("awakened_mimic").execute(ctx);
  const prefix = structuredClone(state(game));
  const pipeline = new NightPipeline({
    world: game.world,
    toolGateway: new ToolGateway(),
    damageResolutionSystem: new DamageResolutionSystem(),
    events: [],
  });
  await expect(
    pipeline.execute(
      game.config,
      {
        async getAction() {
          throw new Error("must_not_request");
        },
      },
      1,
    ),
  ).rejects.toThrow("awakened_night_reentry_after_commit");
  expect(state(game)).toEqual(prefix);
});

test("same-night opening cannot replace a revoked original-body knife permission after revival", async () => {
  const game = fixture();
  ready(game, "villager");
  game.world.getComponent<AliveComponent>(2, COMPONENT.Alive)!.alive = false;
  refreshAwakenedInheritance(game.world, 1, []);
  const ctx = context(game, 2, async () => {
    throw new Error("must_not_request");
  });
  await stage("awakened_opening").execute(ctx);
  expect(canAwakenedKnife(role(game), game.world)).toBe(true);
  const life = game.world.getComponent<AliveComponent>(1, COMPONENT.Alive)!;
  life.alive = false;
  life.alive = true;
  expect(canAwakenedKnife(role(game), game.world)).toBe(false);
  await expect(stage("awakened_opening").execute(ctx)).rejects.toThrow(
    "awakened_night_reentry_after_commit",
  );
  expect(canAwakenedKnife(role(game), game.world)).toBe(false);
});

test("a completed night with only a Villager template and inherited base knife cannot be replayed in the same World/day", async () => {
  const game = fixture();
  ready(game, "villager");
  game.world.getComponent<AliveComponent>(2, COMPONENT.Alive)!.alive = false;
  refreshAwakenedInheritance(game.world, 1, []);
  const pipeline = new NightPipeline({
    world: game.world,
    toolGateway: new ToolGateway(),
    damageResolutionSystem: new DamageResolutionSystem(),
    events: [],
  });
  let knives = 0;
  const provider: ActionProvider = {
    async getAction(request) {
      if (request.allowedTools.includes("kill_vote")) {
        knives++;
        return { name: "kill_vote", args: { target_id: 6, abstain: false } };
      }
      if (request.allowedTools.includes("guard"))
        return { name: "guard", args: { target_id: null, abstain: true } };
      if (request.allowedTools.includes("use_potion"))
        return { name: "use_potion", args: { target_id: 4, potion_type: PotionType.None } };
      throw new Error("unexpected_action_request");
    },
  };
  const first = await pipeline.execute(game.config, provider, 2);
  expect(first.interrupted).toBe(false);
  if (first.interrupted) throw new Error("unexpected_interruption");
  expect(first.damage).toEqual({ deaths: [6], deathSources: { 6: [DeathCause.WolfKill] } });
  expect(knives).toBe(1);
  await expect(pipeline.execute(game.config, provider, 2)).rejects.toThrow(
    "awakened_night_reentry_after_commit",
  );
  expect(knives).toBe(1);
  expect(state(game).learned!.skill).toEqual({ kind: "villager" });
});

test("actual first-night knife death arms the copied gun at 900 and resolves its neutral shot before final victory", async () => {
  const game = fixture();
  await game.phaseManager.runSingleCycle({
    async getAction(request) {
      if (request.allowedTools.includes("speak_to_wolves"))
        return { name: "speak_to_wolves", args: { text: "done", end_chat: true } };
      if (request.allowedTools.includes("kill_vote"))
        return { name: "kill_vote", args: { target_id: 1, abstain: false } };
      if (request.allowedTools.includes("guard"))
        return { name: "guard", args: { target_id: null, abstain: true } };
      if (request.allowedTools.includes("use_potion"))
        return { name: "use_potion", args: { target_id: 4, potion_type: PotionType.None } };
      if (request.allowedTools.includes("awakened_mimic"))
        return { name: "awakened_mimic", args: { target_id: 3 } };
      if (request.allowedTools.includes("shoot")) {
        expect(request.context.stage).toBe("death_shot");
        return { name: "shoot", args: { target_id: 2 } };
      }
      if (request.allowedTools.includes("speak"))
        return { name: "speak", args: { text: "last words" } };
      throw new Error("unexpected_action_request");
    },
  });
  const events = game.phaseManager.getEvents();
  expect(events.filter((e) => e.type === "awakened_ready").map((e) => e.payload)).toEqual([
    { actorId: 1, activationNight: 1, activeFromNight: 2, role: "hunter" },
  ]);
  expect(events.filter((e) => e.type === "player_shot").map((e) => e.payload)).toEqual([
    { actorId: 1, targetId: 2 },
  ]);
  expect(events.findIndex((e) => e.type === "awakened_ready")).toBeLessThan(
    events.findIndex((e) => e.type === "night_resolved"),
  );
  expect(events.findIndex((e) => e.type === "player_shot")).toBeLessThan(
    events.findIndex((e) => e.type === "game_over"),
  );
  expect(game.world.getAliveEntityIds()).toEqual([3, 4, 5, 6]);
  expect(game.phaseManager.getSnapshot().result?.winner).toBe(Camp.Good);
  expect(captureAwakenedOwner(game.world, 1, () => true)).toBeNull();
});

function nightGunProvider(
  knife: number | null,
  poison: number | null,
  gun: number | null,
): ActionProvider {
  return {
    async getAction(request) {
      if (request.allowedTools.includes("speak_to_wolves"))
        return { name: "speak_to_wolves", args: { text: "done", end_chat: true } };
      if (request.allowedTools.includes("kill_vote"))
        return { name: "kill_vote", args: { target_id: knife, abstain: knife === null } };
      if (request.allowedTools.includes("guard"))
        return { name: "guard", args: { target_id: null, abstain: true } };
      if (request.allowedTools.includes("use_potion"))
        return {
          name: "use_potion",
          args: {
            target_id: poison ?? 4,
            potion_type: poison === null ? PotionType.None : PotionType.Poison,
          },
        };
      if (request.allowedTools.includes("awakened_mimic"))
        return { name: "awakened_mimic", args: { target_id: 3 } };
      if (request.allowedTools.includes("shoot"))
        return { name: "shoot", args: { target_id: gun } };
      if (request.allowedTools.includes("speak")) return { name: "speak", args: { text: "words" } };
      if (request.allowedTools.includes("vote"))
        return { name: "vote", args: { target_id: 2, abstain: false } };
      throw new Error("unexpected_action_request");
    },
  };
}

test("Aw and the last ordinary Wolf dying in the same real initial batch never create inheritance", async () => {
  const game = fixture();
  await game.phaseManager.runSingleCycle(nightGunProvider(1, 2, null));
  const events = game.phaseManager.getEvents();
  expect(events.find((e) => e.type === "night_resolved")!.payload.deaths).toEqual([1, 2]);
  expect(events.some((e) => e.type === "awakened_inherited")).toBe(false);
  expect(state(game).hasInheritedKnife).toBe(false);
  expect(state(game).firstKnifeNight).toBeNull();
  expect(state(game).learned!.skill).toEqual({ kind: "hunter", armed: true, canShoot: false });
  expect(game.phaseManager.getSnapshot().result?.winner).toBe(Camp.Good);
});

test("inheritance before a later actual Hunter shot death keeps the paid fact and never grants a dead knife", async () => {
  const game = fixture();
  await game.phaseManager.runSingleCycle(nightGunProvider(3, 2, 1));
  const events = game.phaseManager.getEvents();
  expect(events.filter((e) => e.type === "awakened_inherited").map((e) => e.payload)).toEqual([
    { actorId: 1, day: 1, firstKnifeNight: 2 },
  ]);
  expect(events.filter((e) => e.type === "hunter_shot").map((e) => e.payload)).toEqual([
    { hunterId: 3, targetId: 1 },
  ]);
  expect(events.findIndex((e) => e.type === "awakened_inherited")).toBeLessThan(
    events.findIndex((e) => e.type === "hunter_shot"),
  );
  expect(state(game).hasInheritedKnife).toBe(true);
  expect(canAwakenedKnife(role(game), game.world)).toBe(false);
  expect(game.world.getAliveEntityIds()).toEqual([4, 5, 6]);
  expect(game.phaseManager.getSnapshot().result?.winner).toBe(Camp.Good);
});

for (const knife of [null, 1])
  test(`${knife}: actual first-night poison or knife+poison compound suppresses the armed copied gun`, async () => {
    const nightGame = fixture(),
      night = await new NightPipeline({
        world: nightGame.world,
        toolGateway: new ToolGateway(),
        damageResolutionSystem: new DamageResolutionSystem(),
        events: [],
      }).execute(nightGame.config, nightGunProvider(knife, 1, 2), 1);
    expect(night.interrupted).toBe(false);
    if (night.interrupted) throw new Error("unexpected_interruption");
    expect([...night.damage.deathSources[1]].sort()).toEqual(
      (knife === null ? [DeathCause.Poison] : [DeathCause.WolfKill, DeathCause.Poison]).sort(),
    );
    const game = fixture();
    let requests = 0;
    const source = nightGunProvider(knife, 1, 2);
    await game.phaseManager.runSingleCycle({
      async getAction(request) {
        if (request.actorId === 1 && request.allowedTools.includes("shoot")) requests++;
        return source.getAction(request);
      },
    });
    const events = game.phaseManager.getEvents();
    expect(state(game).learned!.skill).toEqual({ kind: "hunter", armed: true, canShoot: false });
    expect(requests).toBe(0);
    expect(events.some((e) => e.type === "player_shot")).toBe(false);
    expect(events.some((e) => e.type === "awakened_inherited")).toBe(false);
    expect(game.phaseManager.getSnapshot().result?.winner).toBe(Camp.Good);
  });

test("another Wolf revival temporarily removes a current knife without resetting its inheritance or extra stock", async () => {
  const game = fixture();
  ready(game, "wolf");
  const other = game.world.getComponent<AliveComponent>(2, COMPONENT.Alive)!;
  other.alive = false;
  refreshAwakenedInheritance(game.world, 1, []);
  const ctx = context(game, 2, async () => {
    throw new Error("unexpected_request");
  });
  await stage("awakened_opening").execute(ctx);
  expect(canAwakenedKnife(role(game), game.world)).toBe(true);
  other.alive = true;
  expect(canAwakenedKnife(role(game), game.world)).toBe(false);
  other.alive = false;
  refreshAwakenedInheritance(game.world, 9, []);
  expect(canAwakenedKnife(role(game), game.world)).toBe(true);
  expect(state(game).firstKnifeNight).toBe(2);
  expect(state(game).learned!.skill).toEqual({ kind: "wolf", extraKnife: "available" });
});
