import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import {
  COMPONENT,
  DeathCause,
  Phase,
  Role,
  StatusMark,
  type BoardConfig,
} from "../../../src/core";
import {
  createAliveComponent,
  type AliveComponent,
} from "../../../src/core/domain/components/alive";
import { StatusMarksComponent } from "../../../src/core/domain/components/status_marks";
import { permitsDeathShot } from "../../../src/core/domain/deaths";
import {
  captureNightLife,
  type NightAwakenedEffect,
  type NightMechanicalEffect,
} from "../../../src/core/domain/night_effects";
import { DamageResolutionSystem } from "../../../src/core/domain/systems/damage_resolution_system";
import { LastWordsMechanism } from "../../../src/game/mechanisms/last_words/last_words_mechanism";
import { NightPipeline } from "../../../src/game/engine/phase_pipeline/night_pipeline";
import { NightStageRegistry } from "../../../src/game/mechanisms/stages/night/night_stage_registry";
import type { NightStageHandler } from "../../../src/game/mechanisms/stages/night/contracts";
import { ToolGateway } from "../../../src/game/gateway/tool_gateway";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";

const roles = [Role.Wolf, Role.Witch, Role.Seer, Role.Guard, Role.Villager, Role.Villager];
const config: BoardConfig = {
  ...sixPlayerMvpConfig,
  roleSetups: [...new Set(roles)].map((role) => ({
    role,
    count: roles.filter((r) => r === role).length,
  })),
};
const fixture = () => bootstrapGame(config, { fixedRoles: roles });
type Game = ReturnType<typeof fixture>;
const scope = (game: Game, id: number) => captureNightLife(game.world, id)!;
const effect = (game: Game, targetId: number, isCurrent = () => true): NightAwakenedEffect => ({
  actorId: 1,
  target: scope(game, targetId),
  isCurrent,
});
const marks = (game: Game, id: number, ...values: StatusMark[]) =>
  game.world.addComponent(id, COMPONENT.StatusMarks, new StatusMarksComponent(values));
const mechanical = (
  shields: NightMechanicalEffect[] = [],
  attacks: NightMechanicalEffect[] = [],
  failures: NightMechanicalEffect[] = [],
) => ({ shields, attacks, failures });

for (const protection of [
  "none",
  "guard",
  "heal",
  "both",
  "dream",
  "awakened",
  "mechanical",
] as const)
  for (const base of [false, true])
    test(`${protection}/${base}: normal extra knife respects protection without mechanical piercing`, () => {
      const game = fixture(),
        attack = effect(game, 5);
      marks(
        game,
        5,
        ...(base ? [StatusMark.WolfKillMark] : []),
        ...(["guard", "both"].includes(protection) ? [StatusMark.GuardMark] : []),
        ...(["heal", "both"].includes(protection) ? [StatusMark.HealMark] : []),
      );
      const shield = effect(game, 5);
      const result = new DamageResolutionSystem().resolve(game.world, {
        awakenedEffects: { shields: protection === "awakened" ? [shield] : [], attacks: [attack] },
        mechanicalEffects: mechanical(protection === "mechanical" ? [shield] : []),
        protectedTargets: protection === "dream" ? [5] : [],
      });
      expect(result).toEqual(
        ["none", "both"].includes(protection)
          ? {
              deaths: [5],
              deathSources: {
                5: [...(base ? [DeathCause.WolfKill] : []), DeathCause.AwakenedHiddenKnife],
              },
            }
          : { deaths: [], deathSources: {} },
      );
      expect(game.world.getAliveEntityIds()).toEqual([1, 2, 3, 4, 5, 6]);
      expect(
        game.world
          .getComponent<StatusMarksComponent>(5, COMPONENT.StatusMarks)!
          .has(StatusMark.WolfKillMark),
      ).toBe(false);
    });

test("base and extra knives retain distinct targets and causal facts", () => {
  const game = fixture();
  marks(game, 5, StatusMark.WolfKillMark);
  expect(
    new DamageResolutionSystem().resolve(game.world, {
      awakenedEffects: { shields: [], attacks: [effect(game, 6)] },
    }),
  ).toEqual({
    deaths: [5, 6],
    deathSources: { 5: [DeathCause.WolfKill], 6: [DeathCause.AwakenedHiddenKnife] },
  });
});

for (const both of [false, true])
  test(`${both}: independent awakened shield absorbs every original poison before mechanical reflection`, () => {
    const game = fixture(),
      shield = effect(game, 5);
    marks(
      game,
      5,
      StatusMark.PoisonMark,
      StatusMark.WolfKillMark,
      StatusMark.GuardMark,
      StatusMark.HealMark,
    );
    const poisons = [
      { source: scope(game, 2), target: scope(game, 5) },
      { source: scope(game, 3), target: scope(game, 5) },
    ];
    expect(
      new DamageResolutionSystem().resolve(game.world, {
        poisonClaims: poisons,
        awakenedEffects: { shields: [shield], attacks: [effect(game, 5)] },
        mechanicalEffects: mechanical(both ? [shield] : []),
      }),
    ).toEqual({ deaths: [], deathSources: {} });
    expect(game.world.getAliveEntityIds()).toEqual([1, 2, 3, 4, 5, 6]);
  });

