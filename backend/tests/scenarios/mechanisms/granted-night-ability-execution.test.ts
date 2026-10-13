/**
 * Scenario tests for night ability shared contracts. Inputs are original grant/copy/transfer/expiry
 * instances and configured native state. Original literal receipts, reference/getter/error traces, facts
 * and expected state remain the oracle. Actual NightPipeline executes independent granted instances,
 * permission invalidation, expiry and per-instance resources. Engine sequencing remains real and models
 * remain controlled providers; production output is not a newly generated golden.
 */
import { completedNight } from "../../engine/night_stage_fixture";
import { PotionType } from "../../../src/core";
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import {
  COMPONENT,
  Phase,
  Role,
  WitchSelfHealRule,
  type ActionRequest,
  type GameEvent,
  type RoleComponent,
} from "../../../src/core";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";
import {
  allNightAbilities,
  activeNightAbility,
  abilityStatus,
} from "../../../src/game/mechanisms/roles/abilities";
import {
  grantNightAbility,
  setNightAbilityEnabled,
} from "../../../src/game/mechanisms/roles/ability_changes";
import { getSeerState } from "../../../src/game/mechanisms/roles/seer/ports";
import { getWitchState } from "../../../src/game/mechanisms/roles/witch/ports";
import { RoleCatalog, getDefaultRoleCatalog } from "../../../src/game/mechanisms/roles/catalog";
import { NightStageRegistry } from "../../../src/game/mechanisms/stages/night/night_stage_registry";
import { NightPipeline } from "../../../src/game/engine/phase_pipeline/night_pipeline";
import { DamageResolutionSystem } from "../../../src/core/domain/systems/damage_resolution_system";
import { ToolGateway } from "../../../src/game/gateway/tool_gateway";
import { ActionValidator } from "../../../src/game/gateway/action_validator";
import { ToolValidationRuleRegistry } from "../../../src/game/mechanisms/validation/tool_validation_rule_registry";
import { ActionReception } from "../../../src/ai/agents/player/action_reception";
import { BaselineBotActionProvider } from "../../../src/ai/agents/providers/action_providers";

const fixedRoles = [Role.Wolf, Role.Wolf, Role.Seer, Role.Guard, Role.Villager, Role.Villager];

const freshSeer = () => ({ lastTarget: null, lastIsWerewolf: null, lastResult: null, history: [] });

const fixture = (locale: "zh-CN" | "en" = "en") =>
  bootstrapGame(sixPlayerMvpConfig, { fixedRoles, locale });

const role = (world: ReturnType<typeof fixture>["world"], id: number) =>
  world.getComponent<RoleComponent>(id, COMPONENT.Role)!;

