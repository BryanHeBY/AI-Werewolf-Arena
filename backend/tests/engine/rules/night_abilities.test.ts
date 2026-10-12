/**
 * Night mechanism integration verify independent ability grant, copy, expiry and stage timing.
 * Input: Explicit native/granted/copied ability instances and recorded night actions.
 * Output and independent oracle: Literal resource/source separation, unchanged role/camp and actual reserved-stage/request ordering.
 * The test never calls a billed model or rewrites expected fixture/Tape bytes.
 */
import { completedNight } from "../night_stage_fixture";
import { PotionType } from "../../../src/core";
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import {
  COMPONENT,
  Camp,
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
  recordNightAbilityUse,
} from "../../../src/game/mechanisms/roles/abilities";
import {
  grantNightAbility,
  setNightAbilityEnabled,
  transferNightAbility,
} from "../../../src/game/mechanisms/roles/ability_changes";
import {
  getSeerState,
  getGuardState,
  getWitchState,
} from "../../../src/game/mechanisms/roles/private_state";
import { RoleCatalog, getDefaultRoleCatalog } from "../../../src/game/mechanisms/roles/catalog";
import { NightStageRegistry } from "../../../src/game/mechanisms/stages/night/night_stage_registry";
import { NightPipeline } from "../../../src/game/engine/phase_pipeline/night_pipeline";
import { DamageResolutionSystem } from "../../../src/core/domain/systems/damage_resolution_system";
import { ToolGateway } from "../../../src/game/gateway/tool_gateway";
import { ActionValidator } from "../../../src/game/gateway/action_validator";
import { ToolValidationRuleRegistry } from "../../../src/game/mechanisms/validation/tool_validation_rule_registry";
import { ActionReception } from "../../../src/ai/agents/player/action_reception";
import { buildAgentVisibleEventFeed } from "../../../src/game/engine/agent_visible_event_feed";
import { BaselineBotActionProvider } from "../../../src/ai/agents/providers/action_providers";
import { PlayerPromptPolicy } from "../../../src/ai/agents/player/player_prompt_policy";
import {
  getDefaultConfigRenderRegistry,
  getDefaultPhaseStageLocalizationRegistry,
  getDefaultTargetHintRegistry,
  getDefaultToolSpecRegistry,
} from "../../../src/game/mechanisms";

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
  test(`${locale}: independent sources/resources survive grant, expiry, blocking and transfer without changing role or camp`, () => {
    const { world } = fixture(locale),
      events: GameEvent[] = [],
      state = freshSeer();
    const input = {
      id: "gift:vision",
      kind: "seer_check" as const,
      state,
      source: { kind: "gift" as const, actorId: 3 },
      startsOnDay: 2,
      expiresAfterDay: 3,
      maxUses: 2,
    };
    const ability = grantNightAbility(world, 5, input, events);
    state.history.push({ targetId: 1, isWerewolf: true } as never);
    expect(ability.state.history).toEqual([]);
    expect(abilityStatus(ability, 1)).toBe("pending");
    expect(abilityStatus(ability, 2)).toBe("active");
    expect(abilityStatus(ability, 4)).toBe("expired");
    recordNightAbilityUse(ability, 2, true);
    expect(ability.uses).toBe(1);
    expect(abilityStatus(ability, 2)).toBe("used_this_night");
    setNightAbilityEnabled(world, 5, ability.id, false, events);
    expect(abilityStatus(ability, 3)).toBe("disabled");
    setNightAbilityEnabled(world, 5, ability.id, true, events);
    expect(abilityStatus(ability, 3)).toBe("active");
    expect(() =>
      transferNightAbility(world, 5, 999, ability.id, "transfer:vision", events, {
        kind: "seer_check",
        statePolicy: () => freshSeer(),
      }),
    ).toThrow("ability_actor_missing");
    expect(allNightAbilities(role(world, 5))).toHaveLength(1);
    transferNightAbility(world, 5, 6, ability.id, "transfer:vision", events, {
      kind: "seer_check",
      statePolicy: () => freshSeer(),
    });
    expect(allNightAbilities(role(world, 5))).toEqual([]);
    const transferred = allNightAbilities(role(world, 6))[0];
    expect(transferred).toMatchObject({
      id: "transfer:vision",
      uses: 1,
      lastUsedDay: 2,
      maxUses: 2,
      source: { kind: "transfer", actorId: 5, abilityId: "gift:vision" },
    });
    expect(abilityStatus(transferred, 2)).toBe("used_this_night");
    expect(() => grantNightAbility(world, 5, input, events)).toThrow("ability_id_duplicate");
    recordNightAbilityUse(transferred, 3, true);
    expect(abilityStatus(transferred, 3)).toBe("spent");
    expect(role(world, 5).role).toBe(Role.Villager);
    expect(role(world, 6).camp).toBe(Camp.Good);
    for (const actor of world.entityIds())
      expect(
        buildAgentVisibleEventFeed(world, events, actor).every(
          (event) => event.payload.actorId === actor,
        ),
      ).toBe(true);
    expect(buildAgentVisibleEventFeed(world, events, 3)).toEqual([]); // Secret copy/gift is not broadcast to its source.
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

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: selected ability state and all owned instances reach the shared prompt and detached observation`, () => {
    const { world } = fixture(locale),
      events: GameEvent[] = [];
    grantNightAbility(
      world,
      5,
      {
        id: "gift:self",
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
        id: "other:secret",
        kind: "seer_check",
        state: freshSeer(),
        source: { kind: "gift", actorId: 3 },
        startsOnDay: 1,
        maxUses: 1,
      },
      events,
    );
    const policy = new PlayerPromptPolicy(world, {
      boardConfig: sixPlayerMvpConfig,
      roleCatalog: getDefaultRoleCatalog(),
      toolSpecRegistry: getDefaultToolSpecRegistry(),
      targetHintRegistry: getDefaultTargetHintRegistry(),
      phaseStageLocalizationRegistry: getDefaultPhaseStageLocalizationRegistry(),
      configRenderRegistry: getDefaultConfigRenderRegistry(),
    });
    const input = request(5, "gift:self"),
      observed = policy.buildObservation(input);
    expect(observed.identity.role).toBe(Role.Villager);
    expect(observed.ownState.seer).toEqual(freshSeer());
    expect(observed.abilities).toHaveLength(1);
    expect(observed.abilities[0].status).toBe("active");
    expect(JSON.stringify(observed)).not.toContain("other:secret");
    expect(Object.isFrozen(observed.abilities[0].state)).toBe(true);
    const prompt = policy.buildUser(input, {
      turnId: "t1",
      allowedTools: ["check_identity"],
      actionSubmissionHint: "submit",
    });
    expect(prompt).toContain("gift:self");
    expect(prompt).not.toContain("other:secret");
    if (locale === "en") expect(prompt).not.toMatch(/\p{Script=Han}/u);
  });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: anonymous provenance stays out of player DTO/events while the referee retains it`, () => {
    const { world } = fixture(locale),
      events: GameEvent[] = [];
    grantNightAbility(
      world,
      5,
      {
        id: "gift:private",
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
      5,
      {
        id: "gift:disclosed",
        kind: "seer_check",
        state: freshSeer(),
        source: { kind: "gift", actorId: 3 },
        sourceDisclosed: true,
        startsOnDay: 1,
        maxUses: 1,
      },
      events,
    );
    if (events[0].type !== "ability_changed") throw new Error("unexpected_ability_grant_event");
    expect(events[0].payload.source).toEqual({ kind: "gift", actorId: 3 });
    const view = buildAgentVisibleEventFeed(world, events, 5);
    expect(view[0].payload.source).toEqual({ kind: "gift" });
    expect(view[0].payload).not.toHaveProperty("sourceDisclosed");
    expect(view[1].payload.source).toEqual({ kind: "gift", actorId: 3 });
    const policy = new PlayerPromptPolicy(world, {
      boardConfig: sixPlayerMvpConfig,
      roleCatalog: getDefaultRoleCatalog(),
      toolSpecRegistry: getDefaultToolSpecRegistry(),
      targetHintRegistry: getDefaultTargetHintRegistry(),
      phaseStageLocalizationRegistry: getDefaultPhaseStageLocalizationRegistry(),
      configRenderRegistry: getDefaultConfigRenderRegistry(),
    });
    const observed = policy.buildObservation(request(5, "gift:private"));
    expect(observed.abilities.find((ability) => ability.id === "gift:private")?.source).toEqual({
      kind: "gift",
    });
    expect(observed.abilities.find((ability) => ability.id === "gift:disclosed")?.source).toEqual({
      kind: "gift",
      actorId: 3,
    });
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

test("direct transfer provenance cannot clone or refresh a used source instance through the public grant API", () => {
  const { world } = fixture(),
    events: GameEvent[] = [];
  const source = allNightAbilities(role(world, 3))[0];
  recordNightAbilityUse(source, 1, true);
  expect(() =>
    grantNightAbility(
      world,
      5,
      {
        id: "fake:transfer",
        kind: "seer_check",
        state: freshSeer(),
        source: { kind: "transfer", actorId: 3, abilityId: source.id },
        startsOnDay: 1,
        maxUses: 1,
      } as never,
      events,
    ),
  ).toThrow("ability_grant_source_invalid");
  expect(allNightAbilities(role(world, 5))).toEqual([]);
  expect(source.uses).toBe(1);
  expect(events).toEqual([]);
});

test("native installation and replacement detach repeated templates and return the actual owned state", async () => {
  const { setSeerState, setWitchState } =
    await import("../../../src/game/mechanisms/roles/private_state");
  const { world } = fixture(),
    template = freshSeer();
  const first = setSeerState(role(world, 3), template),
    second = setSeerState(role(world, 4), template);
  first.history.push({ targetId: 1, isWerewolf: true });
  expect(second.history).toEqual([]);
  expect(template.history).toEqual([]);
  expect(getSeerState(role(world, 3))).toBe(first);
  expect(first).not.toBe(template);
  const potion = {
    heal: 1,
    poison: 1,
    selfHealRule: WitchSelfHealRule.Disabled,
    canSelfHeal: false,
    healUsedThisNight: false,
    poisonUsedThisNight: false,
  };
  const p1 = setWitchState(role(world, 5), potion),
    p2 = setWitchState(role(world, 6), potion);
  p1.poison = 0;
  expect(p2.poison).toBe(1);
  expect(potion.poison).toBe(1);
});

test("transfer requires an explicit knowledge policy and preserves generic counters while clearing unauthorized inspection memory", () => {
  const { world } = fixture(),
    events: GameEvent[] = [],
    original = activeNightAbility(role(world, 3), "seer_check", 1)!;
  original.state.history.push({ targetId: 1, isWerewolf: true });
  recordNightAbilityUse(original, 1, true);
  expect(() =>
    transferNightAbility(world, 3, 5, original.id, "move:vision", events, undefined as never),
  ).toThrow("ability_transfer_policy_required");
  expect(allNightAbilities(role(world, 5))).toEqual([]);
  transferNightAbility(world, 3, 5, original.id, "move:vision", events, {
    kind: "seer_check",
    statePolicy: () => freshSeer(),
  });
  const moved = allNightAbilities(role(world, 5))[0];
  expect(moved.uses).toBe(1);
  expect(moved.lastUsedDay).toBe(1);
  expect(getSeerState(role(world, 5), moved.id)?.history).toEqual([]);
  expect(activeNightAbility(role(world, 5), "seer_check", 1, moved.id)).toBeUndefined();
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

test("explicit undefined optional fields normalize into a serializable CP/Tape without weakening strict JSON parsing", async () => {
  const { SessionRecordManager } = await import("../../../src/recording/session_recorder");
  const { beginGameReproduction, currentEngineVersion } =
    await import("../../../src/runtime/simulation/reproduction_context");
  const { parseReproductionRecord } = await import("../../../src/recording/reproduction");
  const { createTestTempDirectory } = await import("../../support/drivers/temp-directories");
  const { setSeerState } = await import("../../../src/game/mechanisms/roles/private_state");
  const context = fixture(),
    events: GameEvent[] = [];
  setSeerState(role(context.world, 3), {
    lastTarget: 1,
    lastIsWerewolf: true,
    lastResult: undefined,
    history: [{ targetId: 1, isWerewolf: true, result: undefined }],
  });
  const ability = grantNightAbility(
    context.world,
    5,
    {
      id: "gift:json",
      kind: "seer_check",
      state: { lastTarget: null, lastIsWerewolf: null, lastResult: undefined, history: [] },
      source: { kind: "gift", actorId: 3 },
      startsOnDay: 1,
      expiresAfterDay: undefined,
      maxUses: 1,
    },
    events,
  );
  expect(Object.hasOwn(ability, "expiresAfterDay")).toBe(false);
  expect(Object.hasOwn(ability.state, "lastResult")).toBe(false);
  expect(Object.hasOwn(getSeerState(role(context.world, 3))!.history[0], "result")).toBe(false);
  const manager = await SessionRecordManager.create(
    {
      sessionId: "ability-json",
      board: "six_player_mvp",
      locale: "en",
      startedAtIso: new Date().toISOString(),
    },
    await createTestTempDirectory("awa-ability-json-"),
  );
  const trace = beginGameReproduction(manager, context, {
    engine: await currentEngineVersion(),
    boardId: "six_player_mvp",
    boardConfig: sixPlayerMvpConfig,
    locale: "en",
    maxDays: 6,
  });
  const tape = trace.build();
  expect(parseReproductionRecord(tape).checkpoints[0].players[4].privateState).toEqual(
    role(context.world, 5).privateState,
  );
});

test("sparse or undefined state arrays reject before native replacement or grant writes", async () => {
  const { setSeerState } = await import("../../../src/game/mechanisms/roles/private_state");
  const { world } = fixture(),
    events: GameEvent[] = [],
    before = structuredClone(role(world, 3).privateState);
  for (const history of [new Array(1), [undefined]]) {
    const state = { ...freshSeer(), history };
    expect(() => setSeerState(role(world, 3), state)).toThrow("ability_state_not_json");
    expect(role(world, 3).privateState).toEqual(before);
    expect(() =>
      grantNightAbility(
        world,
        5,
        {
          id: "gift:bad-array",
          kind: "seer_check",
          state,
          source: { kind: "gift", actorId: 3 },
          startsOnDay: 1,
          maxUses: 1,
        },
        events,
      ),
    ).toThrow("ability_state_not_json");
    expect(allNightAbilities(role(world, 5))).toEqual([]);
    expect(events).toEqual([]);
  }
});

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: bound guard/potion grants keep legal self targets in the real user prompt without changing identity`, () => {
    const { world } = fixture(locale),
      events: GameEvent[] = [];
    grantNightAbility(
      world,
      5,
      {
        id: "gift:guard-self",
        kind: "guard",
        state: { lastTarget: null },
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
        id: "gift:heal-self",
        kind: "potion",
        state: {
          heal: 1,
          poison: 0,
          selfHealRule: WitchSelfHealRule.Always,
          canSelfHeal: true,
          healUsedThisNight: false,
          poisonUsedThisNight: false,
        },
        source: { kind: "gift", actorId: 3 },
        startsOnDay: 1,
        maxUses: 1,
      },
      events,
    );
    const policy = new PlayerPromptPolicy(world, {
      boardConfig: sixPlayerMvpConfig,
      roleCatalog: getDefaultRoleCatalog(),
      toolSpecRegistry: getDefaultToolSpecRegistry(),
      targetHintRegistry: getDefaultTargetHintRegistry(),
      phaseStageLocalizationRegistry: getDefaultPhaseStageLocalizationRegistry(),
      configRenderRegistry: getDefaultConfigRenderRegistry(),
    });
    for (const [actor, id, tool] of [
      [5, "gift:guard-self", "guard"],
      [6, "gift:heal-self", "use_potion"],
    ] as const) {
      const input = {
        ...request(actor, id),
        allowedTools: [tool],
        context: {
          ...request(actor, id).context,
          stage: tool === "guard" ? ("guard" as const) : ("witch" as const),
        },
      };
      const prompt = policy.buildUser(input, {
        turnId: "t1",
        allowedTools: [tool],
        actionSubmissionHint: "submit",
      });
      expect(prompt).toContain(locale === "en" ? "1, 2, 3, 4, 5, 6" : "1, 2, 3, 4, 5, 6");
      expect(prompt).not.toContain(
        locale === "en" ? "Actionable IDs (excluding yourself)" : "可行动编号（不含自己）",
      );
      expect(policy.buildObservation(input).identity.role).toBe(Role.Villager);
      if (tool === "use_potion")
        world
          .getComponent<{ add(value: string): void }>(actor, COMPONENT.StatusMarks)!
          .add("WolfKillMark");
      const args =
        tool === "guard"
          ? { target_id: actor, abstain: false }
          : { target_id: actor, potion_type: PotionType.Heal };
      expect(new ActionReception(world).validate(input, tool, args).ok).toBe(true);
    }
  });
