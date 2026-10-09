import { nightStageContext } from "../night_stage_fixture";
import { PotionType } from "../../../src/core";
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import {
  Role,
  Phase,
  COMPONENT,
  StatusMark,
  DeathCause,
  type RoleComponent,
  type GameEvent,
  type BoardConfig,
} from "../../../src/core";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";
import { WITCH_NIGHT_STAGES } from "../../../src/game/mechanisms/roles/witch/night_stages";
import { findNightAbility } from "../../../src/game/mechanisms/roles/abilities";
import { getDefaultRoleCatalog } from "../../../src/game/mechanisms/roles/catalog";
import { GameActionRequestFactory } from "../../../src/game/engine/action_request_factory";
import { ToolGateway } from "../../../src/game/gateway/tool_gateway";
import { createAliveComponent } from "../../../src/core/domain/components/alive";
import { StatusMarksComponent } from "../../../src/core/domain/components/status_marks";
import { DamageResolutionSystem } from "../../../src/core/domain/systems/damage_resolution_system";
import type { NightStageContext } from "../../../src/game/mechanisms/stages/night/contracts";
const roles = [Role.Wolf, Role.Witch, Role.Seer, Role.Guard, Role.Villager, Role.Villager],
  config: BoardConfig = {
    ...sixPlayerMvpConfig,
    roleSetups: [...new Set(roles)].map((role) => ({
      role,
      count: roles.filter((r) => r === role).length,
    })),
  },
  stage = WITCH_NIGHT_STAGES.find((s) => s.id === "witch_action")!;
const fixture = () => bootstrapGame(config, { fixedRoles: roles }),
  role = (game: ReturnType<typeof fixture>, id: number) =>
    game.world.getComponent<RoleComponent>(id, COMPONENT.Role)!;
function context(
  game: ReturnType<typeof fixture>,
  events: GameEvent[],
  getAction: NightStageContext["actionProvider"]["getAction"],
  clock = () => true,
) {
  const requests = new GameActionRequestFactory(game.world, events, 1);
  return nightStageContext({
    world: game.world,
    events,
    roleCatalog: getDefaultRoleCatalog(),
    toolGateway: new ToolGateway(),
    isCurrent: clock,
    currentDay: () => 1,
    actionProvider: { getAction },
    makeRequest: (actorId, allowedTools, extra) =>
      requests.create({
        summary: "Offline stage fixture",
        requiresAction: true,
        actorId,
        phase: Phase.Night,
        allowedTools,
        stage: extra.stage,
        context: extra,
      }),
    ensureMarks: (id) => {
      let marks = game.world.getComponent<StatusMarksComponent>(id, COMPONENT.StatusMarks);
      if (!marks) {
        marks = new StatusMarksComponent();
        game.world.addComponent(id, COMPONENT.StatusMarks, marks);
      }
      return marks;
    },
    state: {
      wolfChatOrder: [],
      endedWolves: new Set(),
      wolfVotes: {},
      wolfTarget: null,
      seerChecks: [],
      dreamLinks: [],
      poisonClaims: [],
    },
  });
}
for (const change of [
  "actor_revive",
  "target_revive",
  "target_replace",
  "disabled",
  "state",
  "clock",
] as const)
  test(`${change}: a late potion reply never commits into a replaced actor/target scope`, async () => {
    const game = fixture(),
      events: GameEvent[] = [],
      ability = findNightAbility(role(game, 2), "potion")!,
      old = ability.state;
    let current = true;
    const ctx = context(
      game,
      events,
      async () => {
        if (change === "actor_revive" || change === "target_revive") {
          const life = game.world.getComponent<{ alive: boolean }>(
            change === "actor_revive" ? 2 : 5,
            COMPONENT.Alive,
          )!;
          life.alive = false;
          life.alive = true;
        }
        if (change === "target_replace")
          game.world.addComponent(5, COMPONENT.Alive, createAliveComponent());
        if (change === "disabled") ability.disabled = true;
        if (change === "state") ability.state = structuredClone(ability.state);
        if (change === "clock") current = false;
        return { name: "use_potion", args: { target_id: 5, potion_type: PotionType.Poison } };
      },
      () => current,
    );
    await stage.execute(ctx);
    expect(old.poison).toBe(1);
    expect(ability.uses).toBe(0);
    expect(ability.lastUsedDay).toBeNull();
    expect(ctx.state.poisonClaims).toEqual([]);
    expect(events).toEqual([]);
    expect(
      game.world
        .getComponent<StatusMarksComponent>(5, COMPONENT.StatusMarks)
        ?.has(StatusMark.PoisonMark) ?? false,
    ).toBe(false);
  });
