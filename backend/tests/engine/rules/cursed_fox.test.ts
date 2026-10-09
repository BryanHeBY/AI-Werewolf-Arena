import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import {
  Camp,
  COMPONENT,
  Role,
  WinCondition,
  DeathCause,
  StatusMark,
  Phase,
  PotionType,
  type RoleComponent,
} from "../../../src/core";
import { foxBoard } from "../../support/cursed_fox_scenarios";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../src/runtime/config/board_definition";
import { captureNightLife } from "../../../src/core/domain/night_effects";
import { createAliveComponent } from "../../../src/core/domain/components/alive";
import { DamageResolutionSystem } from "../../../src/core/domain/systems/damage_resolution_system";
import { StatusMarksComponent } from "../../../src/core/domain/components/status_marks";
import {
  captureInspectionIdentity,
  commitFoxInspection,
} from "../../../src/game/mechanisms/roles/cursed_fox/inspection_effect";
import { resolveInspection } from "../../../src/game/mechanisms/roles/inspection";
import { getDefaultRoleCatalog, RoleCatalog } from "../../../src/game/mechanisms/roles/catalog";
import { permitsDeathShot } from "../../../src/core/domain/deaths";
import { nightStageContext } from "../night_stage_fixture";
import { SEER_NIGHT_STAGES } from "../../../src/game/mechanisms/roles/seer/night_stages";
import { GameActionRequestFactory } from "../../../src/game/engine/action_request_factory";
const deck = [Role.CursedFox, Role.Seer, Role.Wolf, Role.Witch, Role.Guard, Role.Villager];
const fixture = () => bootstrapGame(foxBoard(deck), { fixedRoles: deck });
test("Fox schema and internal entrypoints reject unsupported goals, counts and board combinations", () => {
  for (const goal of [WinCondition.SlaughterSide, WinCondition.WolfReachHalf]) {
    const board = { ...foxBoard(deck), winConditions: [goal] };
    expect(() => parseBoardDefinition(boardDefinitionFromConfig("fox", board))).toThrow(
      "board_config_role_win_condition_not_supported",
    );
    expect(() => bootstrapGame(board)).toThrow("role_win_condition_not_supported");
  }
  const role = getDefaultRoleCatalog().require(Role.CursedFox);
  expect(role.configuration!.schema.safeParse({ anyImmunity: true }).success).toBe(false);
  expect(() =>
    bootstrapGame(foxBoard([Role.CursedFox, Role.CursedFox, Role.Wolf, Role.Villager])),
  ).toThrow("role_count_exceeds_limit");
  expect(() =>
    bootstrapGame(foxBoard([Role.CursedFox, Role.MechanicalWolf, Role.Villager])),
  ).toThrow("role_combination_not_supported");
  const fallback = { ...foxBoard(deck), winConditions: undefined, winCondition: undefined };
  expect(() => bootstrapGame(fallback)).not.toThrow();
});
test("read-only camp/role projection never creates lethal effects or changes life", () => {
  const { world } = fixture(),
    catalog = getDefaultRoleCatalog();
  expect(resolveInspection(world, 1, "camp", catalog)).toEqual({ kind: "camp", camp: Camp.Good });
  expect(resolveInspection(world, 1, "role", catalog)).toEqual({
    kind: "role",
    role: Role.CursedFox,
  });
  expect(world.getAliveEntityIds()).toEqual([1, 2, 3, 4, 5, 6]);
});
for (const changed of ["life", "role", "camp", "state", "owner"] as const)
  test(`paid Fox claim does not hit stale ${changed}`, () => {
    const { world } = fixture(),
      state = nightStageContext({ world }).state,
      life = captureNightLife(world, 1)!;
    let current = true;
    commitFoxInspection(world, state, life, 1, () => current);
    const identity = captureInspectionIdentity(world, life),
      role = world.getComponent<RoleComponent>(1, COMPONENT.Role)!;
    if (changed === "life") world.addComponent(1, COMPONENT.Alive, createAliveComponent(true));
    if (changed === "role") role.role = Role.Villager;
    if (changed === "camp") role.camp = Camp.Good;
    if (changed === "state") role.privateState = {};
    if (changed === "owner") current = false;
    if (changed !== "owner") expect(identity.isCurrent()).toBe(false);
    expect(
      new DamageResolutionSystem().resolve(world, { foxInspections: state.foxInspections }).deaths,
    ).toEqual([]);
  });