const request = (actorId: number, id: string, day = 1): ActionRequest => ({
  actorId,
  phase: Phase.Night,
  allowedTools: ["check_identity"],
  context: {
    day,
    stage: "seer",
    ability_id: id,
    visible_events: [],
    turn_constraints: { min_valid_actions: 1, max_valid_actions: 1 },
  },
});

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: actual night executes two separate granted inspections and a copied guard, with no identity rewrite`, async () => {
    const { world } = fixture(locale),
      events: GameEvent[] = [],
      asked: Array<[number, string, string | undefined]> = [];
    for (const id of ["gift:one", "gift:two"])
      grantNightAbility(
        world,
        5,
        {
          id,
          kind: "seer_check",
          state: freshSeer(),
          source: { kind: "gift", actorId: 3 },
          startsOnDay: 1,
          maxUses: 1,
        },
        events,
      );
    grantNightAbility(
      world,
      6,
      {
        id: "copy:guard",
        kind: "guard",
        state: { lastTarget: null },
        source: { kind: "copy", actorId: 4, abilityId: "native:guard" },
        startsOnDay: 1,
        maxUses: 1,
      },
      events,
    );
    const pipeline = new NightPipeline({
      world,
      events,
      toolGateway: new ToolGateway(),
      damageResolutionSystem: new DamageResolutionSystem(),
    });
    const provider = {
      async getAction(input: ActionRequest) {
        asked.push([input.actorId, input.context.stage, input.context.ability_id]);
        if (input.context.stage === "seer")
          return {
            name: "check_identity" as const,
            args: { target_id: input.context.ability_id === "gift:two" ? 2 : 1 },
          };
        return new BaselineBotActionProvider(world).getAction(input);
      },
    };
    await pipeline.execute(sixPlayerMvpConfig, provider, 1);
    expect(asked.filter(([actor, stage]) => actor === 5 && stage === "seer")).toEqual([
      [5, "seer", "gift:one"],
      [5, "seer", "gift:two"],
    ]);
    expect(asked).toContainEqual([6, "guard", "copy:guard"]);
    const checks = events.filter(
      (event) => event.type === "seer_checked" && event.payload.actorId === 5,
    );
    expect(checks.map((event) => event.payload)).toEqual([
      {
        actorId: 5,
        abilityId: "gift:one",
        targetId: 1,
        isWerewolf: true,
        result: { kind: "camp", camp: "wolf" },
      },
      {
        actorId: 5,
        abilityId: "gift:two",
        targetId: 2,
        isWerewolf: true,
        result: { kind: "camp", camp: "wolf" },
      },
    ]);
    expect(allNightAbilities(role(world, 5)).map((ability) => ability.uses)).toEqual([1, 1]);
    expect(
      getSeerState(role(world, 5), "gift:one")?.history.map((entry) => entry.targetId),
    ).toEqual([1]);
    expect(
      getSeerState(role(world, 5), "gift:two")?.history.map((entry) => entry.targetId),
    ).toEqual([2]);
    expect(getSeerState(role(world, 5))).toBeUndefined(); // Ambiguous instances cannot be selected by a legacy getter.
    expect(role(world, 5).role).toBe(Role.Villager);
    expect(role(world, 6).role).toBe(Role.Villager);
    asked.length = 0;
    await pipeline.execute(sixPlayerMvpConfig, provider, 2);
    expect(asked.filter(([actor]) => actor === 5 || actor === 6)).toEqual([]);
  });

for (const grantPriority of [150, 700])
  test(`declared possible abilities reserve a stage even without a native card; grant at ${grantPriority} obeys stage time`, async () => {
    const config = {
      ...sixPlayerMvpConfig,
      roleSetups: [
        { role: Role.Wolf, count: 2 },
        { role: Role.Villager, count: 4 },
      ],
    };
    const { world } = bootstrapGame(config, {
      fixedRoles: [
        Role.Wolf,
        Role.Wolf,
        Role.Villager,
        Role.Villager,
        Role.Villager,
        Role.Villager,
      ],
    });
    const events: GameEvent[] = [],
      seen: number[] = [];
    let granted = false;
    const catalog = new RoleCatalog(
      getDefaultRoleCatalog()
        .all()
        .map((profile) =>
          profile.role !== Role.Wolf
            ? profile
            : {
                ...profile,
                possibleNightAbilities: ["seer_check" as const],
                nightStages: [
                  ...profile.nightStages!,
                  {
                    id: "synthetic_gift",
                    priority: grantPriority,
                    async execute() {
                      if (granted) return;
                      granted = true;
                      grantNightAbility(
                        world,
                        5,
                        {
                          id: "gift:late",
                          kind: "seer_check",
                          state: freshSeer(),
                          source: { kind: "gift", actorId: 1 },
                          startsOnDay: 1,
                          maxUses: 1,
                        },
                        events,
                      );
                    },
                  },
                ],
              },
        ),
    );
    const pipeline = new NightPipeline({
      world,
      events,
      stageRegistry: new NightStageRegistry(catalog),
      toolGateway: new ToolGateway(
        new ActionValidator(new ToolValidationRuleRegistry(undefined, catalog)),
      ),
      damageResolutionSystem: new DamageResolutionSystem(),
    });
    const provider = {
      async getAction(input: ActionRequest) {
        if (input.context.stage === "seer") {
          seen.push(input.context.day);
          return { name: "check_identity" as const, args: { target_id: 1 } };
        }
        return new BaselineBotActionProvider(world, catalog).getAction(input);
      },
    };
    await pipeline.execute(config, provider, 1);
    expect(seen).toEqual(grantPriority === 150 ? [1] : []);
    await pipeline.execute(config, provider, 2);
    expect(seen).toEqual(grantPriority === 150 ? [1] : [2]);
  });

test("pending, wrong-instance, disabled and dead rights reject in reception and final application; no counter is consumed", async () => {
  const { world } = fixture(),
    events: GameEvent[] = [];
  const ability = grantNightAbility(
    world,
    5,
    {
      id: "gift:future",
      kind: "seer_check",
      state: freshSeer(),
      source: { kind: "gift", actorId: 3 },
      startsOnDay: 2,
      maxUses: 1,
    },
    events,
  );
  const reception = new ActionReception(world);
  expect(
    reception.validate(request(5, ability.id, 1), "check_identity", { target_id: 1 }),
  ).toMatchObject({ ok: false, error: "seer_only" });
  expect(
    reception.validate(request(5, "another:player", 2), "check_identity", { target_id: 1 }),
  ).toMatchObject({ ok: false, error: "seer_only" });
  expect(reception.validate(request(5, ability.id, 2), "check_identity", { target_id: 1 }).ok).toBe(
    true,
  );
  setNightAbilityEnabled(world, 5, ability.id, false, events);
  expect(
    new ToolGateway().validateAndSanitize(
      world,
      5,
      { name: "check_identity", args: { target_id: 1 } },
      { phase: Phase.Night, day: 2, abilityId: ability.id },
    ),
  ).toMatchObject({ ok: false, error: "seer_only" });
  expect(ability.uses).toBe(0);
  expect(ability.state.history).toEqual([]);
  setNightAbilityEnabled(world, 5, ability.id, true, events);
  const pipeline = new NightPipeline({
    world,
    events,
    toolGateway: new ToolGateway(),
    damageResolutionSystem: new DamageResolutionSystem(),
  });
  await pipeline.execute(
    sixPlayerMvpConfig,
    {
      async getAction(input) {
        if (input.actorId === 5 && input.context.stage === "seer") {
          setNightAbilityEnabled(world, 5, ability.id, false, events);
          return { name: "check_identity", args: { target_id: 1 } };
        }
        return new BaselineBotActionProvider(world).getAction(input);
      },
    },
    2,
  );
  expect(ability.uses).toBe(0);
  expect(events.some((event) => event.type === "seer_checked" && event.payload.actorId === 5)).toBe(
    false,
  );
});

test("granted potion consumes its own resources only when used; declining ends this night without spending total uses", async () => {
  const { world } = fixture(),
    events: GameEvent[] = [];
  const ability = grantNightAbility(
    world,
    6,
    {
      id: "gift:potion",
      kind: "potion",
      state: {
        heal: 0,
        poison: 1,
        selfHealRule: WitchSelfHealRule.Disabled,
        canSelfHeal: false,
        healUsedThisNight: false,
        poisonUsedThisNight: false,
      },
      source: { kind: "gift", actorId: 3 },
      startsOnDay: 1,
      maxUses: 1,
    },
    events,
  );
  const pipeline = new NightPipeline({
    world,
    events,
    toolGateway: new ToolGateway(),
    damageResolutionSystem: new DamageResolutionSystem(),
  });
  const provider = {
    async getAction(input: ActionRequest) {
      if (input.actorId === 6 && input.context.stage === "witch")
        return {
          name: "use_potion" as const,
          args: {
            target_id: input.context.day === 1 ? 6 : 1,
            potion_type:
              input.context.day === 1 ? (PotionType.None as const) : (PotionType.Poison as const),
          },
        };
      return new BaselineBotActionProvider(world).getAction(input);
    },
  };
  await pipeline.execute(sixPlayerMvpConfig, provider, 1);
  expect(ability.uses).toBe(0);
  expect(ability.state.poison).toBe(1);
  expect(abilityStatus(ability, 1)).toBe("used_this_night");
  await pipeline.execute(sixPlayerMvpConfig, provider, 2);
  expect(ability.uses).toBe(1);
  expect(ability.state.poison).toBe(0);
  expect(abilityStatus(ability, 2)).toBe("spent");
  expect(getWitchState(role(world, 6), ability.id)).toBe(ability.state);
  expect(
    events
      .filter((event) => event.type === "witch_potion_used" && event.payload.actorId === 6)
      .map((event) => event.payload),
  ).toEqual([{ actorId: 6, abilityId: "gift:potion", targetId: 1, potionType: PotionType.Poison }]);
});

test("later snapshot entries lose their opportunity before another model request when they are blocked or die", async () => {
  const { world } = fixture(),
    events: GameEvent[] = [],
    asked: number[] = [];
  for (const actor of [5, 6])
    grantNightAbility(
      world,
      actor,
      {
        id: "gift:queued",
        kind: "seer_check",
        state: freshSeer(),
        source: { kind: "gift", actorId: 3 },
        startsOnDay: 1,
        maxUses: 1,
      },
      events,
    );
  const pipeline = new NightPipeline({
    world,
    events,
    toolGateway: new ToolGateway(),
    damageResolutionSystem: new DamageResolutionSystem(),
  });
  await pipeline.execute(
    sixPlayerMvpConfig,
    {
      async getAction(input) {
        if (input.context.stage === "seer") {
          asked.push(input.actorId);
          if (input.actorId === 3) {
            setNightAbilityEnabled(world, 5, "gift:queued", false, events);
            world.getComponent<{ alive: boolean }>(6, COMPONENT.Alive)!.alive = false;
          }
          return { name: "check_identity", args: { target_id: 1 } };
        }
        return new BaselineBotActionProvider(world).getAction(input);
      },
    },
    1,
  );
  expect(asked).toEqual([3]);
  expect(allNightAbilities(role(world, 5))[0].uses).toBe(0);
  expect(allNightAbilities(role(world, 6))[0].uses).toBe(0);
});

for (const [rule, day, stale, healed] of [
  [WitchSelfHealRule.Always, 2, false, true],
  [WitchSelfHealRule.FirstNightOnly, 1, false, true],
  [WitchSelfHealRule.FirstNightOnly, 2, true, false],
] as const)
  test(`a potion granted after reset derives self-heal from the actual day (${rule}/${day})`, async () => {
    const { world } = fixture(),
      events: GameEvent[] = [];
    const catalog = new RoleCatalog(
      getDefaultRoleCatalog()
        .all()
        .map((profile) =>
          profile.role !== Role.Wolf
            ? profile
            : {
                ...profile,
                possibleNightAbilities: ["potion" as const],
                nightStages: [
                  ...profile.nightStages!,
                  {
                    id: "late_potion",
                    priority: 450,
                    async execute() {
                      grantNightAbility(
                        world,
                        5,
                        {
                          id: "gift:late-potion",
                          kind: "potion",
                          state: {
                            heal: 1,
                            poison: 0,
                            selfHealRule: rule,
                            canSelfHeal: stale,
                            healUsedThisNight: false,
                            poisonUsedThisNight: false,
                          },
                          source: { kind: "gift", actorId: 1 },
                          startsOnDay: day,
                          maxUses: 1,
                        },
                        events,
                      );
                    },
                  },
                ],
              },
        ),
    );
    const pipeline = new NightPipeline({
      world,
      events,
      stageRegistry: new NightStageRegistry(catalog),
      toolGateway: new ToolGateway(
        new ActionValidator(new ToolValidationRuleRegistry(undefined, catalog)),
      ),
      damageResolutionSystem: new DamageResolutionSystem(),
    });
    const result = await pipeline.execute(
      sixPlayerMvpConfig,
      {
        async getAction(input) {
          if (input.context.stage === "wolf_vote")
            return { name: "kill_vote", args: { target_id: 5, abstain: false } };
          if (input.actorId === 5 && input.context.stage === "witch")
            return { name: "use_potion", args: { target_id: 5, potion_type: PotionType.Heal } };
          return new BaselineBotActionProvider(world, catalog).getAction(input);
        },
      },
      day,
    );
    const ability =
      activeNightAbility(role(world, 5), "potion", day) ??
      allNightAbilities(role(world, 5)).find((owned) => owned.kind === "potion");
    if (!ability || ability.kind !== "potion") throw new Error("missing_late_potion_fixture");
    expect(ability.kind).toBe("potion");
    expect(ability.state.canSelfHeal).toBe(healed);
    expect(ability.uses).toBe(healed ? 1 : 0);
    expect(ability.state.heal).toBe(healed ? 0 : 1);
    expect(completedNight(result).damage.deaths).toEqual(healed ? [] : [5]);
  });