test("even a successful gateway cannot put poison on a target life replaced inside validation", async () => {
  const game = fixture(),
    events: GameEvent[] = [],
    ability = findNightAbility(role(game, 2), "potion")!,
    ctx = context(game, events, async () => ({
      name: "use_potion",
      args: { target_id: 5, potion_type: PotionType.Poison },
    })),
    validate = ctx.toolGateway.validateAndSanitize.bind(ctx.toolGateway);
  ctx.toolGateway.validateAndSanitize = (world, actorId, call, validationContext) => {
    const result = validate(world, actorId, call, validationContext);
    game.world.addComponent(5, COMPONENT.Alive, createAliveComponent());
    return result;
  };
  await stage.execute(ctx);
  expect(ability.state.poison).toBe(1);
  expect(ability.uses).toBe(0);
  expect(ctx.state.poisonClaims).toEqual([]);
  expect(events).toEqual([]);
});
for (const change of [
  "caster_dead",
  "caster_revive",
  "target_revive",
  "target_replace",
  "none",
] as const)
  test(`${change}: committed poison owns only its original target life and preserves accepted resource/event prefixes`, async () => {
    const game = fixture(),
      events: GameEvent[] = [],
      ability = findNightAbility(role(game, 2), "potion")!,
      ctx = context(game, events, async () => ({
        name: "use_potion",
        args: { target_id: 5, potion_type: PotionType.Poison },
      }));
    await stage.execute(ctx);
    expect(ctx.state.poisonClaims).toHaveLength(1);
    expect(ctx.state.poisonClaims![0].source.id).toBe(2);
    expect(ctx.state.poisonClaims![0].target.id).toBe(5);
    if (change === "caster_dead" || change === "caster_revive" || change === "target_revive") {
      const life = game.world.getComponent<{ alive: boolean }>(
        change === "target_revive" ? 5 : 2,
        COMPONENT.Alive,
      )!;
      life.alive = false;
      if (change !== "caster_dead") life.alive = true;
    }
    if (change === "target_replace")
      game.world.addComponent(5, COMPONENT.Alive, createAliveComponent());
    const result = new DamageResolutionSystem().resolve(game.world, {
      poisonClaims: ctx.state.poisonClaims,
    });
    expect(result).toEqual(
      change.startsWith("target")
        ? { deaths: [], deathSources: {} }
        : { deaths: [5], deathSources: { 5: [DeathCause.Poison] } },
    );
    expect(ability.state.poison).toBe(0);
    expect(ability.uses).toBe(1);
    expect(events.filter((e) => e.type === "witch_potion_used").map((e) => e.payload)).toEqual([
      { actorId: 2, targetId: 5, potionType: PotionType.Poison },
    ]);
    expect(JSON.stringify(events)).not.toContain('"life"');
    expect(JSON.stringify(role(game, 2).privateState)).not.toContain('"life"');
  });
test("unmanaged legacy marks remain compatible, and multiple accepted toxin sources are retained separately before death merging", async () => {
  const game = fixture(),
    marks = new StatusMarksComponent([StatusMark.PoisonMark]);
  game.world.addComponent(5, COMPONENT.StatusMarks, marks);
  expect(new DamageResolutionSystem().resolve(game.world, { poisonClaims: [] })).toEqual({
    deaths: [5],
    deathSources: { 5: [DeathCause.Poison] },
  });
  const twinRoles = [Role.Wolf, Role.Witch, Role.Witch, Role.Guard, Role.Villager, Role.Villager],
    twins = bootstrapGame(
      {
        ...config,
        roleSetups: [...new Set(twinRoles)].map((role) => ({
          role,
          count: twinRoles.filter((r) => r === role).length,
        })),
      },
      { fixedRoles: twinRoles },
    ),
    events: GameEvent[] = [],
    ctx = context(twins, events, async () => ({
      name: "use_potion",
      args: { target_id: 5, potion_type: PotionType.Poison },
    }));
  await stage.execute(ctx);
  expect(ctx.state.poisonClaims!.map((claim) => [claim.source.id, claim.target.id])).toEqual([
    [2, 5],
    [3, 5],
  ]);
  expect(
    new DamageResolutionSystem().resolve(twins.world, { poisonClaims: ctx.state.poisonClaims }),
  ).toEqual({ deaths: [5], deathSources: { 5: [DeathCause.Poison] } });
});

for (const change of [
  "source",
  "source_role",
  "expiry",
  "starts",
  "max_uses",
  "disclosure",
] as const) {
  for (const boundary of ["request", "reply", "validation"] as const) {
    test(`${change}/${boundary}: potion metadata belongs to the captured ability scope`, async () => {
      const game = fixture(),
        events: GameEvent[] = [];
      const ability = findNightAbility(role(game, 2), "potion")!;
      const oldState = ability.state;
      const mutate = () => {
        switch (change) {
          case "source":
            ability.source = { kind: "native", role: Role.Witch };
            break;
          case "source_role":
            if (ability.source.kind === "native") ability.source.role = Role.Villager;
            break;
          case "expiry":
            ability.expiresAfterDay = 10;
            break;
          case "starts":
            ability.startsOnDay = 0;
            break;
          case "max_uses":
            ability.maxUses = 2;
            break;
          case "disclosure":
            ability.sourceDisclosed = !ability.sourceDisclosed;
            break;
        }
      };
      let calls = 0;
      const ctx = context(game, events, async () => {
        calls++;
        if (boundary === "reply") mutate();
        return { name: "use_potion", args: { target_id: 5, potion_type: PotionType.Poison } };
      });
      if (boundary === "request") {
        const makeRequest = ctx.makeRequest;
        ctx.makeRequest = (...args) => {
          const request = makeRequest(...args);
          mutate();
          return request;
        };
      }
      if (boundary === "validation") {
        const validate = ctx.toolGateway.validateAndSanitize.bind(ctx.toolGateway);
        ctx.toolGateway.validateAndSanitize = (...args) => {
          const result = validate(...args);
          mutate();
          return result;
        };
      }
      await stage.execute(ctx);
      expect(calls).toBe(boundary === "request" ? 0 : 1);
      expect(oldState.poison).toBe(1);
      expect(ability.uses).toBe(0);
      expect(ability.lastUsedDay).toBeNull();
      expect(ctx.state.poisonClaims).toEqual([]);
      expect(events).toEqual([]);
      expect(
        game.world
          .getComponent<StatusMarksComponent>(5, COMPONENT.StatusMarks)
          ?.has(StatusMark.PoisonMark) ?? false,
      ).toBe(false);
    });
  }
}
