import { nightStageContext } from "../night_stage_fixture";
import { PotionType } from "../../../src/core";
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import {
  Role,
  Camp,
  Phase,
  WinCondition,
  DeathCause,
  ActionWindow,
  COMPONENT,
  type BoardConfig,
  type RoleComponent,
  type ActionRequest,
  type GameEvent,
} from "../../../src/core";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";
import {
  getHiddenWolfState,
  getBearState,
  getSeerState,
} from "../../../src/game/mechanisms/roles/private_state";
import {
  canHiddenWolfKnife,
  refreshHiddenWolfInheritance,
} from "../../../src/game/mechanisms/roles/hidden_wolf/inheritance";
import {
  knownWolfTeammates,
  wolfChatParticipants,
  wolfKnifeHolders,
  wolfTeamPermissions,
} from "../../../src/game/mechanisms/roles/wolf_team";
import { getDefaultRoleCatalog, RoleCatalog } from "../../../src/game/mechanisms/roles/catalog";
import { resolveInspection } from "../../../src/game/mechanisms/roles/inspection";
import { buildAgentVisibleEventFeed } from "../../../src/game/engine/agent_visible_event_feed";
import { ActionReception } from "../../../src/ai/agents/player/action_reception";
import { PlayerPromptPolicy } from "../../../src/ai/agents/player/player_prompt_policy";
import {
  getDefaultToolSpecRegistry,
  getDefaultTargetHintRegistry,
  getDefaultPhaseStageLocalizationRegistry,
  getDefaultConfigRenderRegistry,
} from "../../../src/game/mechanisms";
import { DeathResolution } from "../../../src/game/engine/death_resolution";
import { EventRegistry } from "../../../src/game/engine/event_registry";
import { ToolGateway } from "../../../src/game/gateway/tool_gateway";
import { createAliveComponent } from "../../../src/core/domain/components/alive";
import { captureExileFeedback } from "../../../src/game/mechanisms/roles/gravekeeper/feedback";
import { HookRegistry } from "../../../src/game/mechanisms/hooks/hook_registry";
import { grantNightAbility } from "../../../src/game/mechanisms/roles/ability_changes";
import { WOLF_NIGHT_STAGES } from "../../../src/game/mechanisms/roles/wolf/night_stages";
import type { NightStageContext } from "../../../src/game/mechanisms/stages/night/contracts";
const deck = [Role.HiddenWolf, Role.Wolf, Role.Seer, Role.Bear, Role.Villager, Role.Villager];
const config = (roles = deck): BoardConfig => ({
  ...sixPlayerMvpConfig,
  boardSize: roles.length,
  winConditions: [WinCondition.SlaughterSide],
  roleSetups: [...new Set(roles)].map((role) => ({
    role,
    count: roles.filter((r) => r === role).length,
  })),
  selfDestruct: { enabledWindows: [] },
});
const role = (game: ReturnType<typeof bootstrapGame>, id: number) =>
  game.world.getComponent<RoleComponent>(id, COMPONENT.Role)!;
const catalog = getDefaultRoleCatalog();

for (const order of [
  [2, 1],
  [1, 2],
])
  test(`one additional death proposal ${order}: simultaneous last pack+Hidden deaths never inherit according to array order`, async () => {
    const game = bootstrapGame(config(), { fixedRoles: deck }),
      events: GameEvent[] = [],
      hooks = new HookRegistry(
        [],
        [
          async (_world, ids) => ({
            extraDeaths: ids.includes(5) ? order : [],
            extraDeathSources: { 1: [DeathCause.Shot], 2: [DeathCause.Shot] },
          }),
        ],
      );
    await new DeathResolution(game.world, events, new ToolGateway(), new EventRegistry(hooks), {
      day: 1,
      phase: Phase.Day,
      gameOver: false,
      result: null,
    }).resolve(
      [5],
      { 5: [DeathCause.WolfKill] },
      {
        async getAction() {
          return { name: "speak", args: { text: "Raw" } };
        },
      },
      Phase.Night,
      Phase.Day,
    );
    expect(game.world.getAliveEntityIds()).toEqual([3, 4, 6]);
    expect(getHiddenWolfState(role(game, 1))!.hasInheritedKnife).toBe(false);
    expect(events.some((e) => e.type === "hidden_wolf_awakened")).toBe(false);
  });

