/**
 * Scenario tests for awakened native runtime. Inputs are original learned-template, activation, scope and
 * paid-effect matrices. Original literal receipts, reference/getter/error traces, facts and expected state
 * remain the oracle. Actual paid stages feed DamageResolution or complete NightPipeline/PhaseManager;
 * original reentry cleanup, cross-source damage and ordered gun/victory behavior require causal engine
 * execution. Engine sequencing remains real and models remain controlled providers; production output is
 * not a newly generated golden.
 */
import type { AwakenedTemplateRole } from "@ai-werewolf-arena/game-contract";
import { bindNightAbilityActorQuery } from "../../../../src/game/mechanisms/roles/night-ability-actors";
import { PotionType } from "../../../../src/core";
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { COMPONENT, Camp, DeathCause, Phase, Role, StatusMark, type ActionProvider, type BoardConfig, type GameEvent, type RoleComponent } from "../../../../src/core";
import { type AliveComponent } from "../../../../src/core/domain/components/alive";
import { captureNightLife } from "../../../../src/core/domain/night_effects";
import { DamageResolutionSystem } from "../../../../src/core/domain/systems/damage_resolution_system";
import { GameActionRequestFactory } from "../../../../src/game/engine/action_request_factory";
import { NightPipeline } from "../../../../src/game/engine/phase_pipeline/night_pipeline";
import { ToolGateway } from "../../../../src/game/gateway/tool_gateway";
import type { NightStageContext } from "../../../../src/game/mechanisms/stages/night/contracts";
import { getDefaultRoleCatalog } from "../../../../src/game/mechanisms/roles/catalog";
import {
  canAwakenedKnife,
  refreshAwakenedInheritance,
} from "../../../../src/game/mechanisms/roles/awakened_hidden_wolf/inheritance";
import { AWAKENED_NIGHT_STAGES } from "../../../../src/game/mechanisms/roles/awakened_hidden_wolf/night_stages";
import { captureAwakenedOwner } from "../../../../src/game/mechanisms/roles/awakened_hidden_wolf/night_scope";
import { activateAwakenedLearning, getAwakenedState, learnAwakenedRole } from "../../../../src/game/mechanisms/roles/awakened_hidden_wolf/state";
import { sixPlayerMvpConfig } from "../../../../src/runtime/scenarios/six_player_mvp";

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

test("revoked paid copied poison does not fall through its old PoisonMark or erase another valid poison source", async () => {
  for (const other of [false, true]) {
    const game = fixture();
    ready(game, "witch");
    const ctx = context(game, 2, async () => ({ name: "awakened_poison", args: { target_id: 6 } }));
    await stage("awakened_opening").execute(ctx);
    await stage("awakened_skill").execute(ctx);
    (role(game).privateState as Record<string, unknown>).awakened_hidden_wolf = structuredClone(
      state(game),
    );
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