test("reflected toxin is absorbed at the protected caster; other original toxins remain independently lethal", () => {
  const game = fixture();
  marks(game, 5, StatusMark.PoisonMark);
  marks(game, 6, StatusMark.PoisonMark);
  const result = new DamageResolutionSystem().resolve(game.world, {
    poisonClaims: [
      { source: scope(game, 2), target: scope(game, 5) },
      { source: scope(game, 3), target: scope(game, 5) },
      { source: scope(game, 2), target: scope(game, 6) },
    ],
    awakenedEffects: { shields: [effect(game, 2)], attacks: [] },
    mechanicalEffects: mechanical([effect(game, 5)]),
  });
  expect(result).toEqual({
    deaths: [3, 6],
    deathSources: { 3: [DeathCause.Poison], 6: [DeathCause.Poison] },
    poisonReflections: [
      { actorId: 1, protectedTargetId: 5, casterId: 2 },
      { actorId: 1, protectedTargetId: 5, casterId: 3 },
    ],
  });
});

test("absorbing one target does not suppress a different target's mechanical reflection", () => {
  const game = fixture();
  marks(game, 5, StatusMark.PoisonMark);
  marks(game, 6, StatusMark.PoisonMark);
  expect(
    new DamageResolutionSystem().resolve(game.world, {
      poisonClaims: [
        { source: scope(game, 2), target: scope(game, 5) },
        { source: scope(game, 3), target: scope(game, 6) },
      ],
      awakenedEffects: { shields: [effect(game, 5)], attacks: [] },
      mechanicalEffects: mechanical([effect(game, 5), effect(game, 6)]),
    }),
  ).toEqual({
    deaths: [3],
    deathSources: { 3: [DeathCause.Poison] },
    poisonReflections: [{ actorId: 1, protectedTargetId: 6, casterId: 3 }],
  });
});

test("self poison is absorbed without reflection or returned inventory", () => {
  const game = fixture();
  marks(game, 5, StatusMark.PoisonMark);
  expect(
    new DamageResolutionSystem().resolve(game.world, {
      poisonClaims: [{ source: scope(game, 5), target: scope(game, 5) }],
      awakenedEffects: { shields: [effect(game, 5)], attacks: [] },
      mechanicalEffects: mechanical([effect(game, 5)]),
    }),
  ).toEqual({ deaths: [], deathSources: {} });
});

test("mutual poison remains causal per source when only one victim is shielded", () => {
  const game = fixture();
  marks(game, 2, StatusMark.PoisonMark);
  marks(game, 3, StatusMark.PoisonMark);
  expect(
    new DamageResolutionSystem().resolve(game.world, {
      poisonClaims: [
        { source: scope(game, 2), target: scope(game, 3) },
        { source: scope(game, 3), target: scope(game, 2) },
      ],
      awakenedEffects: { shields: [effect(game, 2)], attacks: [] },
    }),
  ).toEqual({ deaths: [3], deathSources: { 3: [DeathCause.Poison] } });
});

test("awakened shield also blocks a mechanical extra knife after ordinary Guard and Heal cancel", () => {
  const game = fixture();
  marks(game, 5, StatusMark.GuardMark, StatusMark.HealMark, StatusMark.WolfKillMark);
  expect(
    new DamageResolutionSystem().resolve(game.world, {
      awakenedEffects: { shields: [effect(game, 5)], attacks: [] },
      mechanicalEffects: mechanical([], [effect(game, 5)]),
    }),
  ).toEqual({ deaths: [], deathSources: {} });
});

test("legacy unclaimed poison marks are blocked by awakened protection", () => {
  const game = fixture();
  marks(game, 5, StatusMark.PoisonMark);
  expect(
    new DamageResolutionSystem().resolve(game.world, {
      awakenedEffects: { shields: [effect(game, 5)], attacks: [] },
    }),
  ).toEqual({ deaths: [], deathSources: {} });
});

for (const change of ["replacement", "revival", "cancel"] as const)
  test(`${change}: stale shield and knife cannot move to a new target body or regain authorization`, () => {
    const game = fixture(),
      shield = effect(game, 5, () => change !== "cancel"),
      attack = effect(game, 6, () => change !== "cancel");
    if (change === "replacement")
      for (const id of [5, 6]) game.world.addComponent(id, COMPONENT.Alive, createAliveComponent());
    if (change === "revival")
      for (const id of [5, 6]) {
        const life = game.world.getComponent<AliveComponent>(id, COMPONENT.Alive)!;
        life.alive = false;
        life.alive = true;
      }
    marks(game, 5, StatusMark.WolfKillMark);
    expect(
      new DamageResolutionSystem().resolve(game.world, {
        awakenedEffects: { shields: [shield], attacks: [attack] },
      }),
    ).toEqual({ deaths: [5], deathSources: { 5: [DeathCause.WolfKill] } });
  });

