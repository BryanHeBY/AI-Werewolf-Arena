/**
 * 单元测试：验证普通夜能力 grant/copy/transfer/expiry 及原生配置契约。
 * 输入为原实例、字面安装数据和明确 statePolicy；引用、getter、错误、事实及状态是独立预期。
 * 通过有界公共 owner 检查安装／次数／玩家投影与来源，原窗口和被拒入口仍保留。
 * 不执行完整阶段、模型或新 golden，也不回滚已付前缀。
 */
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
} from "../../../src/game/mechanisms/roles/abilities";
import { recordNightAbilityUse } from "../../../src/game/mechanisms/roles/ability_changes";
import {
  grantNightAbility,
  setNightAbilityEnabled,
  transferNightAbility,
} from "../../../src/game/mechanisms/roles/ability_changes";
import { getSeerState } from "../../../src/game/mechanisms/roles/seer/ports";
import { getDefaultRoleCatalog } from "../../../src/game/mechanisms/roles/catalog";
import { ActionReception } from "../../../src/ai/agents/player/action_reception";
import { buildAgentVisibleEventFeed } from "../../../src/game/engine/agent_visible_event_feed";
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
  const [{ setSeerState }, { setWitchState }] = await Promise.all([
    import("../../../src/game/mechanisms/roles/seer/ports"),
    import("../../../src/game/mechanisms/roles/witch/ports"),
  ]);
  const { world } = fixture(),
    template = freshSeer();
  const first = setSeerState(role(world, 3), template),
    second = setSeerState(role(world, 4), template);
  (first as import("@ai-werewolf-arena/game-contract").SeerState).history.push({
    targetId: 1,
    isWerewolf: true,
  });
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
  (p1 as { poison: number }).poison = 0;
  expect(p2.poison).toBe(1);
  expect(potion.poison).toBe(1);
});

test("transfer requires an explicit knowledge policy and preserves generic counters while clearing unauthorized inspection memory", () => {
  const { world } = fixture(),
    events: GameEvent[] = [],
    original = activeNightAbility(role(world, 3), "seer_check", 1)!;
  (
    original.state.history as {
      targetId: import("@ai-werewolf-arena/game-contract").EntityId;
      isWerewolf: boolean;
      result?: import("@ai-werewolf-arena/game-contract").InspectionResult;
    }[]
  ).push({ targetId: 1, isWerewolf: true });
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

test("sparse or undefined state arrays reject before native replacement or grant writes", async () => {
  const { setSeerState } = await import("../../../src/game/mechanisms/roles/seer/ports");
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
