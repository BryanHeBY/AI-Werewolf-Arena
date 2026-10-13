/**
 * Scenario tests drive actual DeathResolution for configured native permits and gift/copied guns. Inputs are fixed role boards and original policy mutations during real requests; literal gun proposal, event and permit-closure expectations are the oracle. Production policies and the original death chain order are not rewritten.
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import {
  COMPONENT,
  DeathCause,
  Phase,
  Role,
  type BoardConfig,
  type GameEvent,
  type RoleComponent,
  type DeathActionPolicy,
  type InspectionPolicy,
} from "../../../src/core";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../src/runtime/config/board_definition";
import { getHunterState } from "../../../src/game/mechanisms/roles/hunter/ports";
import { getWolfKingState } from "../../../src/game/mechanisms/roles/wolf_king/ports";
import { DeathResolution } from "../../../src/game/engine/death_resolution";
import { EventRegistry } from "../../../src/game/engine/event_registry";
import { ToolGateway } from "../../../src/game/gateway/tool_gateway";

const keys = {
  [Role.Gargoyle]: "gargoyle",
  [Role.Psychic]: "psychic",
  [Role.MirrorGirl]: "mirrorGirl",
  [Role.Hunter]: "hunter",
  [Role.WolfKing]: "wolfKing",
} as const;

function fixture(
  kind: keyof typeof keys,
  parameters?: { inspectionPolicy: InspectionPolicy } | { deathActionPolicy: DeathActionPolicy },
  locale: "zh-CN" | "en" = "en",
) {
  const roles = [kind, Role.Wolf, Role.Seer, Role.Witch, Role.Villager, Role.Villager];
  const raw: BoardConfig = {
    ...sixPlayerMvpConfig,
    roleSetups: [...new Set(roles)].map((role) => ({
      role,
      count: roles.filter((x) => x === role).length,
    })),
    ...(parameters ? { [keys[kind]]: parameters } : {}),
  };
  const config = parseBoardDefinition(boardDefinitionFromConfig("role_policy", raw)).config;
  return { ...bootstrapGame(config, { fixedRoles: roles, locale }), config };
}

for (const kind of [Role.Hunter, Role.WolfKing] as const)
  test(`${kind}: death request policy edit revokes real gateway permit and late selection`, async () => {
    const game = fixture(kind),
      role = game.world.getComponent<RoleComponent>(1, COMPONENT.Role)!,
      state = kind === Role.Hunter ? getHunterState(role)! : getWolfKingState(role)!;
    const events: GameEvent[] = [],
      snapshot = { ...game.phaseManager.getSnapshot(), phase: Phase.Day };
    let asks = 0;
    const resolver = new DeathResolution(
      game.world,
      events,
      new ToolGateway(),
      new EventRegistry(),
      snapshot,
    );
    await resolver.resolve(
      [1],
      { 1: [DeathCause.Shot] },
      {
        async getAction(request) {
          if (request.allowedTools.includes("shoot")) {
            asks++;
            (
              state as {
                deathActionPolicy:
                  | "awa_qualified_sources_v1"
                  | "awa_knife_or_exile_v1"
                  | "awa_day_deaths_v1"
                  | undefined;
              }
            ).deathActionPolicy = "awa_knife_or_exile_v1";
            expect(
              new ToolGateway().validateAndSanitize(
                game.world,
                1,
                { name: "shoot", args: { target_id: 2 } },
                {
                  phase: request.phase,
                  day: request.context.day,
                  deathActionId: request.context.death_action_id,
                },
              ).ok,
            ).toBe(false);
            return { name: "shoot", args: { target_id: 2 } };
          }
          return { name: "speak", args: { text: "Offline" } };
        },
      },
      Phase.Day,
      Phase.Day,
    );
    expect(asks).toBe(1);
    expect(events.filter((e) => e.type === "hunter_shot" || e.type === "wolf_king_shot")).toEqual(
      [],
    );
    expect(state.canShoot).toBe(true);
    expect(
      events.filter((e) => e.type === "hunter_shot" || e.type === "wolf_king_shot"),
    ).toHaveLength(0);
    expect(
      new ToolGateway().validateAndSanitize(
        game.world,
        1,
        { name: "shoot", args: { target_id: 2 } },
        { phase: Phase.Day, day: 1, deathActionId: 1 },
      ).ok,
    ).toBe(false);
  });

test("strict native Hunter policy does not restrict an independently gifted gun on the same holder", async () => {
  const { grantDeathGun, armDeathGun } =
    await import("../../../src/game/mechanisms/roles/death_abilities");
  const game = fixture(Role.Hunter, { deathActionPolicy: "awa_knife_or_exile_v1" }),
    events: GameEvent[] = [];
  const gun = grantDeathGun(game.world, 3, 1, 1, events);
  armDeathGun(game.world, 1, gun, 1, events);
  const snapshot = { day: 1, phase: Phase.Day, gameOver: false, result: null };
  let nativeAsks = 0,
    giftAsks = 0;
  await new DeathResolution(
    game.world,
    events,
    new ToolGateway(),
    new EventRegistry(),
    snapshot,
  ).resolve(
    [1],
    { 1: [DeathCause.Shot] },
    {
      async getAction(request) {
        if (request.allowedTools.includes("shoot")) {
          if (request.context.ability_id === gun.id) giftAsks++;
          else nativeAsks++;
          return { name: "shoot", args: { target_id: 2 } };
        }
        return { name: "speak", args: { text: "Offline" } };
      },
    },
    Phase.Day,
    Phase.Day,
  );
  expect(nativeAsks).toBe(0);
  expect(giftAsks).toBe(1);
  expect(events.filter((e) => e.type === "hunter_shot")).toEqual([]);
  expect(events.filter((e) => e.type === "player_shot")).toHaveLength(1);
  expect(gun.remaining).toBe(0);
  expect(game.world.activeDeathActionCount).toBe(0);
});

for (const kind of [Role.MechanicalWolf, Role.AwakenedHiddenWolf] as const)
  test(`${kind}: learning a strict-policy Hunter retains the copied gun's original death-cause policy`, async () => {
    const roles = [
      kind,
      Role.Hunter,
      kind === Role.MechanicalWolf ? Role.Psychic : Role.MirrorGirl,
      Role.Witch,
      Role.Villager,
      Role.Villager,
    ];
    const config: BoardConfig = {
      ...sixPlayerMvpConfig,
      roleSetups: roles.map((role) => ({ role, count: 1 })),
      hunter: { deathActionPolicy: "awa_knife_or_exile_v1" },
    };
    const game = bootstrapGame(config, { fixedRoles: roles }),
      role = game.world.getComponent<RoleComponent>(1, COMPONENT.Role)!,
      events: GameEvent[] = [];
    if (kind === Role.MechanicalWolf) {
      const m = await import("../../../src/game/mechanisms/roles/mechanical_wolf/state");
      const state = m.getMechanicalState(role)!;
      expect(m.learnMechanicalRole(state, 2, "hunter", 1)).toBe(true);
      m.advanceMechanicalNight(state, 2);
    } else {
      const m = await import("../../../src/game/mechanisms/roles/awakened_hidden_wolf/state");
      const state = m.getAwakenedState(role)!;
      expect(m.learnAwakenedRole(state, 2, "hunter", 1)).toBe(true);
      expect(m.activateAwakenedLearning(state, 1)).toBe(true);
    }
    let asks = 0;
    await new DeathResolution(game.world, events, new ToolGateway(), new EventRegistry(), {
      day: 2,
      phase: Phase.Day,
      gameOver: false,
      result: null,
    }).resolve(
      [1],
      { 1: [DeathCause.Shot] },
      {
        async getAction(request) {
          if (request.allowedTools.includes("shoot")) {
            asks++;
            return { name: "shoot", args: { target_id: 5 } };
          }
          return { name: "speak", args: { text: "Offline" } };
        },
      },
      Phase.Day,
      Phase.Day,
    );
    expect(asks).toBe(1);
    expect(
      events.filter((e) => e.type === "mechanical_shot" || e.type === "player_shot"),
    ).toHaveLength(1);
    expect(
      getHunterState(game.world.getComponent<RoleComponent>(2, COMPONENT.Role)!)?.canShoot,
    ).toBe(true);
    expect(game.world.activeDeathActionCount).toBe(0);
  });
