/**
 * 单元测试验证镜女直接查验的身份、唯一目标知识与独立复制／赠予／转移资源。输入为原语言、变化点矩阵及局部角色／生命修改；报告、计数、隐私、关闭和已提交前缀重入拒绝为预期，不执行完整 NightPipeline 或 PhaseManager 周期。
 */
import { roleInspectionPolicy } from "@ai-werewolf-arena/game-contract/role-inspection-policy";
import { renderRolePrompt } from "../../../../src/game/observation/role-presentation";
import { nightStageContext } from "../../../support/builders/night-stage-context";
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  Camp,
  COMPONENT,
  Phase,
  Role,
  WinCondition,
  type ActionRequest,
  type BoardConfig,
  type GameEvent,
  type RoleComponent,
} from "../../../../src/core";
import { sixPlayerMvpConfig } from "../../../../src/runtime/scenarios/six_player_mvp";
import { findNightAbility, allNightAbilities } from "../../../../src/game/mechanisms/roles/abilities";
import { projectNightAbility } from "../../../../src/game/observation/night-ability-projection";
import { setNightAbilityEnabled } from "../../../../src/game/mechanisms/roles/abilities";
import { grantNightAbility, transferNightAbility } from "../../../../src/game/mechanisms/roles/night-ability-grants";
import { freshMirrorInspectionState } from "../../../../src/game/mechanisms/roles/mirror_girl/profile";
import { MIRROR_INSPECTION_STAGE } from "../../../../src/game/mechanisms/roles/role_inspection/contribution-ports";
import {
  getDefaultRoleCatalog,
  getDefaultRoleContributions,
  createRoleCatalog,
} from "../../../../src/game/mechanisms/roles/role-catalog-assembly";
import { resolveInspection } from "../../../../src/game/mechanisms/roles/inspection";
import {
  canGargoyleKnife,
  refreshGargoyleInheritance,
} from "../../../../src/game/mechanisms/roles/gargoyle/inheritance";
import { refreshHiddenWolfInheritance } from "../../../../src/game/mechanisms/roles/hidden_wolf/inheritance";
import { NightStageRegistry } from "../../../../src/rulesets/night-stage-plan";
import type { NightStageContext } from "../../../../src/game/mechanisms/stages/night/contracts";
import { GameActionRequestFactory } from "../../../../src/game/engine/action_request_factory";
import { ToolGateway } from "../../../../src/game/gateway/tool_gateway";
import { ActionReception } from "../../../../src/game/gateway/action-reception";
import { buildAgentVisibleEventFeed } from "../../../../src/game/engine/agent_visible_event_feed";
import { PlayerPromptPolicy } from "../../../../src/ai/agents/player/player_prompt_policy";
import { BaselineBotActionProvider } from "../../../../src/game/drivers/privileged-baseline";
import {
  getDefaultConfigRenderRegistry,
  getDefaultPhaseStageLocalizationRegistry,
  getDefaultTargetHintRegistry,
  getDefaultToolSpecRegistry,
} from "../../../../src/game/mechanisms";
import { hasRoleInspectionNightCommit } from "../../../../src/game/mechanisms/roles/role_inspection/night_scope";
import { NightPipeline } from "../../../../src/game/engine/phase_pipeline/night_pipeline";
import { DamageResolutionSystem } from "../../../../src/core/domain/systems/damage_resolution_system";

const deck = [Role.MirrorGirl, Role.Wolf, Role.HiddenWolf, Role.Witch, Role.Guard, Role.Villager];

const board = (roles = deck): BoardConfig => ({
  ...sixPlayerMvpConfig,
  boardSize: roles.length,
  roleSetups: [...new Set(roles)].map((role) => ({
    role,
    count: roles.filter((r) => r === role).length,
  })),
  winConditions: [WinCondition.SlaughterCity],
  selfDestruct: { enabledWindows: [] },
});

const fixture = (locale: "zh-CN" | "en" = "en", roles = deck) => ({
  ...bootstrapGame(board(roles), { fixedRoles: roles, locale }),
  config: board(roles),
});