test("inspection-only damage, poison composite, guard/heal, Dream protection and ordinary knife immunity", () => {
  for (const kind of ["plain", "poison", "guard_heal", "dream", "knife"] as const) {
    const { world } = fixture(),
      state = nightStageContext({ world }).state;
    commitFoxInspection(world, state, captureNightLife(world, 1)!, 1, () => true);
    const marks = world.getComponent<StatusMarksComponent>(1, COMPONENT.StatusMarks)!;
    if (kind === "poison") marks.add(StatusMark.PoisonMark);
    if (kind === "guard_heal") {
      marks.add(StatusMark.GuardMark);
      marks.add(StatusMark.HealMark);
    }
    if (kind === "knife") marks.add(StatusMark.WolfKillMark);
    const result = new DamageResolutionSystem().resolve(world, {
      foxInspections: state.foxInspections,
      wolfImmuneTargets: [1],
      protectedTargets: kind === "dream" ? [1] : [],
    });
    expect(result.deaths).toEqual(kind === "dream" ? [] : [1]);
    if (kind !== "dream")
      expect(result.deathSources[1]).toEqual(
        kind === "poison"
          ? [DeathCause.FoxInspection, DeathCause.Poison]
          : [DeathCause.FoxInspection],
      );
    expect(permitsDeathShot([DeathCause.WolfKill, DeathCause.FoxInspection])).toBe(false);
  }
});
for (const changed of ["role", "life", "owner", "phase", "invalid"] as const)
  test(`actual Seer request rejects late ${changed} and cannot create a Fox claim`, async () => {
    const { world } = fixture(),
      events: any[] = [],
      factory = new GameActionRequestFactory(world, events, 1);
    let current = true;
    const ctx = nightStageContext({
      world,
      events,
      isCurrent: () => current,
      makeRequest: (actor, tools, extras) =>
        factory.create({
          phase: Phase.Night,
          actorId: actor,
          allowedTools: tools,
          stage: extras.stage,
          requiresAction: extras.requiresAction ?? true,
          summary: "Offline fixture",
          context: extras,
        }),
      actionProvider: {
        async getAction() {
          if (changed === "role")
            world.getComponent<RoleComponent>(1, COMPONENT.Role)!.role = Role.Villager;
          if (changed === "life")
            world.addComponent(1, COMPONENT.Alive, createAliveComponent(true));
          if (changed === "owner")
            world.getComponent<RoleComponent>(2, COMPONENT.Role)!.role = Role.Villager;
          if (changed === "phase") current = false;
          return { name: "check_identity", args: { target_id: changed === "invalid" ? 99 : 1 } };
        },
      },
    });
    await SEER_NIGHT_STAGES[0]!.execute(ctx);
    expect(ctx.state.foxInspections ?? []).toEqual([]);
    expect(ctx.state.seerChecks).toEqual([]);
    expect(events).toEqual([]);
  });

