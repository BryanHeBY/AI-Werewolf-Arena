/**
 * 单元测试用精确伤害操作验证咒狐有限 scope、只读查验及有界原生／幸运技能权限。输入为原
 * 角色／变化／阶段矩阵、局部生命／角色／状态替换及受控直接查验；精确声明、免疫／防护／死因
 * 和过期选择断言保持原样，不运行完整夜或 PhaseManager 周期。
 */
import { createAliveComponent } from "../../../../src/agents/observation/component-presentation";
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  Camp,
  COMPONENT,
  Role,
  WinCondition,
  DeathCause,
  StatusMark,
  Phase,
  type RoleComponent,
} from "../../../../src/domain";
import { foxBoard } from "../../../support/features/cursed-fox/builders/scenario";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../../src/app/config/board-definition";
import { captureNightLife } from "../../../../src/domain/night-effects";

import { DamageResolutionSystem } from "../../../../src/domain/systems/damage-resolution-system";
import { StatusMarksComponent } from "../../../../src/domain/components/status-marks";
import {
  captureInspectionIdentity,
  commitFoxInspection,
} from "../../../../src/features/cursed-fox/inspection-effect";
import { resolveInspection } from "../../../../src/engine/inspection";
import { RoleCatalog } from "../../../../src/rulesets/roles/catalog";
import {
  getDefaultRoleCatalog,
  getDefaultRoleContributions,
  createRoleCatalog,
} from "../../../../src/rulesets/roles/role-catalog-assembly";
import { permitsDeathShot } from "../../../../src/domain/deaths";
import {
  nightStageContext,
  executeNightStage,
} from "../../../support/builders/night-stage-context";
import { SEER_NIGHT_STAGES } from "../../../../src/features/seer/night-stages";
import { GameActionRequestFactory } from "../../../../src/engine/actions/action-request-factory";
import { grantNightAbility } from "../../../../src/features/night-abilities/night-ability-grants";
import { LUCKY_ABILITY_STAGE } from "../../../../src/features/miracle-merchant/lucky-stage";
import type { GameEvent, AliveComponent } from "../../../../src/domain";

const deck = [Role.CursedFox, Role.Seer, Role.Wolf, Role.Witch, Role.Guard, Role.Villager];

const fixture = () => bootstrapGame(foxBoard(deck), { fixedRoles: deck });

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

test("Fox schema and internal entrypoints reject unsupported goals, counts and board combinations", () => {
  for (const goal of [WinCondition.SlaughterSide, WinCondition.WolfReachHalf]) {
    const board = { ...foxBoard(deck), winConditions: [goal] };
    expect(() => parseBoardDefinition(boardDefinitionFromConfig("fox", board))).toThrow(
      "board_config_role_win_condition_not_supported",
    );
    expect(() => bootstrapGame(board)).toThrow("role_win_condition_not_supported");
  }
  const role = getDefaultRoleCatalog().requireRuntime(Role.CursedFox);
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
      role = world.getComponent(1, COMPONENT.Role)!;
    if (changed === "life") world.addComponent(1, COMPONENT.Alive, createAliveComponent(true));
    if (changed === "role") role.role = Role.Villager;
    if (changed === "camp") world.getComponent(1, COMPONENT.Camp)!.camp = Camp.Good;
    if (changed === "state")
      (role as { privateState: Readonly<Record<string, unknown>> }).privateState = {};
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
    const marks = world.getComponent(1, COMPONENT.StatusMarks)!;
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
          if (changed === "role") world.getComponent(1, COMPONENT.Role)!.role = Role.Villager;
          if (changed === "life")
            world.addComponent(1, COMPONENT.Alive, createAliveComponent(true));
          if (changed === "owner") world.getComponent(2, COMPONENT.Role)!.role = Role.Villager;
          if (changed === "phase") current = false;
          return { name: "check_identity", args: { target_id: changed === "invalid" ? 99 : 1 } };
        },
      },
    });
    await executeNightStage(SEER_NIGHT_STAGES[0]!)(ctx);
    expect(ctx.state.foxInspections ?? []).toEqual([]);
    expect(ctx.state.seerChecks).toEqual([]);
    expect(events).toEqual([]);
  });

for (const stage of ["native", "lucky"] as const) {
  test(`${stage}: callback identity replacement revokes report, lethal effect and consumption`, async () => {
    const { world } = fixture();
    const gift = stage === "lucky" ? lucky(world) : undefined;
    const catalog = createRoleCatalog({
      contributions: getDefaultRoleContributions().map((profile) =>
        profile.metadata.role === Role.CursedFox
          ? {
              ...profile,
              runtime: {
                ...profile.runtime,
                inspectionLabels: () => {
                  const role = world.getComponent(1, COMPONENT.Role)!;
                  role.role = Role.Villager;
                  world.getComponent(1, COMPONENT.Camp)!.camp = Camp.Good;
                  (role as { privateState: Readonly<Record<string, unknown>> }).privateState = {};
                  return { camp: Camp.Good };
                },
              },
            }
          : profile,
      ),
    });
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
    await executeNightStage(stage === "native" ? SEER_NIGHT_STAGES[0]! : LUCKY_ABILITY_STAGE)(ctx);
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
    await executeNightStage(stage === "native" ? SEER_NIGHT_STAGES[0]! : LUCKY_ABILITY_STAGE)(ctx);
    const life = world.getComponent(stage === "native" ? 2 : 6, COMPONENT.Alive)!;
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