const role = (game: ReturnType<typeof fixture>, id = 1) =>
  game.world.getComponent(id, COMPONENT.Role)!;

const native = (game: ReturnType<typeof fixture>) => findNightAbility(role(game), "role_check")!;

function context(
  game: ReturnType<typeof fixture>,
  events: GameEvent[],
  getAction: NightStageContext["actionProvider"]["getAction"],
  day = 1,
  clock = () => true,
): NightStageContext {
  const requests = new GameActionRequestFactory(game.world, events, day);
  return nightStageContext({
    world: game.world,
    events,
    roleCatalog: getDefaultRoleCatalog(),
    toolGateway: new ToolGateway(),
    isCurrent: clock,
    currentDay: () => day,
    actionProvider: { getAction },
    makeRequest: (actorId, allowedTools, extra) =>
      requests.create({
        summary: "Offline stage fixture",
        actorId,
        phase: Phase.Night,
        allowedTools,
        stage: extra.stage,
        requiresAction: extra.requiresAction ?? true,
        context: extra,
      }),
    getAliveByRole: () => [],
    state: {
      wolfChatOrder: [],
      endedWolves: new Set(),
      wolfVotes: {},
      wolfTarget: null,
      seerChecks: [],
    },
  });
}

const policy = (game: ReturnType<typeof fixture>) =>
  new PlayerPromptPolicy(game.world, {
    boardConfig: game.config,
    roleCatalog: getDefaultRoleCatalog(),
    toolSpecRegistry: getDefaultToolSpecRegistry(),
    targetHintRegistry: getDefaultTargetHintRegistry(),
    phaseStageLocalizationRegistry: getDefaultPhaseStageLocalizationRegistry(),
    configRenderRegistry: getDefaultConfigRenderRegistry(),
  });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: native Mirror keeps Good identity and specific-role privacy while repeats stay forbidden after target/owner revival and role changes`, async () => {
    const game = fixture(locale),
      ability = native(game),
      events: GameEvent[] = [],
      receive = new ActionReception(game.world);
    expect(role(game)).toMatchObject({ role: Role.MirrorGirl });
    expect(game.world.getComponent(1, COMPONENT.Camp)!.camp).toBe(Camp.Good);
    // 阵营分类和人数上限归角色元数据；运行贡献只提供能力、阶段与回调。
    expect(getDefaultRoleCatalog().requireMetadata(Role.MirrorGirl)).toMatchObject({
      goodSide: "god",
      maxCount: 1,
    });
    expect(ability.state).toEqual(freshMirrorInspectionState());
    const requests: ActionRequest[] = [];
    await MIRROR_INSPECTION_STAGE.execute(
      context(game, events, async (request) => {
        requests.push(request);
        expect(request.context.turn_constraints.min_valid_actions).toBe(0);
        return { name: "inspect_role", args: { target_id: 2 } };
      }),
    );
    expect(requests.map((r) => r.context.stage)).toEqual(["mirror_girl"]);
    expect(ability.state.history).toEqual([
      { day: 1, targetId: 2, result: { kind: "role", role: Role.Wolf } },
    ]);
    expect(ability.uses).toBe(1);
    for (const id of [1, 2]) {
      const life = game.world.getComponent(id, COMPONENT.Alive)!;
      life.alive = false;
      life.alive = true;
    }
    role(game, 2).role = Role.Seer;
    const request = context(game, events, async () => null, 2).makeRequest(1, ["inspect_role"], {
      stage: "mirror_girl",
      ability_id: ability.id,
    });
    expect(receive.validate(request, "inspect_role", { target_id: 2 })).toMatchObject({
      ok: false,
      error: "role_inspection_repeat",
    });
    for (const target_id of [1, null, 99, 2.5])
      expect(receive.validate(request, "inspect_role", { target_id }).ok).toBe(false);
    expect(
      receive.validate({ ...request, phase: Phase.Day }, "inspect_role", { target_id: 4 }),
    ).toMatchObject({ ok: false, error: "ability_phase" });
    await MIRROR_INSPECTION_STAGE.execute(
      context(game, events, async () => ({ name: "inspect_role", args: { target_id: 4 } }), 2),
    );
    expect(ability.state.history.map((r) => r.result.role)).toEqual([Role.Wolf, Role.Witch]);
    expect(ability.uses).toBe(2);
    getDefaultRoleCatalog().applyRuntime(role(game), {
      initialCamp: game.world.getComponent(1, COMPONENT.Camp)!,
      currentCamp: () => game.world.getComponent(1, COMPONENT.Camp),
      world: game.world,
      boardConfig: game.config,
      locale,
    });
    expect(native(game)).toBe(ability);
    expect(ability.state.history).toHaveLength(2);
    for (const id of game.world.entityIds())
      expect(
        buildAgentVisibleEventFeed(game.world, events, id).filter(
          (e) => e.type === "role_inspected",
        ),
      ).toHaveLength(id === 1 ? 2 : 0);
    if (locale === "en")
      expect(renderRolePrompt(role(game), locale)).not.toMatch(/[\u4e00-\u9fff]/);
  });

test("Hidden role labels change after inheritance but a previous Mirror report is immutable and its stable ID cannot be rechecked", async () => {
  const game = fixture(),
    events: GameEvent[] = [],
    ability = native(game);
  await MIRROR_INSPECTION_STAGE.execute(
    context(game, events, async () => ({ name: "inspect_role", args: { target_id: 3 } })),
  );
  expect(ability.state.history[0].result).toEqual({ kind: "role", role: Role.Villager });
  game.world.getComponent(2, COMPONENT.Alive)!.alive = false;
  refreshHiddenWolfInheritance(game.world, events, 1);
  expect(resolveInspection(game.world, 3, "role", getDefaultRoleCatalog())).toEqual({
    kind: "role",
    role: Role.HiddenWolf,
  });
  expect(ability.state.history[0].result).toEqual({ kind: "role", role: Role.Villager });
  const request = context(game, events, async () => null, 2).makeRequest(1, ["inspect_role"], {
    stage: "mirror_girl",
    ability_id: ability.id,
  });
  expect(
    new ActionReception(game.world).validate(request, "inspect_role", { target_id: 3 }),
  ).toMatchObject({ ok: false, error: "role_inspection_repeat" });
});

test("Mirror pass and later exhausted target set close the night without consuming or changing old reports; invalid replies still fail", async () => {
  const game = fixture(),
    events: GameEvent[] = [],
    ability = native(game);
  let calls = 0;
  await expect(
    MIRROR_INSPECTION_STAGE.execute(
      context(game, events, async () => {
        calls++;
        return { name: "inspect_role", args: { target_id: 1 } };
      }),
    ),
  ).rejects.toThrow("role_inspection_valid_action_missing");
  expect(calls).toBe(3);
  expect(ability.uses).toBe(0);
  expect(ability.lastUsedDay).toBeNull();
  expect(events).toEqual([]);
  await MIRROR_INSPECTION_STAGE.execute(context(game, events, async () => null));
  expect(ability.lastUsedDay).toBe(1);
  expect(ability.uses).toBe(0);
  for (const day of [2, 3, 4, 5, 6])
    await MIRROR_INSPECTION_STAGE.execute(
      context(game, events, async () => ({ name: "inspect_role", args: { target_id: day } }), day),
    );
  const before = structuredClone(ability.state);
  await MIRROR_INSPECTION_STAGE.execute(
    context(
      game,
      events,
      async () => {
        throw new Error("must_not_request_when_everyone_checked");
      },
      7,
    ),
  );
  expect(ability.uses).toBe(5);
  expect(ability.lastUsedDay).toBe(7);
  expect(ability.state).toEqual(before);
  expect(
    events
      .filter((e) => e.type === "role_inspection_skipped")
      .map((e) => [e.payload.day, e.payload.reason]),
  ).toEqual([
    [1, "passed"],
    [7, "no_targets"],
  ]);
});

test("three policy instances on one Villager use distinct slots, counters and histories, and only Spirit Seer repeats", async () => {
  const game = fixture(),
    events: GameEvent[] = [],
    calls: Array<[number, string]> = [];
  (native(game) as { disabled: boolean }).disabled = true;
  const common = {
    source: { kind: "gift" as const, actorId: 1 },
    kind: "role_check" as const,
    startsOnDay: 1,
    maxUses: 3,
  };
  const garg = grantNightAbility(
    game.world,
    6,
    { ...common, id: "gift:garg", state: { lastTarget: null, lastDay: null, history: [] } },
    [],
  );
  const mirror = grantNightAbility(
    game.world,
    6,
    { ...common, id: "gift:mirror", state: freshMirrorInspectionState() },
    [],
  );
  const psychic = grantNightAbility(
    game.world,
    6,
    {
      ...common,
      id: "gift:psychic",
      state: { policy: "psychic", lastTarget: null, lastDay: null, history: [] },
    },
    [],
  );
  const stages = new NightStageRegistry()
    .getStages(game.config, game.world)
    .filter((s) => ["role_inspection", "mirror_inspection", "psychic_inspection"].includes(s.id));
  expect(stages.map((s) => [s.id, s.priority])).toEqual([
    ["role_inspection", 180],
    ["mirror_inspection", 600],
    ["psychic_inspection", 600],
  ]);
  const ctx = context(game, events, async (request) => {
    calls.push([request.actorId, request.context.stage]);
    return { name: "inspect_role", args: { target_id: 2 } };
  });
  for (const stage of stages) await stage.execute(ctx);
  expect(calls).toEqual([
    [6, "role_inspection"],
    [6, "mirror_girl"],
    [6, "psychic"],
  ]);
  for (const ability of [garg, mirror, psychic]) {
    expect(ability.uses).toBe(1);
    expect(ability.state.history.map((r) => r.targetId)).toEqual([2]);
  }
  expect(role(game, 6)).toMatchObject({ role: Role.Villager });
  expect(game.world.getComponent(6, COMPONENT.Camp)!.camp).toBe(Camp.Good);
  for (const ability of [garg, mirror, psychic]) {
    const request = context(game, events, async () => null, 2).makeRequest(6, ["inspect_role"], {
      stage: roleInspectionPolicy(ability.state) === "psychic" ? "psychic" : "mirror_girl",
      ability_id: ability.id,
    });
    expect(
      new ActionReception(game.world).validate(request, "inspect_role", { target_id: 2 }).ok,
    ).toBe(ability === psychic);
  }
});

test("fresh Mirror copy/gift reject inherited or private state, while transfer preserves complete knowledge and the closed night", async () => {
  const game = fixture(),
    events: GameEvent[] = [],
    original = native(game);
  await MIRROR_INSPECTION_STAGE.execute(
    context(game, events, async () => ({ name: "inspect_role", args: { target_id: 2 } })),
  );
  const common = {
    id: "copy:mirror",
    kind: "role_check" as const,
    source: { kind: "copy" as const, actorId: 1, abilityId: original.id },
    startsOnDay: 1,
    maxUses: 2,
  };
  const decoratedHistory: any[] = [];
  (decoratedHistory as any).privateCamp = "wolf";
  for (const state of [
    original.state,
    { ...freshMirrorInspectionState(), lastTarget: 2 },
    { ...freshMirrorInspectionState(), privateCamp: "wolf" },
    { ...freshMirrorInspectionState(), history: { length: 0 } as any },
    { ...freshMirrorInspectionState(), history: decoratedHistory },
  ])
    expect(() =>
      grantNightAbility(
        game.world,
        6,
        {
          ...common,
          state:
            state as import("@ai-werewolf-arena/game-contract").NightAbilityStates["role_check"],
        },
        events,
      ),
    ).toThrow("ability_mirror_initial_state_invalid");
  const copied = grantNightAbility(
    game.world,
    6,
    { ...common, state: freshMirrorInspectionState() },
    events,
  );
  expect(copied.state.history).toEqual([]);
  expect(copied.state).not.toBe(original.state);
  const request = context(game, events, async () => null).makeRequest(6, ["inspect_role"], {
    stage: "mirror_girl",
    ability_id: copied.id,
  });
  expect(
    new ActionReception(game.world).validate(request, "inspect_role", { target_id: 2 }).ok,
  ).toBe(true);
  await MIRROR_INSPECTION_STAGE.execute(
    context(game, events, async () => ({ name: "inspect_role", args: { target_id: 2 } })),
  );
  transferNightAbility(game.world, 6, 5, copied.id, "transfer:mirror", events, {
    kind: "role_check",
    statePolicy: (state) => structuredClone(state),
  });
  const moved = findNightAbility(role(game, 5), "role_check", "transfer:mirror")!;
  expect(moved).toMatchObject({
    uses: 1,
    lastUsedDay: 1,
    state: {
      policy: "mirror",
      history: [{ day: 1, targetId: 2, result: { kind: "role", role: Role.Wolf } }],
    },
  });
  await MIRROR_INSPECTION_STAGE.execute(
    context(game, events, async () => {
      throw new Error("same_night_closed");
    }),
  );
  expect(() =>
    transferNightAbility(game.world, 5, 6, moved.id, "transfer:lost-history", events, {
      kind: "role_check",
      statePolicy: () => freshMirrorInspectionState(),
    }),
  ).toThrow("ability_transfer_role_inspection_history_changed");
  transferNightAbility(game.world, 1, 6, original.id, "transfer:native-mirror", events, {
    kind: "role_check",
    statePolicy: (state) => structuredClone(state),
  });
  getDefaultRoleCatalog().applyRuntime(role(game), {
      initialCamp: game.world.getComponent(1, COMPONENT.Camp)!,
      currentCamp: () => game.world.getComponent(1, COMPONENT.Camp), world: game.world, boardConfig: game.config });
  expect(allNightAbilities(role(game)).filter((a) => a.source.kind === "native")).toEqual([]);
});

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: binding a Mirror instance uses Mirror target/baseline/prompt rules and strips unknown state from both DTO locations and prompt`, async () => {
    const game = fixture(locale),
      ability = native(game),
      events: GameEvent[] = [];
    await MIRROR_INSPECTION_STAGE.execute(
      context(game, events, async () => ({ name: "inspect_role", args: { target_id: 2 } })),
    );
    const copied = grantNightAbility(
      game.world,
      6,
      {
        id: "gift:mirror",
        kind: "role_check",
        state: freshMirrorInspectionState(),
        source: { kind: "gift", actorId: 1 },
        startsOnDay: 1,
        maxUses: 3,
      },
      [],
    );
    (
      copied.state.history as {
        day: number;
        targetId: import("@ai-werewolf-arena/game-contract").EntityId;
        result: Extract<
          import("@ai-werewolf-arena/game-contract").InspectionResult,
          { kind: "role" }
        >;
      }[]
    ).push({ day: 1, targetId: 2, result: { kind: "role", role: Role.Wolf } });
    (copied.state as any).privateCamp = "hidden-camp-sentinel";
    (copied.state.history[0] as any).causalRole = "hidden-cause-sentinel";
    (copied as any).godOnlyField = "hidden-top-level";
    (copied as { sourceDisclosed: boolean }).sourceDisclosed = true;
    (copied.source as any).privateCamp = "hidden-source-field";
    const request = context(game, events, async () => null, 2).makeRequest(6, ["inspect_role"], {
        stage: "mirror_girl",
        ability_id: copied.id,
      }),
      prompt = policy(game).buildUser(request, {
        turnId: "t4",
        allowedTools: request.allowedTools,
        actionSubmissionHint: "submit_action",
      });
    expect(prompt).toContain(
      locale === "en" ? "Mirror inspection ability for this turn:" : "本轮魔镜查验能力：",
    );
    expect(prompt).not.toContain(
      locale === "en" ? "Spirit Seer inspection ability for this turn:" : "本轮通灵查验能力：",
    );
    const observation = policy(game).buildObservation(request);
    expect(JSON.stringify(observation)).not.toContain("hidden-");
    expect(prompt).not.toContain("hidden-");
    expect(projectNightAbility(copied, 2).state).toEqual({
      policy: "mirror",
      lastTarget: null,
      lastDay: null,
      history: [{ day: 1, targetId: 2, result: { kind: "role", role: Role.Wolf } }],
    });
    const changes: GameEvent[] = [];
    setNightAbilityEnabled(game.world, 6, copied.id, false, changes);
    (changes[0].payload as any).godOnlyField = "hidden-event-field";
    const feed = buildAgentVisibleEventFeed(game.world, changes, 6);
    expect(JSON.stringify(feed)).not.toContain("hidden-");
    expect(feed[0].payload.source).toEqual({ kind: "gift", actorId: 1 });
    expect(JSON.stringify(changes)).toContain("hidden-source-field");
    setNightAbilityEnabled(game.world, 6, copied.id, true, []);
    expect(await new BaselineBotActionProvider(game.world).getAction(request)).toEqual({
      name: "inspect_role",
      args: { target_id: 1 },
    });
    expect(ability.state.history).toHaveLength(1);
  });

