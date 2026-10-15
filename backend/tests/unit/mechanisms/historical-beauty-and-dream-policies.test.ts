/**
 * 单元测试：验证狼美人／摄梦历史抑制、已捕获 scope 失效、复合伤害与转移政策元数据。输入为原历史、scope 和伤害样本；原字面断言及独立 fixture 保留，不替换结算预期。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import {
  Role,
  WinCondition,
  DeathCause,
  COMPONENT,
  type BoardConfig,
  type RoleComponent,
} from "../../../src/domain";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../src/runtime/config/board_definition";
import {
  permitsCharm,
  activeCharm,
  bindCharm,
} from "../../../src/game/mechanisms/roles/wolf_beauty/relation";
import {
  DREAM_PROTECTION_POLICIES,
  BEAUTY_DEATH_LINK_POLICIES,
} from "../../../src/domain/board";
import { getDreamerState } from "../../../src/game/mechanisms/roles/dreamer/ports";
import { getWolfBeautyState } from "../../../src/game/mechanisms/roles/wolf_beauty/ports";
import {
  projectDreamerState,
  projectWolfBeautyState,
} from "../../../src/game/mechanisms/roles/player_state";
import { DamageResolutionSystem } from "../../../src/domain/systems/damage-resolution-system";
import { captureNightLife } from "../../../src/domain/night-effects";
import { DreamNightFrame } from "../../../src/game/mechanisms/roles/dreamer/night_frame";
import { captureNightAbilityScope } from "../../../src/game/mechanisms/roles/ability_scope";
import { allNightAbilities } from "../../../src/game/mechanisms/roles/abilities";
import {
  grantNightAbility,
  transferNightAbility,
} from "../../../src/game/mechanisms/roles/night-ability-grants";

function config(roles: Role[]): BoardConfig {
  return {
    ...sixPlayerMvpConfig,
    boardSize: roles.length,
    roleSetups: [...new Set(roles)].map((role) => ({
      role,
      count: roles.filter((r) => r === role).length,
    })),
    enableSheriff: false,
    winConditions: [WinCondition.SlaughterCity],
    selfDestruct: { enabledWindows: [] },
  };
}

for (const policy of BEAUTY_DEATH_LINK_POLICIES)
  test(`${policy}: all single/pair causes use explicit suppression and native Hunter attribution`, () => {
    const causes = Object.values(DeathCause);
    for (const sources of [
      [],
      ...causes.map((x) => [x]),
      ...causes.flatMap((x) => causes.map((y) => [x, y])),
    ])
      for (const hunter of [false, true]) {
        const oracle =
          policy === "awa_exile_poison_v1"
            ? !sources.includes(DeathCause.Lovers) &&
              !sources.includes(DeathCause.Duel) &&
              !sources.includes(DeathCause.Dream) &&
              sources.some((x) => [DeathCause.Exile, DeathCause.Poison].includes(x))
            : sources.length > 0 &&
              sources.every((x) => x === DeathCause.Exile || (x === DeathCause.Shot && hunter));
        expect(permitsCharm(sources, policy, hunter)).toBe(oracle);
      }
  });

test("policy changes revoke captured dream scope and established charm binding; independent DTOs reject unknown values", () => {
  const roles = [Role.Dreamer, Role.WolfBeauty, Role.Wolf, Role.Hunter, Role.Witch, Role.Villager];
  const game = bootstrapGame(config(roles), { fixedRoles: roles });
  const dreamRole = game.world.getComponent(1, COMPONENT.Role)!,
    beautyRole = game.world.getComponent(2, COMPONENT.Role)!;
  const ability = allNightAbilities(dreamRole).find((a) => a.kind === "dream")!;
  const scope = captureNightAbilityScope(game.world, 1, ability, 1, () => true)!;
  expect(scope.isEligible()).toBe(true);
  (
    getDreamerState(dreamRole)! as {
      protectionPolicy: "awa_night_damage_v1" | "netease_2026_night_immunity_v1" | undefined;
    }
  ).protectionPolicy = "netease_2026_night_immunity_v1";
  expect(scope.isEligible()).toBe(false);
  (getWolfBeautyState(beautyRole)! as { targetId: number | null }).targetId = 6;
  bindCharm(game.world, 2, 6);
  expect(activeCharm(game.world, 2)).not.toBeNull();
  (
    getWolfBeautyState(beautyRole)! as {
      deathLinkPolicy: "awa_exile_poison_v1" | "heroes_s7_2017_exile_hunter_v1" | undefined;
    }
  ).deathLinkPolicy = "heroes_s7_2017_exile_hunter_v1";
  expect(activeCharm(game.world, 2)).toBeNull();
  expect(
    projectDreamerState({ protectionPolicy: "arbitrary", history: [], secret: 1 }),
  ).not.toHaveProperty("protectionPolicy");
  expect(
    projectWolfBeautyState({ deathLinkPolicy: "arbitrary", history: [], secret: 1 }),
  ).not.toHaveProperty("deathLinkPolicy");
});

for (const policy of DREAM_PROTECTION_POLICIES)
  test(`${policy}: actual frame + compound mechanical failure/black backlash; Dream stays lethal`, () => {
    const roles = [Role.Dreamer, Role.Wolf, Role.Wolf, Role.Villager, Role.Villager, Role.Villager];
    const game = bootstrapGame(
      { ...config(roles), dreamer: { protectionPolicy: policy } },
      { fixedRoles: roles },
    );
    const actor = captureNightLife(game.world, 1)!,
      target = captureNightLife(game.world, 4)!;
    const frame = new DreamNightFrame([
      {
        actorId: 1,
        targetId: 4,
        day: 1,
        consecutive: false,
        protectionPolicy: policy,
        actorLife: actor.life,
        actorVersion: actor.version,
        targetLife: target.life,
        targetVersion: target.version,
      },
    ]);
    const damage = new DamageResolutionSystem().resolve(game.world, {
      protectedTargets: frame.protectedTargets(game.world),
      immuneNightTargets: frame.immuneNightTargets(game.world),
      blackMarketBacklashes: [{ target, isCurrent: () => true }],
      mechanicalEffects: {
        failures: [{ actorId: 4, target, isCurrent: () => true }],
        shields: [],
        attacks: [],
      },
      consecutiveDeaths: [4],
    });
    expect(damage.deathSources[4]).toEqual(
      policy === "awa_night_damage_v1"
        ? [DeathCause.MechanicalGuardFailure, DeathCause.BlackMarketBacklash, DeathCause.Dream]
        : [DeathCause.Dream],
    );
  });

for (const roleId of ["dreamer", "wolf_beauty"] as const)
  test(`${roleId}: defaults, omitted/empty parameters, finite names, reverse config and rejection paths`, () => {
    const roles = [
      Role.Dreamer,
      Role.WolfBeauty,
      Role.Wolf,
      Role.Hunter,
      Role.Witch,
      Role.Villager,
    ];
    const field = roleId === "dreamer" ? "protectionPolicy" : "deathLinkPolicy",
      values = roleId === "dreamer" ? DREAM_PROTECTION_POLICIES : BEAUTY_DEATH_LINK_POLICIES;
    const raw = boardDefinitionFromConfig("historical_schema", config(roles));
    for (const input of [undefined, {}, ...values.map((value) => ({ [field]: value }))]) {
      const candidate = structuredClone(raw);
      delete candidate.roles[roleId];
      if (input !== undefined) candidate.roles[roleId] = input;
      const parsed = parseBoardDefinition(candidate),
        selected = (input as Record<string, string> | undefined)?.[field] ?? values[0];
      expect(parsed.definition.roles[roleId]).toEqual({ [field]: selected });
      expect(
        parseBoardDefinition(boardDefinitionFromConfig("historical_schema", parsed.config)).config,
      ).toEqual(parsed.config);
    }
    for (const bad of [{ [field]: "unverified_v1" }, { selfDream: true }, { immunePoison: false }])
      expect(() =>
        parseBoardDefinition({ ...raw, roles: { ...raw.roles, [roleId]: bad } }),
      ).toThrow("board_config_invalid_field");
    const absent = boardDefinitionFromConfig(
      "absent",
      config([Role.Wolf, Role.Wolf, Role.Hunter, Role.Witch, Role.Villager, Role.Villager]),
    );
    absent.roles[roleId] = { [field]: values[0] };
    expect(() => parseBoardDefinition(absent)).toThrow("board_config_role_parameters_without_role");
  });

for (const policy of DREAM_PROTECTION_POLICIES)
  test(`${policy}: grant and transfer preserve instance policy/counters; receiver native config does not rewrite it`, () => {
    const roles = [Role.Dreamer, Role.Wolf, Role.Wolf, Role.Villager, Role.Villager, Role.Villager];
    const game = bootstrapGame(
      { ...config(roles), dreamer: { protectionPolicy: "netease_2026_night_immunity_v1" } },
      { fixedRoles: roles },
    );
    const events: import("../../../src/domain").GameEvent[] = [];
    const gift = grantNightAbility(
      game.world,
      4,
      {
        id: "gift:dream",
        kind: "dream",
        source: { kind: "gift", actorId: 1 },
        state: {
          lastTarget: 6,
          lastDay: 1,
          history: [{ day: 1, targetId: 6 }],
          protectionPolicy: policy,
        },
        startsOnDay: 1,
        maxUses: 3,
      },
      events,
    );
    (gift as { uses: number }).uses = 1;
    (gift as { lastUsedDay: number | null }).lastUsedDay = 1;
    expect(() =>
      transferNightAbility(game.world, 4, 5, gift.id, "transfer:dream", events, {
        kind: "dream",
        statePolicy: (s) => ({
          ...s,
          protectionPolicy:
            policy === "awa_night_damage_v1"
              ? "netease_2026_night_immunity_v1"
              : "awa_night_damage_v1",
        }),
      }),
    ).toThrow("ability_transfer_resources_changed");
    expect(
      allNightAbilities(game.world.getComponent(4, COMPONENT.Role)).find(
        (a) => a.id === gift.id,
      ),
    ).toBe(gift);
    transferNightAbility(game.world, 4, 5, gift.id, "transfer:dream", events, {
      kind: "dream",
      statePolicy: (s) => structuredClone(s),
    });
    const received = allNightAbilities(
      game.world.getComponent(5, COMPONENT.Role),
    ).find((a) => a.id === "transfer:dream")!;
    expect(received.state).toEqual(gift.state);
    expect(received.uses).toBe(1);
    expect(received.lastUsedDay).toBe(1);
    expect(received.source).toEqual({ kind: "transfer", actorId: 4, abilityId: gift.id });
    expect(projectDreamerState(received.state).protectionPolicy).toBe(policy);
  });