test("separate committed additional proposals retain real intermediate inheritance before a later proposal kills the Hidden Wolf", async () => {
  const game = bootstrapGame(config(), { fixedRoles: deck }),
    events: GameEvent[] = [],
    hooks = new HookRegistry(
      [],
      [
        async (_world, ids) => ({
          extraDeaths: ids.includes(5) ? [2] : [],
          extraDeathSources: { 2: [DeathCause.Shot] },
        }),
        async (_world, ids) => ({
          extraDeaths: ids.includes(5) ? [1] : [],
          extraDeathSources: { 1: [DeathCause.Shot] },
        }),
      ],
    );
  await new DeathResolution(game.world, events, new ToolGateway(), new EventRegistry(hooks), {
    day: 1,
    phase: Phase.Day,
    gameOver: false,
    result: null,
  }).resolve(
    [5],
    { 5: [DeathCause.WolfKill] },
    {
      async getAction() {
        return { name: "speak", args: { text: "Raw" } };
      },
    },
    Phase.Night,
    Phase.Day,
  );
  expect(game.world.getAliveEntityIds()).toEqual([3, 4, 6]);
  expect(getHiddenWolfState(role(game, 1))!.hasInheritedKnife).toBe(true);
  expect(events.filter((e) => e.type === "hidden_wolf_awakened").map((e) => e.payload)).toEqual([
    { actorId: 1, day: 1 },
  ]);
});

test("real granted Dream plus Hunter shot commits the caster and linked Hidden Wolf as one extra proposal, without a transient inheritance", async () => {
  const fixed = [Role.HiddenWolf, Role.Wolf, Role.Hunter, Role.Bear, Role.Villager, Role.Villager],
    game = bootstrapGame(config(fixed), { fixedRoles: fixed });
  grantNightAbility(
    game.world,
    2,
    {
      id: "gift:hidden-chain-dream",
      kind: "dream",
      state: { lastDay: null, lastTarget: null, history: [] },
      source: { kind: "gift", actorId: 4 },
      startsOnDay: 1,
      maxUses: 1,
    },
    [],
  );
  await game.phaseManager.runSingleCycle({
    async getAction(request) {
      if (request.allowedTools.includes("dream")) return { name: "dream", args: { target_id: 1 } };
      if (request.allowedTools.includes("speak_to_wolves"))
        return { name: "speak_to_wolves", args: { text: "End", end_chat: true } };
      if (request.allowedTools.includes("kill_vote"))
        return { name: "kill_vote", args: { target_id: 3, abstain: false } };
      if (request.allowedTools.includes("speak")) return { name: "speak", args: { text: "Raw" } };
      if (request.allowedTools.includes("shoot")) return { name: "shoot", args: { target_id: 2 } };
      throw new Error(`unexpected:${request.context.stage}`);
    },
  });
  expect(game.world.getAliveEntityIds()).toEqual([4, 5, 6]);
  expect(getHiddenWolfState(role(game, 1))!.hasInheritedKnife).toBe(false);
  expect(game.phaseManager.getEvents().some((e) => e.type === "hidden_wolf_awakened")).toBe(false);
  expect(game.phaseManager.getSnapshot().result?.winner).toBe(Camp.Good);
});