test("a gifted Mirror instance runs without a Mirror entity and cannot replace native Gargoyle knife completion", async () => {
  const roles = [Role.Psychic, Role.Gargoyle, Role.Wolf, Role.Witch, Role.Villager, Role.Villager],
    game = fixture("en", roles),
    events: GameEvent[] = [];
  (findNightAbility(role(game, 1), "role_check")! as { disabled: boolean }).disabled = true;
  (findNightAbility(role(game, 2), "role_check")! as { disabled: boolean }).disabled = true;
  game.world.getComponent(3, COMPONENT.Alive)!.alive = false;
  refreshGargoyleInheritance(game.world, events, 1);
  const gift = grantNightAbility(
    game.world,
    2,
    {
      id: "gift:mirror",
      kind: "role_check",
      state: freshMirrorInspectionState(),
      source: { kind: "gift", actorId: 1 },
      startsOnDay: 1,
      maxUses: 2,
    },
    events,
  );
  expect(
    new NightStageRegistry()
      .getStages(game.config, game.world)
      .filter((s) => s.id === "mirror_inspection"),
  ).toHaveLength(1);
  await MIRROR_INSPECTION_STAGE.execute(
    context(game, events, async (request) => {
      expect(request.actorId).toBe(2);
      expect(request.context.ability_id).toBe(gift.id);
      return { name: "inspect_role", args: { target_id: 4 } };
    }),
  );
  expect(gift.uses).toBe(1);
  expect(canGargoyleKnife(role(game, 2), game.world, () => game.world.getComponent(2, COMPONENT.Camp))).toBe(false);
  expect(hasRoleInspectionNightCommit(game.world, 1)).toBe(true);
});