import { grantNightAbility } from "../../../src/game/mechanisms/roles/ability_changes";
import { LUCKY_ABILITY_STAGE } from "../../../src/game/mechanisms/roles/miracle_merchant/lucky_stage";
import { NightPipeline } from "../../../src/game/engine/phase_pipeline/night_pipeline";
import { NightStageRegistry } from "../../../src/game/mechanisms/stages/night/night_stage_registry";
import { ToolGateway } from "../../../src/game/gateway/tool_gateway";
import { BaselineBotActionProvider } from "../../../src/ai/agents/providers/action_providers";
import type { GameEvent, AliveComponent } from "../../../src/core";
function requestContext(
  world: ReturnType<typeof fixture>["world"],
  getAction: Parameters<typeof nightStageContext>[0]["actionProvider"],
  roleCatalog = getDefaultRoleCatalog(),
) {
  const events: GameEvent[] = [],
    factory = new GameActionRequestFactory(world, events, 1);
  return nightStageContext({
    world,
    events,
    roleCatalog,
    actionProvider: getAction,
    makeRequest: (actorId, allowedTools, extras) =>
      factory.create({
        actorId,
        allowedTools,
        phase: Phase.Night,
        stage: extras.stage,
        requiresAction: extras.requiresAction ?? true,
        summary: "Offline fixture",
        context: extras,
      }),
  });
}
function lucky(world: ReturnType<typeof fixture>["world"]) {
  return grantNightAbility(
    world,
    6,
    {
      id: "gift:miracle",
      kind: "seer_check",
      source: { kind: "gift", actorId: 4 },
      activation: "lucky",
      startsOnDay: 1,
      maxUses: 1,
      state: { lastTarget: null, lastIsWerewolf: null, lastResult: null, history: [] },
    },
    [],
  );
}
for (const stage of ["native", "lucky"] as const) {
  test(`${stage}: callback identity replacement revokes report, lethal effect and consumption`, async () => {
    const { world } = fixture();
    const gift = stage === "lucky" ? lucky(world) : undefined;
    const catalog = new RoleCatalog(
      getDefaultRoleCatalog()
        .all()
        .map((profile) =>
          profile.role === Role.CursedFox
            ? {
                ...profile,
                inspectionLabels: () => {
                  const role = world.getComponent<RoleComponent>(1, COMPONENT.Role)!;
                  role.role = Role.Villager;
                  role.camp = Camp.Good;
                  role.privateState = {};
                  return { camp: Camp.Good };
                },
              }
            : profile,
        ),
    );
    let attempts = 0;
    const ctx = requestContext(
      world,
      {
        async getAction() {
          return attempts++ === 0 ? { name: "check_identity", args: { target_id: 1 } } : null;
        },
      },
      catalog,
    );
    await (stage === "native" ? SEER_NIGHT_STAGES[0]! : LUCKY_ABILITY_STAGE).execute(ctx);
    expect(ctx.state.foxInspections ?? []).toEqual([]);
    expect(ctx.state.seerChecks).toEqual([]);
    expect(ctx.events.filter((e) => e.type === "seer_checked")).toEqual([]);
    if (gift) expect(gift.uses).toBe(0);
  });
  test(`${stage}: paid inspection survives its caster's first death and is revoked by resurrection`, async () => {
    const { world } = fixture();
    if (stage === "lucky") lucky(world);
    const ctx = requestContext(world, {
      async getAction() {
        return { name: "check_identity", args: { target_id: 1 } };
      },
    });
    await (stage === "native" ? SEER_NIGHT_STAGES[0]! : LUCKY_ABILITY_STAGE).execute(ctx);
    const life = world.getComponent<AliveComponent>(stage === "native" ? 2 : 6, COMPONENT.Alive)!;
    life.alive = false;
    world.removeComponent(1, COMPONENT.StatusMarks);
    expect(
      new DamageResolutionSystem().resolve(world, { foxInspections: ctx.state.foxInspections })
        .deathSources[1],
    ).toEqual([DeathCause.FoxInspection]);
    life.alive = true;
    expect(
      new DamageResolutionSystem().resolve(world, { foxInspections: ctx.state.foxInspections })
        .deaths,
    ).toEqual([]);
  });
}
test("committed Fox inspection interrupted later cannot be silently lost by full same-night reentry", async () => {
  const { world } = fixture();
  let current = true,
    requests = 0;
  const catalog = new RoleCatalog(
    getDefaultRoleCatalog()
      .all()
      .map((profile) => ({
        ...profile,
        possibleNightAbilities: [],
        nightStages:
          profile.role === Role.Seer
            ? [
                SEER_NIGHT_STAGES[0]!,
                {
                  id: "late_interrupt",
                  priority: 800,
                  async execute() {
                    current = false;
                  },
                },
              ]
            : [],
      })),
  );
  const pipeline = new NightPipeline({
    world,
    events: [],
    toolGateway: new ToolGateway(),
    damageResolutionSystem: new DamageResolutionSystem(),
    stageRegistry: new NightStageRegistry(catalog),
  });
  const actions = {
    async getAction() {
      requests++;
      return { name: "check_identity" as const, args: { target_id: 1 } };
    },
  };
  expect(await pipeline.execute(foxBoard(deck), actions, 1, { isCurrent: () => current })).toEqual({
    interrupted: true,
  });
  current = true;
  await expect(
    pipeline.execute(foxBoard(deck), actions, 1, { isCurrent: () => current }),
  ).rejects.toThrow("fox_inspection_night_reentry_after_commit");
  expect(requests).toBe(1);
});
for (const poison of [false, true])
  test(`first-day sheriff identity replacement filters only old FoxInspection; independent poison=${poison}`, async () => {
    const board = { ...foxBoard(deck), enableSheriff: true },
      game = bootstrapGame(board, { fixedRoles: deck }),
      base = new BaselineBotActionProvider(game.world);
    let replaced = false;
    await game.phaseManager.runSingleCycle(
      {
        async getAction(req) {
          if (req.allowedTools.includes("kill_vote"))
            return { name: "kill_vote", args: { target_id: null, abstain: true } };
          if (req.allowedTools.includes("check_identity"))
            return { name: "check_identity", args: { target_id: 1 } };
          if (req.allowedTools.includes("use_potion"))
            return {
              name: "use_potion",
              args: {
                target_id: poison ? 1 : 4,
                potion_type: poison ? PotionType.Poison : PotionType.None,
              },
            };
          if (req.context.stage === "sheriff_nomination" && !replaced) {
            const role = game.world.getComponent<RoleComponent>(1, COMPONENT.Role)!;
            role.role = Role.Villager;
            role.camp = Camp.Good;
            role.privateState = {};
            replaced = true;
          }
          if (req.allowedTools.includes("vote"))
            return { name: "vote", args: { target_id: null, abstain: true } };
          return base.getAction(req);
        },
      },
      2,
    );
    expect(replaced).toBe(true);
    expect(
      game.phaseManager
        .getEvents()
        .filter((e) => e.type === "night_resolved")
        .map((e) => e.payload.deaths),
    ).toEqual([poison ? [1] : []]);
    expect(game.world.getAliveEntityIds().includes(1)).toBe(!poison);
  });
test("last Good dies while Fox survives: only Fox wins at the complete night checkpoint", async () => {
  const roles = [Role.CursedFox, Role.Wolf, Role.Villager],
    game = bootstrapGame(foxBoard(roles), { fixedRoles: roles });
  const base = new BaselineBotActionProvider(game.world);
  await game.phaseManager.runSingleCycle(
    {
      async getAction(req) {
        if (req.allowedTools.includes("kill_vote"))
          return { name: "kill_vote", args: { target_id: 3, abstain: false } };
        return base.getAction(req);
      },
    },
    2,
  );
  expect(game.phaseManager.getSnapshot().result).toMatchObject({
    winner: null,
    reason: "cursed_fox_survived_faction_elimination",
    outcome: {
      kind: "victory",
      primary: { kind: "individual", playerId: 1, winningPlayerIds: [1] },
      winningPlayerIds: [1],
    },
    decidedAt: { checkpoint: "night_settled" },
  });
  expect(game.world.getAliveEntityIds()).toEqual([1, 2]);
});
