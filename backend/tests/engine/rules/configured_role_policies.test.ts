/**
 * Tests configured target/action policies through validators, native/recipient
 * stages and controlled phase flows. Inputs are literal boards, scripted actions
 * and deliberate live-slot edits; outputs are request options, inspection history,
 * effect records and original error codes asserted from handwritten expectations.
 * Test-only field casts preserve those old mutations; no model or fixture oracle
 * is regenerated and this mixed legacy file does not define production policy.
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import {
  COMPONENT,
  DeathCause,
  Phase,
  Role,
  permitsDeathShot,
  type BoardConfig,
  type ActionRequest,
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
import { boardConfigSchema } from "../../../src/core/domain/board_schema";
import { getDefaultRoleCatalog } from "../../../src/game/mechanisms/roles/catalog";
import {
  findNightAbility,
  projectNightAbility,
} from "../../../src/game/mechanisms/roles/abilities";
import {
  grantNightAbility,
  transferNightAbility,
} from "../../../src/game/mechanisms/roles/ability_changes";
import {
  ROLE_INSPECTION_STAGE,
  PSYCHIC_INSPECTION_STAGE,
  MIRROR_INSPECTION_STAGE,
} from "../../../src/game/mechanisms/roles/role_inspection/night_stages";
import { roleInspectionTargets } from "../../../src/game/mechanisms/roles/role_inspection/rules";
import { getHunterState, getWolfKingState } from "../../../src/game/mechanisms/roles/private_state";
import { hunterDeathHook } from "../../../src/game/mechanisms/roles/hunter/death_hook";
import { WOLF_KING_ROLE_PROFILE } from "../../../src/game/mechanisms/roles/wolf_king/profile";
import { GameActionRequestFactory } from "../../../src/game/engine/action_request_factory";
import { DeathResolution } from "../../../src/game/engine/death_resolution";
import { EventRegistry } from "../../../src/game/engine/event_registry";
import { getDefaultTargetHintRegistry } from "../../../src/game/mechanisms/llm/target_hint_registry";
import { getDefaultConfigRenderRegistry } from "../../../src/game/mechanisms/prompt/config_render_registry";
import { ToolGateway } from "../../../src/game/gateway/tool_gateway";
import { ObservedBot } from "../../../src/ai/agents/providers/observed_bot";
import { ObservedPlayersActionProvider } from "../../../src/ai/agents/providers/observed_players";
import { nightStageContext } from "../night_stage_fixture";

const inspectionPolicies = [
  "awa_unique_required_v1",
  "awa_repeat_optional_v1",
  "awa_unique_optional_v1",
] as const;
const deathPolicies = ["awa_qualified_sources_v1", "awa_knife_or_exile_v1"] as const;
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
for (const kind of [
  Role.Gargoyle,
  Role.Psychic,
  Role.MirrorGirl,
  Role.Hunter,
  Role.WolfKing,
] as const)
  test(`${kind}: omitted, empty, explicit defaults and legacy reverse config normalize identically; unknown variants fail closed`, () => {
    const game = fixture(kind),
      contribution = getDefaultRoleCatalog().require(kind).configuration!;
    const publicBoard = boardDefinitionFromConfig("role_policy", game.config);
    const omitted = structuredClone(publicBoard);
    delete omitted.roles[kind];
    const empty = structuredClone(publicBoard);
    empty.roles[kind] = {};
    expect(contribution.schema.parse({})).toEqual(contribution.defaults);
    expect(parseBoardDefinition(omitted).config).toEqual(game.config);
    expect(parseBoardDefinition(empty).config).toEqual(game.config);
    expect(boardConfigSchema.parse(JSON.parse(JSON.stringify(game.config)))).toEqual(game.config);
    expect(() =>
      parseBoardDefinition({
        ...publicBoard,
        roles: { ...publicBoard.roles, [kind]: { unknown: true } },
      }),
    ).toThrow();
    const field =
      kind === Role.Hunter || kind === Role.WolfKing ? "deathActionPolicy" : "inspectionPolicy";
    expect(() =>
      parseBoardDefinition({
        ...publicBoard,
        roles: { ...publicBoard.roles, [kind]: { [field]: "universal" } },
      }),
    ).toThrow();
  });
for (const kind of [Role.Gargoyle, Role.Psychic, Role.MirrorGirl] as const)
  for (const policy of inspectionPolicies)
    for (const locale of ["zh-CN", "en"] as const)
      test(`${kind}/${policy}/${locale}: real stage, late validation, target hints, baseline and DTO consume instance policy without changing identity`, async () => {
        const game = fixture(kind, { inspectionPolicy: policy }, locale),
          role = game.world.getComponent<RoleComponent>(1, COMPONENT.Role)!;
        const ability = findNightAbility(role, "role_check")!;
        const stage =
          kind === Role.Gargoyle
            ? ROLE_INSPECTION_STAGE
            : kind === Role.Psychic
              ? PSYCHIC_INSPECTION_STAGE
              : MIRROR_INSPECTION_STAGE;
        const requests: ActionRequest[] = [],
          events: GameEvent[] = [];
        const act = async (day: number, target: number | null) => {
          const factory = new GameActionRequestFactory(game.world, events, day);
          await stage.execute(
            nightStageContext({
              world: game.world,
              events,
              currentDay: () => day,
              makeRequest: (actorId, allowedTools, extra) =>
                factory.create({
                  actorId,
                  allowedTools,
                  phase: Phase.Night,
                  stage: extra.stage,
                  context: extra,
                  requiresAction: extra.requiresAction ?? true,
                  summary: "Offline",
                }),
              actionProvider: {
                async getAction(request) {
                  requests.push(request);
                  return target === null
                    ? null
                    : { name: "inspect_role", args: { target_id: target } };
                },
              },
            }),
          );
        };
        await act(1, 2);
        expect(requests[0].context.stage).toBe(
          kind === Role.Gargoyle
            ? "role_inspection"
            : kind === Role.Psychic
              ? "psychic"
              : "mirror_girl",
        );
        expect(requests[0].context.turn_constraints.min_valid_actions).toBe(
          policy === "awa_unique_required_v1" ? 1 : 0,
        );
        expect(ability.state.history).toHaveLength(1);
        const repeated = roleInspectionTargets(game.world, 1, ability.state).includes(2);
        expect(repeated).toBe(policy === "awa_repeat_optional_v1");
        const gateway = new ToolGateway();
        expect(
          gateway.validateAndSanitize(
            game.world,
            1,
            { name: "inspect_role", args: { target_id: 2 } },
            { phase: Phase.Night, day: 2, abilityId: ability.id },
          ).ok,
        ).toBe(repeated);
        const hint = getDefaultTargetHintRegistry().buildActionableIdsHint({
          world: game.world,
          actorId: 1,
          actorRole: kind,
          day: 2,
          abilityId: ability.id,
          allowedTools: ["inspect_role"],
        })!;
        expect(
          hint
            .match(/\b\d+\b/g)
            ?.map(Number)
            .includes(2),
        ).toBe(repeated);
        const factory = new GameActionRequestFactory(game.world, events, 2);
        const request = factory.create({
          actorId: 1,
          allowedTools: ["inspect_role"],
          phase: Phase.Night,
          stage: requests[0].context.stage,
          context: { ability_id: ability.id },
          requiresAction: policy === "awa_unique_required_v1",
          summary: "Offline",
        });
        const baseline = getDefaultRoleCatalog().require(kind).baselineAction!(
          role,
          request,
          () => 2,
          () => 2,
          locale,
          game.world,
        );
        expect(baseline?.name).toBe("inspect_role");
        if (baseline?.name === "inspect_role")
          expect(roleInspectionTargets(game.world, 1, ability.state)).toContain(
            baseline.args.target_id,
          );
        const observed = new ObservedPlayersActionProvider(
          game.world,
          new Map([[1, new ObservedBot({ next: () => 0 }, "conservative")]]),
          game.config,
        );
        const bot = await observed.getAction(request);
        expect(bot === null).toBe(policy !== "awa_unique_required_v1");
        if (policy !== "awa_unique_required_v1") {
          await act(2, null);
          expect(ability.lastUsedDay).toBe(2);
          expect(ability.uses).toBe(1);
        }
        const dto = projectNightAbility(ability, 3);
        expect(dto.kind).toBe("role_check");
        if (dto.kind === "role_check")
          expect<unknown>(dto.state.history).toEqual(ability.state.history);
        expect(
          getDefaultConfigRenderRegistry().renderBoardConfigPrompt(game.config, locale),
        ).toContain(locale === "en" ? "Configured AWA inspection" : "配置的AWA查验");
        expect(role.renderPrompt?.(locale)).toContain(
          locale === "en" ? "Configured AWA inspection" : "配置的AWA查验",
        );
        expect(role.role).toBe(kind);
      });
for (const kind of [Role.Gargoyle, Role.Psychic, Role.MirrorGirl] as const)
  for (const point of ["construct", "await", "gateway"] as const)
    test(`${kind}/${point}: policy mutation revokes pending inspection rather than reinterpreting it`, async () => {
      const game = fixture(kind, { inspectionPolicy: "awa_unique_required_v1" }),
        role = game.world.getComponent<RoleComponent>(1, COMPONENT.Role)!,
        ability = findNightAbility(role, "role_check")!,
        events: GameEvent[] = [];
      const stage =
        kind === Role.Gargoyle
          ? ROLE_INSPECTION_STAGE
          : kind === Role.Psychic
            ? PSYCHIC_INSPECTION_STAGE
            : MIRROR_INSPECTION_STAGE;
      const factory = new GameActionRequestFactory(game.world, events, 1),
        gateway = new ToolGateway();
      let asks = 0;
      const mutate = () => {
        (
          ability.state as {
            inspectionPolicy:
              | "awa_unique_required_v1"
              | "awa_repeat_optional_v1"
              | "awa_unique_optional_v1"
              | undefined;
          }
        ).inspectionPolicy = "awa_repeat_optional_v1";
      };
      if (point === "gateway") {
        const original = gateway.validateAndSanitize.bind(gateway);
        gateway.validateAndSanitize = (...args) => {
          const result = original(...args);
          mutate();
          return result;
        };
      }
      await stage.execute(
        nightStageContext({
          world: game.world,
          events,
          toolGateway: gateway,
          makeRequest: (actorId, allowedTools, extra) => {
            const request = factory.create({
              actorId,
              allowedTools,
              phase: Phase.Night,
              stage: extra.stage,
              context: extra,
              requiresAction: extra.requiresAction ?? true,
              summary: "Offline",
            });
            if (point === "construct") mutate();
            return request;
          },
          actionProvider: {
            async getAction() {
              asks++;
              if (point === "await") mutate();
              return { name: "inspect_role", args: { target_id: 2 } };
            },
          },
        }),
      );
      expect(asks).toBe(point === "construct" ? 0 : 1);
      expect(ability.state.history).toEqual([]);
      expect(ability.uses).toBe(0);
      expect(ability.lastUsedDay).toBeNull();
      expect(events.filter((e) => e.type === "role_inspected")).toEqual([]);
    });
for (const kind of [Role.Hunter, Role.WolfKing] as const)
  for (const policy of deathPolicies)
    test(`${kind}/${policy}: every single and compound death cause follows native policy; poison, empty and unknown remain blocked`, async () => {
      const eligible = [
        DeathCause.WolfKill,
        DeathCause.MechanicalKnife,
        DeathCause.AwakenedHiddenKnife,
        DeathCause.Exile,
        ...(policy === "awa_qualified_sources_v1"
          ? [DeathCause.Shot, DeathCause.WhiteWolfBlast]
          : []),
      ];
      const cases = [
        ...Object.values(DeathCause).map((c) => [c]),
        [],
        [DeathCause.WolfKill, DeathCause.Exile],
        [DeathCause.WolfKill, DeathCause.Shot],
        [DeathCause.WolfKill, DeathCause.Poison],
        [DeathCause.Shot, DeathCause.Charm],
        ["unknown" as DeathCause],
      ];
      for (const sources of cases) {
        const game = fixture(kind, { deathActionPolicy: policy }),
          role = game.world.getComponent<RoleComponent>(1, COMPONENT.Role)!;
        game.world.getComponent<{ alive: boolean }>(1, COMPONENT.Alive)!.alive = false;
        let asks = 0;
        const events: GameEvent[] = [];
        const hook = kind === Role.Hunter ? hunterDeathHook : WOLF_KING_ROLE_PROFILE.deathHook!;
        let permit: ReturnType<typeof game.world.openDeathAction> | undefined;
        const result = await hook(
          game.world,
          [1],
          { 1: sources },
          async () => {
            asks++;
            permit = game.world.openDeathAction(1, "shoot", Phase.Day, 1);
            return { kind: "shot", targetId: 2, deathActionId: permit.id };
          },
          events,
        );
        permit?.close();
        const can = sources.length > 0 && sources.every((c) => eligible.includes(c));
        expect(permitsDeathShot(sources, policy)).toBe(can);
        expect(asks).toBe(can ? 1 : 0);
        expect(result.extraDeaths).toEqual(can ? [2] : []);
        expect(
          kind === Role.Hunter ? getHunterState(role)?.canShoot : getWolfKingState(role)?.canShoot,
        ).toBe(false);
      }
    });
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
            state.deathActionPolicy = "awa_knife_or_exile_v1";
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

test("gift/copy explicit inspection state is independent of holder board; transfer retains configured history", () => {
  const game = fixture(Role.Psychic, { inspectionPolicy: "awa_unique_required_v1" }),
    events: GameEvent[] = [];
  const gift = grantNightAbility(
    game.world,
    5,
    {
      id: "gift:policy",
      kind: "role_check",
      state: {
        policy: "psychic",
        inspectionPolicy: "awa_repeat_optional_v1",
        lastTarget: null,
        lastDay: null,
        history: [],
      },
      source: { kind: "gift", actorId: 1 },
      startsOnDay: 1,
      maxUses: null,
    },
    events,
  );
  (
    gift.state.history as {
      day: number;
      targetId: import("@ai-werewolf-arena/game-contract").EntityId;
      result: Extract<
        import("@ai-werewolf-arena/game-contract").InspectionResult,
        { kind: "role" }
      >;
    }[]
  ).push({ day: 1, targetId: 2, result: { kind: "role", role: Role.Wolf } });
  expect(roleInspectionTargets(game.world, 5, gift.state)).toContain(2);
  transferNightAbility(game.world, 5, 6, gift.id, "transfer:policy", events, {
    kind: "role_check",
    statePolicy: (state) => structuredClone(state),
  });
  const transferred = findNightAbility(
    game.world.getComponent<RoleComponent>(6, COMPONENT.Role),
    "role_check",
    "transfer:policy",
  )!;
  expect(transferred.state).toEqual(gift.state);
  expect(
    findNightAbility(game.world.getComponent<RoleComponent>(1, COMPONENT.Role), "role_check")?.state
      .inspectionPolicy,
  ).toBe("awa_unique_required_v1");
});

for (const kind of [Role.Gargoyle, Role.Psychic, Role.MirrorGirl] as const)
  for (const policy of inspectionPolicies)
    test(`${kind}/${policy}: missing/invalid actions are bounded and exhausted targets do not force an impossible request`, async () => {
      const game = fixture(kind, { inspectionPolicy: policy }),
        role = game.world.getComponent<RoleComponent>(1, COMPONENT.Role)!,
        ability = findNightAbility(role, "role_check")!;
      const stage =
        kind === Role.Gargoyle
          ? ROLE_INSPECTION_STAGE
          : kind === Role.Psychic
            ? PSYCHIC_INSPECTION_STAGE
            : MIRROR_INSPECTION_STAGE;
      const events: GameEvent[] = [],
        factory = new GameActionRequestFactory(game.world, events, 1);
      let asks = 0;
      const context = nightStageContext({
        world: game.world,
        events,
        makeRequest: (actorId, allowedTools, extra) =>
          factory.create({
            actorId,
            allowedTools,
            phase: Phase.Night,
            stage: extra.stage,
            context: extra,
            requiresAction: extra.requiresAction ?? true,
            summary: "Offline",
          }),
        actionProvider: {
          async getAction() {
            asks++;
            return null;
          },
        },
      });
      if (policy === "awa_unique_required_v1") {
        await expect(stage.execute(context)).rejects.toThrow(
          kind === Role.Gargoyle
            ? "role_inspection_required_action_missing"
            : "role_inspection_valid_action_missing",
        );
        expect(asks).toBe(3);
        expect(ability.lastUsedDay).toBeNull();
      } else {
        await stage.execute(context);
        expect(asks).toBe(1);
        expect(ability.lastUsedDay).toBe(1);
      }
      expect(ability.uses).toBe(0);
      // A fresh World avoids authorizing reentry through an already committed optional pass.
      const exhausted = fixture(kind, { inspectionPolicy: policy }),
        exhaustedRole = exhausted.world.getComponent<RoleComponent>(1, COMPONENT.Role)!,
        exhaustedAbility = findNightAbility(exhaustedRole, "role_check")!;
      for (const id of exhausted.world.getAliveEntityIds().filter((id) => id !== 1)) {
        if (policy === "awa_repeat_optional_v1")
          exhausted.world.getComponent<{ alive: boolean }>(id, COMPONENT.Alive)!.alive = false;
        else
          (
            exhaustedAbility.state.history as {
              day: number;
              targetId: import("@ai-werewolf-arena/game-contract").EntityId;
              result: Extract<
                import("@ai-werewolf-arena/game-contract").InspectionResult,
                { kind: "role" }
              >;
            }[]
          ).push({
            day: 1,
            targetId: id,
            result: { kind: "role", role: Role.Villager },
          });
      }
      await stage.execute(
        nightStageContext({
          world: exhausted.world,
          actionProvider: {
            async getAction() {
              throw new Error("must_not_request_exhausted");
            },
          },
          makeRequest() {
            throw new Error("must_not_construct_exhausted");
          },
        }),
      );
      expect(exhaustedAbility.uses).toBe(0);
    });

test("optional Gargoyle pass completes only its native current-policy knife gate", async () => {
  const { canGargoyleKnife, refreshGargoyleInheritance } =
    await import("../../../src/game/mechanisms/roles/gargoyle/inheritance");
  const game = fixture(Role.Gargoyle, { inspectionPolicy: "awa_unique_optional_v1" }),
    role = game.world.getComponent<RoleComponent>(1, COMPONENT.Role)!,
    ability = findNightAbility(role, "role_check")!,
    events: GameEvent[] = [];
  game.world.getComponent<{ alive: boolean }>(2, COMPONENT.Alive)!.alive = false;
  refreshGargoyleInheritance(game.world, events, 1);
  expect(canGargoyleKnife(role, game.world)).toBe(false);
  const factory = new GameActionRequestFactory(game.world, events, 1);
  await ROLE_INSPECTION_STAGE.execute(
    nightStageContext({
      world: game.world,
      events,
      makeRequest: (actorId, allowedTools, extra) =>
        factory.create({
          actorId,
          allowedTools,
          phase: Phase.Night,
          stage: extra.stage,
          context: extra,
          requiresAction: extra.requiresAction ?? true,
          summary: "Offline",
        }),
      actionProvider: {
        async getAction() {
          return null;
        },
      },
    }),
  );
  expect(canGargoyleKnife(role, game.world)).toBe(true);
  expect(ability.uses).toBe(0);
  (
    ability.state as {
      inspectionPolicy:
        "awa_unique_required_v1" | "awa_repeat_optional_v1" | "awa_unique_optional_v1" | undefined;
    }
  ).inspectionPolicy = "awa_unique_required_v1";
  expect(canGargoyleKnife(role, game.world)).toBe(false);
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

test("a native death proposal is revoked by a policy edit before central commit", async () => {
  const game = fixture(Role.Hunter),
    role = game.world.getComponent<RoleComponent>(1, COMPONENT.Role)!,
    state = getHunterState(role)!,
    events: GameEvent[] = [];
  game.world.getComponent<{ alive: boolean }>(1, COMPONENT.Alive)!.alive = false;
  const permit = game.world.openDeathAction(1, "shoot", Phase.Day, 1);
  try {
    const result = await hunterDeathHook(
      game.world,
      [1],
      { 1: [DeathCause.Shot] },
      async () => ({ kind: "shot", targetId: 2, deathActionId: permit.id }),
      events,
      { day: 1, deferShotCommit: true, nightEffect: false, blocksNightShot: () => false },
    );
    expect(result.pendingShots).toHaveLength(1);
    expect(result.pendingShots![0].isCurrent?.()).toBe(true);
    state.deathActionPolicy = "awa_knife_or_exile_v1";
    expect(result.pendingShots![0].isCurrent?.()).toBe(false);
  } finally {
    permit.close();
  }
});

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: mixed board policy descriptions identify the role they govern`, () => {
    const roles = [
      Role.WolfKing,
      Role.Hunter,
      Role.Gargoyle,
      Role.Psychic,
      Role.MirrorGirl,
      Role.Villager,
    ];
    const config: BoardConfig = {
      ...sixPlayerMvpConfig,
      roleSetups: roles.map((role) => ({ role, count: 1 })),
      hunter: { deathActionPolicy: "awa_knife_or_exile_v1" },
      wolfKing: { deathActionPolicy: "awa_qualified_sources_v1" },
      gargoyle: { inspectionPolicy: "awa_repeat_optional_v1" },
      psychic: { inspectionPolicy: "awa_unique_required_v1" },
      mirrorGirl: { inspectionPolicy: "awa_unique_optional_v1" },
    };
    const prompt = getDefaultConfigRenderRegistry().renderBoardConfigPrompt(config, locale);
    expect(prompt).toContain(
      locale === "en" ? "Hunter: Configured AWA native gun" : "猎人: 配置的AWA原生枪",
    );
    expect(prompt).toContain(
      locale === "en" ? "Wolf King: Configured native gun" : "狼王: 配置的原生枪",
    );
    expect(prompt).toContain(
      locale === "en" ? "Gargoyle: Configured AWA inspection" : "石像鬼: 配置的AWA查验",
    );
    expect(prompt).toContain(
      locale === "en" ? "Spirit Seer: Configured AWA inspection" : "通灵师: 配置的AWA查验",
    );
    expect(prompt).toContain(
      locale === "en" ? "Mirror Girl: Configured AWA inspection" : "魔镜少女: 配置的AWA查验",
    );
  });