test("actual role-check capabilities collect all policy handlers even when an injected role catalog omits a Gargoyle profile", async () => {
  const game = fixture(),
    { RoleCatalog } = await import("../../../../src/game/mechanisms/roles/catalog");
  const minimal = createRoleCatalog({
    contributions: getDefaultRoleContributions().filter(
      (entry) => entry.metadata.role === Role.Wolf || entry.metadata.role === Role.Villager,
    ),
  });
  expect(
    new NightStageRegistry(minimal)
      .getStages(game.config, game.world)
      .filter((s) => ["role_inspection", "mirror_inspection", "psychic_inspection"].includes(s.id))
      .map((s) => s.id),
  ).toEqual(["role_inspection", "mirror_inspection", "psychic_inspection"]);
});

test("Mirror legal closure registers the shared commit and prevents full night reentry", async () => {
  const game = fixture(),
    events: GameEvent[] = [];
  await MIRROR_INSPECTION_STAGE.execute(context(game, events, async () => null));
  const pipeline = new NightPipeline({
    world: game.world,
    events,
    toolGateway: new ToolGateway(),
    damageResolutionSystem: new DamageResolutionSystem(),
  });
  await expect(
    pipeline.execute(
      game.config,
      {
        async getAction() {
          throw new Error("must_not_request");
        },
      },
      1,
    ),
  ).rejects.toThrow("role_inspection_night_reentry_after_commit");
  expect(native(game).uses).toBe(0);
});