test("owner cancellation restores ordinary poison and mechanical reflection without refunding any prefix", () => {
  const game = fixture();
  marks(game, 5, StatusMark.PoisonMark);
  const poison = [{ source: scope(game, 2), target: scope(game, 5) }];
  expect(
    new DamageResolutionSystem().resolve(game.world, {
      poisonClaims: poison,
      awakenedEffects: { shields: [effect(game, 5, () => false)], attacks: [] },
      mechanicalEffects: mechanical([effect(game, 5)]),
    }),
  ).toEqual({
    deaths: [2],
    deathSources: { 2: [DeathCause.Poison] },
    poisonReflections: [{ actorId: 1, protectedTargetId: 5, casterId: 2 }],
  });
});

test("awakened protection does not block dream, merchant backlash or mechanical failure", () => {
  const game = fixture();
  expect(
    new DamageResolutionSystem().resolve(game.world, {
      awakenedEffects: { shields: [effect(game, 5)], attacks: [] },
      consecutiveDeaths: [5],
      merchantBacklashes: [{ target: scope(game, 5), isCurrent: () => true }],
      mechanicalEffects: mechanical([], [], [effect(game, 5)]),
    }),
  ).toEqual({
    deaths: [5],
    deathSources: {
      5: [DeathCause.MechanicalGuardFailure, DeathCause.MerchantBacklash, DeathCause.Dream],
    },
  });
});

test("knife protection never suppresses an unblocked poison in a compound assault", () => {
  const game = fixture();
  marks(game, 5, StatusMark.PoisonMark, StatusMark.GuardMark);
  expect(
    new DamageResolutionSystem().resolve(game.world, {
      poisonClaims: [{ source: scope(game, 2), target: scope(game, 5) }],
      awakenedEffects: { shields: [], attacks: [effect(game, 5)] },
    }),
  ).toEqual({ deaths: [5], deathSources: { 5: [DeathCause.Poison] } });
});

test("normal extra knife uses ordinary gun permission and first-night last words, with forbidden compounds denied", () => {
  const cause = DeathCause.AwakenedHiddenKnife;
  expect(permitsDeathShot([cause])).toBe(true);
  expect(permitsDeathShot([cause, DeathCause.WolfKill, DeathCause.Shot])).toBe(true);
  for (const forbidden of [
    DeathCause.Poison,
    DeathCause.Dream,
    DeathCause.Charm,
    DeathCause.Duel,
    DeathCause.Ability,
    DeathCause.MechanicalGuardFailure,
    DeathCause.MerchantBacklash,
  ])
    expect(permitsDeathShot([cause, forbidden])).toBe(false);
  const words = new LastWordsMechanism();
  expect(words.shouldGrantLastWords(Phase.Night, 1, [cause])).toBe(true);
  expect(words.shouldGrantLastWords(Phase.Night, 2, [cause])).toBe(false);
});

test("NightPipeline delivers typed awakened proposals to Damage without exposing runtime scopes in the summary", async () => {
  const game = fixture();
  class ControlledStages extends NightStageRegistry {
    override getStages(): NightStageHandler[] {
      return [
        {
          id: "controlled_damage",
          priority: 900,
          async execute(ctx) {
            ctx.state.awakenedEffects!.shields.push(effect(game, 5));
            ctx.state.awakenedEffects!.attacks.push(effect(game, 6));
            ctx.ensureMarks(5).add(StatusMark.WolfKillMark);
          },
        },
      ];
    }
  }
  const result = await new NightPipeline({
    world: game.world,
    toolGateway: new ToolGateway(),
    damageResolutionSystem: new DamageResolutionSystem(),
    events: [],
    stageRegistry: new ControlledStages(),
  }).execute(
    config,
    {
      async getAction() {
        throw new Error("unexpected_action_request");
      },
    },
    1,
  );
  expect(result.interrupted).toBe(false);
  if (result.interrupted) throw new Error("unexpected_interruption");
  expect(result.damage).toEqual({
    deaths: [6],
    deathSources: { 6: [DeathCause.AwakenedHiddenKnife] },
  });
  expect(result.summary).toEqual({
    wolfTarget: null,
    deaths: [6],
    seerChecks: [],
    interruptedBySelfDestruct: false,
  });
  expect(JSON.stringify(result.summary)).not.toContain('"life"');
  expect(game.world.getAliveEntityIds()).toEqual([1, 2, 3, 4, 5, 6]);
});