for (const change of ["camp", "permission"] as const)
  test(`${change}: a real successful gateway cannot publish chat after its actor loses current pack permission`, async () => {
    const game = bootstrapGame(config(), { fixedRoles: deck }),
      events: GameEvent[] = [],
      base = new ToolGateway();
    let chat = true;
    const custom = new RoleCatalog(
      catalog.all().map((p) =>
        p.role === Role.Wolf
          ? {
              ...p,
              wolfTeam: () => ({
                recognizedByPack: true,
                recognizes: "pack" as const,
                canChat: chat,
                canVoteForKill: true,
              }),
            }
          : p,
      ),
    );
    const gateway = new ToolGateway();
    gateway.validateAndSanitize = (world, actor, action, context) => {
      const result = base.validateAndSanitize(world, actor, action, context);
      if (change === "camp") role(game, actor).camp = Camp.Good;
      else chat = false;
      return result;
    };
    await WOLF_NIGHT_STAGES[0]!.execute(
      nightStageContext({
        world: game.world,
        roleCatalog: custom,
        toolGateway: gateway,
        events,
        actionProvider: {
          async getAction() {
            return { name: "speak_to_wolves", args: { text: "Late", end_chat: true } };
          },
        },
        isCurrent: () => true,
        currentDay: () => 1,
        makeRequest: (actorId) => ({
          actorId,
          phase: Phase.Night,
          allowedTools: ["speak_to_wolves"],
          context: { day: 1, stage: "wolf_discussion", visible_events: [], turn_constraints: {} },
        }),
        getAliveByRole: () => [],
        ensureMarks: () => {
          throw new Error("unused");
        },
        pickMajorityTarget: () => null,
        shuffleWolves: (ids) => ids,
        state: {
          wolfChatOrder: [],
          endedWolves: new Set(),
          wolfVotes: {},
          wolfTarget: null,
          seerChecks: [],
          dreamLinks: [],
        },
      }),
    );
    expect(
      events.some((e) => e.type === "wolf_discussion" || e.type === "wolf_discussion_ended"),
    ).toBe(false);
  });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: single-direction ID knowledge does not grant chat, knife, blast or other-role state, and all preflights are read-only`, () => {
    const game = bootstrapGame(config(), { fixedRoles: deck, locale }),
      before = structuredClone(role(game, 1).privateState),
      request: ActionRequest = {
        actorId: 1,
        phase: Phase.Night,
        allowedTools: ["kill_vote"],
        context: { day: 1, stage: "wolf_vote", visible_events: [], turn_constraints: {} },
      },
      reception = new ActionReception(game.world),
      policy = new PlayerPromptPolicy(game.world, {
        boardConfig: config(),
        roleCatalog: catalog,
        toolSpecRegistry: getDefaultToolSpecRegistry(),
        targetHintRegistry: getDefaultTargetHintRegistry(),
        phaseStageLocalizationRegistry: getDefaultPhaseStageLocalizationRegistry(),
        configRenderRegistry: getDefaultConfigRenderRegistry(),
      });
    expect(knownWolfTeammates(game.world, 1, catalog)).toEqual([2]);
    expect(knownWolfTeammates(game.world, 2, catalog)).toEqual([]);
    expect(wolfChatParticipants(game.world, catalog)).toEqual([2]);
    expect(wolfKnifeHolders(game.world, catalog)).toEqual([2]);
    expect(
      reception.validate(request, "kill_vote", { target_id: 5, abstain: false }),
    ).toMatchObject({ ok: false, error: "wolf_kill_permission" });
    expect(
      reception.validate({ ...request, allowedTools: ["speak_to_wolves"] }, "speak_to_wolves", {
        text: "Raw",
        end_chat: true,
      }),
    ).toMatchObject({ ok: false, error: "wolf_chat_permission" });
    expect(
      reception.validate(
        { ...request, phase: Phase.Day, allowedTools: ["self_destruct"] },
        "self_destruct",
        { confirm: true, reason: "Raw" },
      ).ok,
    ).toBe(false);
    expect(resolveInspection(game.world, 1, "camp", catalog)).toEqual({
      kind: "camp",
      camp: Camp.Good,
    });
    expect(resolveInspection(game.world, 1, "role", catalog)).toEqual({
      kind: "role",
      role: Role.Villager,
    });
    expect(policy.buildObservation(request).ownState.hiddenWolf).toEqual({
      hasInheritedKnife: false,
      canVoteForKill: false,
    });
    expect(policy.buildObservation({ ...request, actorId: 2 }).ownState.hiddenWolf).toBeUndefined();
    expect(role(game, 1).renderPrompt(locale)).toContain(
      locale === "en"
        ? "Personally inherited the knife: No; currently able to attack: No."
        : "本人曾获得刀权：否；当前可出刀：否。",
    );
    expect(role(game, 1).privateState).toEqual(before);
  });

test("opening sole Hidden Wolf inherits once, has only the basic knife and no chat, with conservative world-less compatibility", () => {
  const fixed = [Role.HiddenWolf, Role.Seer, Role.Bear, Role.Hunter, Role.Villager, Role.Villager],
    game = bootstrapGame(config(fixed), { fixedRoles: fixed });
  expect(getHiddenWolfState(role(game, 1))).toEqual({ hasInheritedKnife: true });
  expect(wolfKnifeHolders(game.world, catalog)).toEqual([1]);
  expect(wolfChatParticipants(game.world, catalog)).toEqual([]);
  expect(wolfTeamPermissions(role(game, 1), catalog).canVoteForKill).toBe(false);
  expect(resolveInspection(game.world, 1, "role", catalog)).toEqual({
    kind: "role",
    role: Role.HiddenWolf,
  });
  const events = game.phaseManager.getEvents(),
    before = events.length;
  refreshHiddenWolfInheritance(game.world, events, 1);
  expect(events).toHaveLength(before);
  expect(events.filter((e) => e.type === "hidden_wolf_awakened").map((e) => e.payload)).toEqual([
    { actorId: 1, day: 1 },
  ]);
  for (const actor of game.world.entityIds())
    expect(
      buildAgentVisibleEventFeed(game.world, events, actor).some(
        (e) => e.type === "hidden_wolf_awakened",
      ),
    ).toBe(actor === 1);
});

test("masked Hidden Wolf exile produces Good grave feedback yet still counts as a true wolf; Knight resolves its real faction", async () => {
  for (const duel of [false, true]) {
    const fixed = [
        Role.HiddenWolf,
        Role.Wolf,
        Role.Knight,
        Role.Gravekeeper,
        Role.Villager,
        Role.Villager,
      ],
      game = bootstrapGame(config(fixed), { fixedRoles: fixed });
    let day = 1;
    const provider = {
      async getAction(request: ActionRequest) {
        if (request.allowedTools.includes("speak_to_wolves"))
          return { name: "speak_to_wolves" as const, args: { text: "End", end_chat: true } };
        if (request.allowedTools.includes("kill_vote"))
          return {
            name: "kill_vote" as const,
            args: { target_id: day === 1 ? null : 2, abstain: day === 1 },
          };
        if (request.allowedTools.includes("speak"))
          return { name: "speak" as const, args: { text: "Raw" } };
        if (request.allowedTools.includes("duel"))
          return duel && day === 1
            ? { name: "duel" as const, args: { target_id: 1, confirm: true } }
            : null;
        if (request.allowedTools.includes("vote"))
          return { name: "vote" as const, args: { target_id: 1, abstain: false } };
        throw new Error(`unexpected:${request.context.stage}`);
      },
    };
    await game.phaseManager.runSingleCycle(provider);
    expect(game.phaseManager.getSnapshot().gameOver).toBe(false);
    expect(getHiddenWolfState(role(game, 1))!.hasInheritedKnife).toBe(false);
    expect(captureExileFeedback(game.world, 1, 1)?.result).toEqual({
      kind: "camp",
      camp: Camp.Good,
    });
    day = 2;
    await game.phaseManager.runSingleCycle(provider);
    expect(game.phaseManager.getSnapshot().result?.winner).toBe(Camp.Good);
    expect(
      game.phaseManager
        .getEvents()
        .filter((e) => e.type === "gravekeeper_reported")
        .map((e) => e.payload.result),
    ).toEqual(duel ? [] : [{ kind: "camp", camp: Camp.Good }]);
    expect(
      game.phaseManager
        .getEvents()
        .filter((e) => e.type === "knight_duel")
        .map((e) => e.payload),
    ).toEqual(duel ? [{ actorId: 3, targetId: 1, result: "wolf" }] : []);
  }
});

test("Bear samples a masked neighbor before pack death, then senses the inherited Hidden Wolf on the next night without retroactive update", async () => {
  const fixed = [Role.Bear, Role.HiddenWolf, Role.Wolf, Role.Seer, Role.Villager, Role.Villager],
    game = bootstrapGame(config(fixed), { fixedRoles: fixed });
  let day = 1;
  const provider = {
    async getAction(request: ActionRequest) {
      if (request.allowedTools.includes("speak_to_wolves"))
        return { name: "speak_to_wolves" as const, args: { text: "End", end_chat: true } };
      if (request.allowedTools.includes("kill_vote"))
        return {
          name: "kill_vote" as const,
          args: { target_id: day === 1 ? 3 : null, abstain: day !== 1 },
        };
      if (request.allowedTools.includes("check_identity"))
        return { name: "check_identity" as const, args: { target_id: 2 } };
      if (request.allowedTools.includes("speak"))
        return { name: "speak" as const, args: { text: "Raw" } };
      if (request.allowedTools.includes("vote"))
        return {
          name: "vote" as const,
          args: { target_id: day === 1 ? null : 2, abstain: day === 1 },
        };
      throw new Error(`unexpected:${request.context.stage}`);
    },
  };
  await game.phaseManager.runSingleCycle(provider);
  expect(getBearState(role(game, 1))!.history).toEqual([{ day: 1, roared: false }]);
  day = 2;
  await game.phaseManager.runSingleCycle(provider);
  expect(getBearState(role(game, 1))!.history).toEqual([
    { day: 1, roared: false },
    { day: 2, roared: true },
  ]);
  expect(game.phaseManager.getSnapshot().result?.winner).toBe(Camp.Good);
  expect(resolveInspection(game.world, 2, "camp", catalog)).toEqual({
    kind: "camp",
    camp: Camp.Wolf,
  });
  expect(captureExileFeedback(game.world, 2, 2)?.result).toEqual({ kind: "camp", camp: Camp.Wolf });
});

for (const takeHidden of [false, true])
  test(`White Wolf King takes ${takeHidden ? "Hidden" : "last villager"}: actual same-batch death or living inheritance precedes ordinary judgment`, async () => {
    const fixed = [
        Role.HiddenWolf,
        Role.WhiteWolfKing,
        Role.Seer,
        Role.Bear,
        Role.Villager,
        Role.Villager,
      ],
      board = {
        ...config(fixed),
        hooks: { onDaybreak: false, onPreElection: false, onPreVote: true, onPerSpeechGap: false },
        selfDestruct: { enabledWindows: [ActionWindow.OnPreVote] },
      },
      game = bootstrapGame(board, { fixedRoles: fixed });
    await game.phaseManager.runSingleCycle({
      async getAction(request) {
        if (request.allowedTools.includes("speak_to_wolves"))
          return { name: "speak_to_wolves", args: { text: "End", end_chat: true } };
        if (request.allowedTools.includes("kill_vote"))
          return { name: "kill_vote", args: { target_id: 5, abstain: false } };
        if (request.allowedTools.includes("check_identity"))
          return { name: "check_identity", args: { target_id: 1 } };
        if (request.allowedTools.includes("speak")) return { name: "speak", args: { text: "Raw" } };
        if (request.allowedTools.includes("self_destruct_with_target"))
          return {
            name: "self_destruct_with_target",
            args: { target_id: takeHidden ? 1 : 6, confirm: true, reason: "Public" },
          };
        throw new Error(`unexpected:${request.context.stage}`);
      },
    });
    expect(getHiddenWolfState(role(game, 1))!.hasInheritedKnife).toBe(!takeHidden);
    expect(
      game.phaseManager
        .getEvents()
        .filter((e) => e.type === "hidden_wolf_awakened")
        .map((e) => e.payload),
    ).toEqual(takeHidden ? [] : [{ actorId: 1, day: 1 }]);
    expect(game.phaseManager.getSnapshot().result).toMatchObject({
      winner: takeHidden ? Camp.Good : Camp.Wolf,
      reason: takeHidden ? "all_wolves_eliminated" : "slaughter_side_completed",
      decidedAt: { checkpoint: "day_interrupted" },
    });
    expect(game.world.getAliveEntityIds()).toEqual(takeHidden ? [3, 4, 6] : [1, 3, 4]);
  });

for (const target of ["hidden", "last_god"] as const)
  test(`Wolf Beauty charms ${target}: remaining Hidden counts as a true wolf and prevents the special last-Beauty exception`, async () => {
    const fixed = [
        Role.HiddenWolf,
        Role.WolfBeauty,
        Role.Witch,
        Role.Knight,
        Role.Villager,
        Role.Villager,
      ],
      game = bootstrapGame(config(fixed), { fixedRoles: fixed });
    await game.phaseManager.runSingleCycle({
      async getAction(request) {
        if (request.allowedTools.includes("speak_to_wolves"))
          return { name: "speak_to_wolves", args: { text: "End", end_chat: true } };
        if (request.allowedTools.includes("kill_vote"))
          return {
            name: "kill_vote",
            args: { target_id: target === "last_god" ? 4 : 6, abstain: false },
          };
        if (request.allowedTools.includes("charm"))
          return { name: "charm", args: { target_id: target === "hidden" ? 1 : 3 } };
        if (request.allowedTools.includes("use_potion"))
          return { name: "use_potion", args: { target_id: 3, potion_type: PotionType.None } };
        if (request.allowedTools.includes("speak")) return { name: "speak", args: { text: "Raw" } };
        if (request.allowedTools.includes("duel")) return null;
        if (request.allowedTools.includes("vote"))
          return { name: "vote", args: { target_id: 2, abstain: false } };
        throw new Error(`unexpected:${request.context.stage}`);
      },
    });
    const events = game.phaseManager.getEvents();
    expect(getHiddenWolfState(role(game, 1))!.hasInheritedKnife).toBe(true);
    expect(events.filter((e) => e.type === "hidden_wolf_awakened").map((e) => e.payload)).toEqual([
      { actorId: 1, day: 1 },
    ]);
    expect(game.phaseManager.getSnapshot().result).toMatchObject({
      winner: target === "hidden" ? Camp.Good : Camp.Wolf,
      reason: target === "hidden" ? "all_wolves_eliminated" : "slaughter_side_completed",
    });
    expect(events.findIndex((e) => e.type === "hidden_wolf_awakened")).toBeLessThan(
      events.findIndex((e) => e.type === "charm_death"),
    );
    expect(game.world.getAliveEntityIds()).toEqual(target === "hidden" ? [3, 4, 5] : [1, 5, 6]);
  });

test("raw expected deaths and permission queries do not inherit; the actual death owner commits once and reviving another wolf only disables current action", async () => {
  const game = bootstrapGame(config(), { fixedRoles: deck }),
    events: GameEvent[] = [],
    life = game.world.getComponent<{ alive: boolean }>(2, COMPONENT.Alive)!;
  life.alive = false;
  expect(canHiddenWolfKnife(role(game, 1), game.world)).toBe(false);
  expect(resolveInspection(game.world, 1, "camp", catalog)).toEqual({
    kind: "camp",
    camp: Camp.Good,
  });
  expect(getHiddenWolfState(role(game, 1))!.hasInheritedKnife).toBe(false);
  await new DeathResolution(game.world, events, new ToolGateway(), new EventRegistry(), {
    day: 1,
    phase: Phase.Voting,
    gameOver: false,
    result: null,
  }).resolve(
    [2],
    { 2: [DeathCause.Exile] },
    {
      async getAction() {
        return { name: "speak", args: { text: "Raw" } };
      },
    },
    Phase.Voting,
    Phase.Voting,
  );
  expect(getHiddenWolfState(role(game, 1))!.hasInheritedKnife).toBe(true);
  expect(canHiddenWolfKnife(role(game, 1), game.world)).toBe(true);
  expect(events.filter((e) => e.type === "hidden_wolf_awakened")).toHaveLength(1);
  life.alive = true;
  expect(canHiddenWolfKnife(role(game, 1), game.world)).toBe(false);
  expect(resolveInspection(game.world, 1, "camp", catalog)).toEqual({
    kind: "camp",
    camp: Camp.Wolf,
  });
  expect(getHiddenWolfState(role(game, 1))!.hasInheritedKnife).toBe(true);
});

test("all wolves in one initial death batch never fake inheritance, while an extra King shot after last pack death preserves the acquired fact on the now-dead Hidden Wolf", async () => {
  for (const additional of [false, true]) {
    const fixed = [
        Role.HiddenWolf,
        additional ? Role.WolfKing : Role.Wolf,
        Role.Seer,
        Role.Bear,
        Role.Villager,
        Role.Villager,
      ],
      game = bootstrapGame(config(fixed), { fixedRoles: fixed }),
      events: GameEvent[] = [];
    await new DeathResolution(game.world, events, new ToolGateway(), new EventRegistry(), {
      day: 1,
      phase: Phase.Day,
      gameOver: false,
      result: null,
    }).resolve(
      additional ? [2] : [1, 2],
      { 1: [DeathCause.Poison], 2: [DeathCause.WolfKill] },
      {
        async getAction(request) {
          return request.allowedTools.includes("shoot")
            ? { name: "shoot", args: { target_id: 1 } }
            : { name: "speak", args: { text: "Raw" } };
        },
      },
      Phase.Night,
      Phase.Day,
    );
    expect(game.world.getAliveEntityIds()).toEqual([3, 4, 5, 6]);
    expect(getHiddenWolfState(role(game, 1))!.hasInheritedKnife).toBe(additional);
    expect(events.filter((e) => e.type === "hidden_wolf_awakened")).toHaveLength(
      additional ? 1 : 0,
    );
    expect(resolveInspection(game.world, 1, "camp", catalog)).toEqual({
      kind: "camp",
      camp: additional ? Camp.Wolf : Camp.Good,
    });
    expect(canHiddenWolfKnife(role(game, 1), game.world)).toBe(false);
  }
});

test("last pack wolf night self-knife does not pre-unmask the same-night Seer check; next night receives real knife, Seer/Bear update, but never retroactive pack chat", async () => {
  const game = bootstrapGame(config(), { fixedRoles: deck });
  let day = 1;
  const calls: Array<[number, string, number]> = [];
  const provider = {
    async getAction(request: ActionRequest) {
      calls.push([request.actorId, request.context.stage, request.context.day]);
      if (request.allowedTools.includes("speak_to_wolves"))
        return {
          name: "speak_to_wolves" as const,
          args: { text: "Secret pack chat", end_chat: true },
        };
      if (request.allowedTools.includes("kill_vote"))
        return {
          name: "kill_vote" as const,
          args: { target_id: day === 1 ? 2 : 5, abstain: false },
        };
      if (request.allowedTools.includes("check_identity"))
        return { name: "check_identity" as const, args: { target_id: 1 } };
      if (request.allowedTools.includes("speak"))
        return { name: "speak" as const, args: { text: "Raw" } };
      if (request.allowedTools.includes("vote"))
        return {
          name: "vote" as const,
          args: { target_id: day === 1 ? null : 1, abstain: day === 1 },
        };
      throw new Error(`unexpected:${request.context.stage}`);
    },
  };
  await game.phaseManager.runSingleCycle(provider);
  expect(getHiddenWolfState(role(game, 1))!.hasInheritedKnife).toBe(true);
  expect(getSeerState(role(game, 3))!.history.map((e) => e.isWerewolf)).toEqual([false]);
  expect(calls.filter((row) => row[0] === 1 && row[1] === "wolf_vote")).toEqual([]);
  day = 2;
  await game.phaseManager.runSingleCycle(provider);
  expect(calls.filter((row) => row[0] === 1 && row[1] === "wolf_vote")).toEqual([
    [1, "wolf_vote", 2],
  ]);
  expect(calls.filter((row) => row[0] === 1 && row[1] === "wolf_discussion")).toEqual([]);
  expect(getSeerState(role(game, 3))!.history.map((e) => e.isWerewolf)).toEqual([false, true]);
  expect(game.phaseManager.getSnapshot().result?.winner).toBe(Camp.Good);
  const feed = buildAgentVisibleEventFeed(game.world, game.phaseManager.getEvents(), 1);
  expect(
    feed.some((e) =>
      ["wolf_tactical_order", "wolf_discussion", "wolf_discussion_ended"].includes(e.type),
    ),
  ).toBe(false);
  expect(
    feed.filter((e) => e.type === "wolf_kill_vote_cast").map((e) => e.payload.actorId),
  ).toEqual([1]);
  expect(getBearState(role(game, 4))!.history.map((e) => e.roared)).toEqual([false, false]);
});

for (const mutation of ["revive", "replace_life", "replace_state", "replace_role"] as const)
  test(`${mutation}: a late inherited knife request cannot cast a vote or kill through a new actor scope`, async () => {
    const fixed = [
        Role.HiddenWolf,
        Role.Seer,
        Role.Bear,
        Role.Hunter,
        Role.Villager,
        Role.Villager,
      ],
      game = bootstrapGame(config(fixed), { fixedRoles: fixed });
    let calls = 0;
    await game.phaseManager.runSingleCycle({
      async getAction(request) {
        if (request.allowedTools.includes("kill_vote")) {
          calls++;
          const life = game.world.getComponent<{ alive: boolean }>(1, COMPONENT.Alive)!;
          if (mutation === "revive") {
            life.alive = false;
            life.alive = true;
          }
          if (mutation === "replace_life")
            game.world.addComponent(1, COMPONENT.Alive, createAliveComponent());
          if (mutation === "replace_state")
            role(game, 1).privateState.hidden_wolf = { hasInheritedKnife: true };
          if (mutation === "replace_role") {
            const old = role(game, 1);
            game.world.addComponent(1, COMPONENT.Role, {
              ...old,
              privateState: { ...old.privateState },
            });
          }
          return { name: "kill_vote", args: { target_id: 5, abstain: false } };
        }
        if (request.allowedTools.includes("check_identity"))
          return { name: "check_identity", args: { target_id: 1 } };
        if (request.allowedTools.includes("speak")) return { name: "speak", args: { text: "Raw" } };
        if (request.allowedTools.includes("vote"))
          return { name: "vote", args: { target_id: null, abstain: true } };
        throw new Error(`unexpected:${request.context.stage}`);
      },
    });
    expect(calls).toBe(1);
    expect(game.world.getAliveEntityIds()).toEqual([1, 2, 3, 4, 5, 6]);
    expect(game.phaseManager.getEvents().some((e) => e.type === "wolf_kill_vote_cast")).toBe(false);
  });