for (const point of ["gateway", "label"] as const)
  test(`${point}: Mirror rechecks the last unique target and closes an exhausted set without inventing a report or use`, async () => {
    const game = fixture(),
      events: GameEvent[] = [],
      ability = native(game);
    let calls = 0;
    for (const targetId of [3, 4, 5, 6])
      (
        ability.state.history as {
          day: number;
          targetId: import("@ai-werewolf-arena/game-contract").EntityId;
          result: Extract<
            import("@ai-werewolf-arena/game-contract").InspectionResult,
            { kind: "role" }
          >;
        }[]
      ).push({
        day: 1,
        targetId,
        result: { kind: "role", role: Role.Villager },
      });
    const inject = () =>
      (
        ability.state.history as {
          day: number;
          targetId: import("@ai-werewolf-arena/game-contract").EntityId;
          result: Extract<
            import("@ai-werewolf-arena/game-contract").InspectionResult,
            { kind: "role" }
          >;
        }[]
      ).push({
        day: 1,
        targetId: 2,
        result: { kind: "role", role: Role.Wolf },
      });
    const ctx = context(game, events, async () => {
      calls++;
      return { name: "inspect_role", args: { target_id: 2 } };
    });
    if (point === "gateway") {
      const validate = ctx.toolGateway.validateAndSanitize.bind(ctx.toolGateway);
      ctx.toolGateway.validateAndSanitize = (world, actorId, call, validationContext) => {
        const result = validate(world, actorId, call, validationContext);
        inject();
        return result;
      };
    }
    if (point === "label") {
      const { RoleCatalog } = await import("../../../../src/game/mechanisms/roles/catalog");
      ctx.roleCatalog = createRoleCatalog({
        contributions: getDefaultRoleContributions().map((profile) =>
          profile.metadata.role === Role.Wolf
            ? {
                ...profile,
                runtime: {
                  ...profile.runtime,
                  inspectionLabels: () => {
                    inject();
                    return { role: Role.Wolf };
                  },
                },
              }
            : profile,
        ),
      });
    }
    await MIRROR_INSPECTION_STAGE.execute(ctx);
    expect(calls).toBe(1);
    expect(ability.state.history.map((r) => r.targetId)).toEqual([3, 4, 5, 6, 2]);
    expect(ability.uses).toBe(0);
    expect(ability.lastUsedDay).toBe(1);
    expect(ability.state.lastTarget).toBeNull();
    expect(events.map((e) => [e.type, e.payload])).toEqual([
      ["role_inspection_skipped", { actorId: 1, day: 1, reason: "no_targets" }],
    ]);
  });

for (const change of ["cancel_null", "actor_revive", "target_revive", "state", "policy"] as const)
  test(`${change}: a stale Mirror response cannot consume, report or close a new scope`, async () => {
    const game = fixture(),
      events: GameEvent[] = [],
      ability = native(game);
    let current = true,
      calls = 0;
    const ctx = context(
      game,
      events,
      async () => {
        calls++;
        if (change === "cancel_null") {
          current = false;
          return null;
        }
        if (change === "actor_revive" || change === "target_revive") {
          const life = game.world.getComponent(
            change === "actor_revive" ? 1 : 2,
            COMPONENT.Alive,
          )!;
          life.alive = false;
          life.alive = true;
        }
        if (change === "state")
          (
            ability as {
              state: import("@ai-werewolf-arena/game-contract").RoleInspectionReadState;
            }
          ).state = structuredClone(ability.state);
        if (change === "policy")
          (
            ability.state as {
              policy: import("@ai-werewolf-arena/game-contract").RoleInspectionPolicy | undefined;
            }
          ).policy = "psychic";
        return { name: "inspect_role", args: { target_id: 2 } };
      },
      1,
      () => current,
    );
    if (change === "target_revive")
      await expect(MIRROR_INSPECTION_STAGE.execute(ctx)).rejects.toThrow(
        "role_inspection_valid_action_missing",
      );
    else await MIRROR_INSPECTION_STAGE.execute(ctx);
    expect(calls).toBe(change === "target_revive" ? 3 : 1);
    expect(ability.uses).toBe(0);
    expect(ability.lastUsedDay).toBeNull();
    expect(ability.state.history).toEqual([]);
    expect(events).toEqual([]);
  });
