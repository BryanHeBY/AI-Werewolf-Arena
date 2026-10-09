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
  getGargoyleState,
  setGargoyleState,
  getRoleInspectionState,
  getHiddenWolfState,
  getSeerState,
} from "../../../src/game/mechanisms/roles/private_state";
import { findNightAbility, allNightAbilities } from "../../../src/game/mechanisms/roles/abilities";
import { canGargoyleKnife } from "../../../src/game/mechanisms/roles/gargoyle/inheritance";
import { ROLE_INSPECTION_STAGE } from "../../../src/game/mechanisms/roles/role_inspection/night_stages";
import {
  knownWolfTeammates,
  wolfChatParticipants,
  wolfKnifeHolders,
} from "../../../src/game/mechanisms/roles/wolf_team";
import { getDefaultRoleCatalog } from "../../../src/game/mechanisms/roles/catalog";
import { ActionReception } from "../../../src/ai/agents/player/action_reception";
import { ToolGateway } from "../../../src/game/gateway/tool_gateway";
import { GameActionRequestFactory } from "../../../src/game/engine/action_request_factory";
import type { NightStageContext } from "../../../src/game/mechanisms/stages/night/contracts";
import { buildAgentVisibleEventFeed } from "../../../src/game/engine/agent_visible_event_feed";
import {
  grantNightAbility,
  transferNightAbility,
} from "../../../src/game/mechanisms/roles/ability_changes";
import { EventRegistry } from "../../../src/game/engine/event_registry";
import { DeathResolution } from "../../../src/game/engine/death_resolution";
import { createAliveComponent } from "../../../src/core/domain/components/alive";
const deck = [Role.Gargoyle, Role.Wolf, Role.Seer, Role.Gravekeeper, Role.Villager, Role.Villager],
  catalog = getDefaultRoleCatalog();
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
function stageContext(
  game: ReturnType<typeof bootstrapGame>,
  events: GameEvent[],
  getAction: NightStageContext["actionProvider"]["getAction"],
  clock = () => true,
  day = 1,
): NightStageContext {
  const requests = new GameActionRequestFactory(game.world, events, day);
  return nightStageContext({
    world: game.world,
    events,
    roleCatalog: catalog,
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
      dreamLinks: [],
    },
  });
}

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: Gargoyle has no automatic wolf knowledge/chat/knife/blast; strict role preflight does not consume its instance`, () => {
    const game = bootstrapGame(config(), { fixedRoles: deck, locale }),
      receive = new ActionReception(game.world),
      request: ActionRequest = {
        actorId: 1,
        phase: Phase.Night,
        allowedTools: ["inspect_role"],
        context: {
          day: 1,
          stage: "role_inspection",
          ability_id: "native:role_check",
          visible_events: [],
          turn_constraints: {},
        },
      },
      before = structuredClone(role(game, 1).privateState);
    expect(knownWolfTeammates(game.world, 1, catalog)).toEqual([]);
    expect(knownWolfTeammates(game.world, 2, catalog)).toEqual([]);
    expect(wolfChatParticipants(game.world, catalog)).toEqual([2]);
    expect(wolfKnifeHolders(game.world, catalog)).toEqual([2]);
    expect(receive.validate(request, "inspect_role", { target_id: 3 }).ok).toBe(true);
    for (const target_id of [1, 999, null, 2.5])
      expect(receive.validate(request, "inspect_role", { target_id }).ok).toBe(false);
    expect(
      receive.validate({ ...request, phase: Phase.Day }, "inspect_role", { target_id: 3 }),
    ).toMatchObject({ ok: false, error: "ability_phase" });
    expect(
      receive.validate(
        { ...request, allowedTools: ["self_destruct"], phase: Phase.Voting },
        "self_destruct",
        { confirm: true, reason: "Raw" },
      ).ok,
    ).toBe(false);
    expect(role(game, 1).privateState).toEqual(before);
  });

test("a native role result is actor-only and independent of the Seer's camp; Day inheritance waits for next native inspection before knife", async () => {
  const game = bootstrapGame(config(), { fixedRoles: deck }),
    calls: Array<[number, string, number]> = [];
  let day = 1;
  const provider = {
    async getAction(request: ActionRequest) {
      calls.push([request.actorId, request.context.stage, request.context.day]);
      if (request.allowedTools.includes("inspect_role"))
        return { name: "inspect_role" as const, args: { target_id: day === 1 ? 3 : 5 } };
      if (request.allowedTools.includes("speak_to_wolves"))
        return { name: "speak_to_wolves" as const, args: { text: "End", end_chat: true } };
      if (request.allowedTools.includes("kill_vote"))
        return {
          name: "kill_vote" as const,
          args: { target_id: day === 1 ? 6 : 5, abstain: false },
        };
      if (request.allowedTools.includes("check_identity"))
        return { name: "check_identity" as const, args: { target_id: 1 } };
      if (request.allowedTools.includes("speak"))
        return { name: "speak" as const, args: { text: "Raw" } };
      if (request.allowedTools.includes("vote"))
        return { name: "vote" as const, args: { target_id: 2, abstain: false } };
      throw new Error(`unexpected:${request.context.stage}`);
    },
  };
  await game.phaseManager.runSingleCycle(provider);
  expect(getGargoyleState(role(game, 1))).toEqual({ hasInheritedKnife: true });
  expect(canGargoyleKnife(role(game, 1), game.world)).toBe(false);
  expect(getRoleInspectionState(role(game, 1))!.history).toEqual([
    { day: 1, targetId: 3, result: { kind: "role", role: Role.Seer } },
  ]);
  day = 2;
  await game.phaseManager.runSingleCycle(provider);
  expect(game.phaseManager.getSnapshot().result?.winner).toBe(Camp.Wolf);
  expect(getSeerState(role(game, 3))!.history.map((row) => row.result)).toEqual([
    { kind: "camp", camp: Camp.Wolf },
    { kind: "camp", camp: Camp.Wolf },
  ]);
  expect(calls.filter((row) => row[0] === 1 && row[1] === "wolf_vote")).toEqual([
    [1, "wolf_vote", 2],
  ]);
  expect(calls.filter((row) => row[0] === 1 && row[1] === "wolf_discussion")).toEqual([]);
  expect(findNightAbility(role(game, 1), "role_check")!.uses).toBe(2);
  for (const actor of game.world.entityIds()) {
    const feed = buildAgentVisibleEventFeed(game.world, game.phaseManager.getEvents(), actor);
    expect(feed.filter((e) => e.type === "role_inspected")).toHaveLength(actor === 1 ? 2 : 0);
    expect(feed.some((e) => e.type === "gargoyle_awakened")).toBe(actor === 1);
    if (actor === 1)
      expect(
        feed.some((e) => ["wolf_tactical_order", "wolf_discussion_ended"].includes(e.type)),
      ).toBe(false);
  }
});

test("repeat is per instance, including revived same-ID targets; completed same-night stage does not publish or consume twice", async () => {
  const game = bootstrapGame(config(), { fixedRoles: deck }),
    events: GameEvent[] = [],
    ctx = stageContext(game, events, async () => ({
      name: "inspect_role",
      args: { target_id: 3 },
    }));
  await ROLE_INSPECTION_STAGE.execute(ctx);
  await ROLE_INSPECTION_STAGE.execute(ctx);
  const ability = findNightAbility(role(game, 1), "role_check")!;
  expect(ability.uses).toBe(1);
  expect(events.filter((e) => e.type === "role_inspected")).toHaveLength(1);
  const life = game.world.getComponent<{ alive: boolean }>(3, COMPONENT.Alive)!;
  life.alive = false;
  life.alive = true;
  const req: ActionRequest = {
    actorId: 1,
    phase: Phase.Night,
    allowedTools: ["inspect_role"],
    context: {
      day: 2,
      stage: "role_inspection",
      ability_id: ability.id,
      visible_events: [],
      turn_constraints: {},
    },
  };
  expect(
    new ActionReception(game.world).validate(req, "inspect_role", { target_id: 3 }),
  ).toMatchObject({ ok: false, error: "role_inspection_repeat" });
  expect(ability.uses).toBe(1);
});

for (const mutation of [
  "clock",
  "actor_revive",
  "target_revive",
  "target_replace",
  "role",
  "state",
  "native_state",
  "disabled",
] as const)
  test(`${mutation}: an old inspection request never publishes or consumes on a revoked scope`, async () => {
    const game = bootstrapGame(config(), { fixedRoles: deck }),
      events: GameEvent[] = [],
      ability = findNightAbility(role(game, 1), "role_check")!,
      old = ability.state;
    let current = true,
      calls = 0;
    const ctx = stageContext(
      game,
      events,
      async () => {
        calls++;
        if (mutation === "clock") current = false;
        if (mutation === "actor_revive") {
          const life = game.world.getComponent<{ alive: boolean }>(1, COMPONENT.Alive)!;
          life.alive = false;
          life.alive = true;
        }
        if (mutation === "target_revive") {
          const life = game.world.getComponent<{ alive: boolean }>(3, COMPONENT.Alive)!;
          life.alive = false;
          life.alive = true;
        }
        if (mutation === "target_replace")
          game.world.addComponent(3, COMPONENT.Alive, createAliveComponent());
        if (mutation === "role") role(game, 1).role = Role.Wolf;
        if (mutation === "state") ability.state = { lastTarget: null, lastDay: null, history: [] };
        if (mutation === "native_state")
          setGargoyleState(role(game, 1), structuredClone(getGargoyleState(role(game, 1))!));
        if (mutation === "disabled") ability.disabled = true;
        return { name: "inspect_role", args: { target_id: 3 } };
      },
      () => current,
    );
    if (mutation.startsWith("target"))
      await expect(ROLE_INSPECTION_STAGE.execute(ctx)).rejects.toThrow(
        "role_inspection_required_action_missing",
      );
    else await ROLE_INSPECTION_STAGE.execute(ctx);
    expect(events.filter((e) => e.type === "role_inspected")).toEqual([]);
    expect(old.history).toEqual([]);
    expect(ability.uses).toBe(0);
    expect(calls).toBe(mutation.startsWith("target") ? 3 : 1);
  });

test("mandatory exhausted invalid responses throw, preserving no false result/consumption, while no eligible targets completes before a sole Gargoyle knife", async () => {
  const fixed = [
      Role.Gargoyle,
      Role.Seer,
      Role.Gravekeeper,
      Role.Guard,
      Role.Villager,
      Role.Villager,
    ],
    game = bootstrapGame(config(fixed), { fixedRoles: fixed }),
    events: GameEvent[] = [];
  let calls = 0;
  const ctx = stageContext(game, events, async () => {
    calls++;
    return null;
  });
  await expect(ROLE_INSPECTION_STAGE.execute(ctx)).rejects.toThrow(
    "role_inspection_required_action_missing",
  );
  expect(calls).toBe(3);
  expect(canGargoyleKnife(role(game, 1), game.world)).toBe(false);
  const ability = findNightAbility(role(game, 1), "role_check")!;
  ability.state.history = game.world
    .entityIds()
    .filter((id) => id !== 1)
    .map((targetId) => ({ day: 0, targetId, result: { kind: "role", role: Role.Villager } }));
  await ROLE_INSPECTION_STAGE.execute(
    stageContext(game, events, async () => {
      throw new Error("no_fake_empty_request");
    }),
  );
  expect(ability.uses).toBe(0);
  expect(ability.lastUsedDay).toBeNull();
  expect(canGargoyleKnife(role(game, 1), game.world)).toBe(true);
  expect(events.filter((e) => e.type === "role_inspected")).toEqual([]);
});

test("a gifted role check keeps its real Villager identity and a controlled transfer carries typed history/resources without re-emitting old reports", async () => {
  const game = bootstrapGame(config(), { fixedRoles: deck }),
    events: GameEvent[] = [];
  const gift = grantNightAbility(
    game.world,
    5,
    {
      id: "gift:role-test",
      kind: "role_check",
      state: { lastTarget: null, lastDay: null, history: [] },
      source: { kind: "gift", actorId: 3 },
      startsOnDay: 1,
      maxUses: 2,
    },
    events,
  );
  await ROLE_INSPECTION_STAGE.execute(
    stageContext(game, events, async (request) => ({
      name: "inspect_role",
      args: { target_id: request.actorId === 1 ? 3 : 2 },
    })),
  );
  expect(role(game, 5).role).toBe(Role.Villager);
  expect(role(game, 5).camp).toBe(Camp.Good);
  expect(gift.uses).toBe(1);
  expect(gift.state.history).toEqual([
    { day: 1, targetId: 2, result: { kind: "role", role: Role.Wolf } },
  ]);
  const before = events.filter((e) => e.type === "role_inspected").length;
  expect(() =>
    transferNightAbility(game.world, 5, 6, gift.id, "transfer:role-test", events, {
      kind: "role_check",
      statePolicy: () => ({ lastTarget: null, lastDay: null, history: [] }),
    }),
  ).toThrow("ability_transfer_role_inspection_history_changed");
  expect(findNightAbility(role(game, 5), "role_check", gift.id)).toBe(gift);
  expect(events.filter((e) => e.type === "role_inspected")).toHaveLength(before);
  transferNightAbility(game.world, 5, 6, gift.id, "transfer:role-test", events, {
    kind: "role_check",
    statePolicy: (s) => ({
      history: structuredClone(s.history),
      lastDay: s.lastDay,
      lastTarget: s.lastTarget,
    }),
  });
  const moved = allNightAbilities(role(game, 6)).find((a) => a.kind === "role_check")!;
  expect(moved.state.history).toEqual(gift.state.history);
  expect(moved.uses).toBe(1);
  expect(findNightAbility(role(game, 5), "role_check", gift.id)).toBeUndefined();
  expect(events.filter((e) => e.type === "role_inspected")).toHaveLength(before);
  expect(role(game, 6).camp).toBe(Camp.Good);
  expect(wolfChatParticipants(game.world, catalog)).toEqual([2]);
});

for (const exhaustedOn of [2, 3])
  test(`last eligible target disappearing on attempt ${exhaustedOn} completes without a fabricated check or use`, async () => {
    const fixed = [Role.Gargoyle, Role.Seer, Role.Villager],
      game = bootstrapGame(config(fixed), { fixedRoles: fixed }),
      events: GameEvent[] = [],
      ability = findNightAbility(role(game, 1), "role_check")!;
    ability.state.history = [
      { day: 0, targetId: 3, result: { kind: "role", role: Role.Villager } },
    ];
    let calls = 0;
    await ROLE_INSPECTION_STAGE.execute(
      stageContext(game, events, async () => {
        if (++calls === exhaustedOn)
          game.world.getComponent<{ alive: boolean }>(2, COMPONENT.Alive)!.alive = false;
        return null;
      }),
    );
    expect(calls).toBe(exhaustedOn);
    expect(ability.uses).toBe(0);
    expect(ability.lastUsedDay).toBeNull();
    expect(ability.state.history).toHaveLength(1);
    expect(events).toEqual([]);
    expect(canGargoyleKnife(role(game, 1), game.world)).toBe(true);
  });

for (const takeGargoyle of [false, true])
  test(`White Wolf King takes ${takeGargoyle ? "Gargoyle" : "last villager"}: actual same-batch death or living inheritance precedes ordinary judgment`, async () => {
    const fixed = [
        Role.Gargoyle,
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
        if (request.allowedTools.includes("inspect_role"))
          return { name: "inspect_role", args: { target_id: 3 } };
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
            args: { target_id: takeGargoyle ? 1 : 6, confirm: true, reason: "Public" },
          };
        throw new Error(`unexpected:${request.context.stage}`);
      },
    });
    expect(getGargoyleState(role(game, 1))!.hasInheritedKnife).toBe(!takeGargoyle);
    expect(
      game.phaseManager
        .getEvents()
        .filter((e) => e.type === "gargoyle_awakened")
        .map((e) => e.payload),
    ).toEqual(takeGargoyle ? [] : [{ actorId: 1, day: 1 }]);
    expect(game.phaseManager.getSnapshot().result).toMatchObject({
      winner: takeGargoyle ? Camp.Good : Camp.Wolf,
      reason: takeGargoyle ? "all_wolves_eliminated" : "slaughter_side_completed",
      decidedAt: { checkpoint: "day_interrupted" },
    });
    expect(game.world.getAliveEntityIds()).toEqual(takeGargoyle ? [3, 4, 6] : [1, 3, 4]);
  });

for (const target of ["gargoyle", "last_god"] as const)
  test(`Wolf Beauty charms ${target}: remaining Gargoyle counts as a true wolf and prevents the special last-Beauty exception`, async () => {
    const fixed = [
        Role.Gargoyle,
        Role.WolfBeauty,
        Role.Witch,
        Role.Knight,
        Role.Villager,
        Role.Villager,
      ],
      game = bootstrapGame(config(fixed), { fixedRoles: fixed });
    await game.phaseManager.runSingleCycle({
      async getAction(request) {
        if (request.allowedTools.includes("inspect_role"))
          return { name: "inspect_role", args: { target_id: 3 } };
        if (request.allowedTools.includes("speak_to_wolves"))
          return { name: "speak_to_wolves", args: { text: "End", end_chat: true } };
        if (request.allowedTools.includes("kill_vote"))
          return {
            name: "kill_vote",
            args: { target_id: target === "last_god" ? 4 : 6, abstain: false },
          };
        if (request.allowedTools.includes("charm"))
          return { name: "charm", args: { target_id: target === "gargoyle" ? 1 : 3 } };
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
    expect(getGargoyleState(role(game, 1))!.hasInheritedKnife).toBe(true);
    expect(events.filter((e) => e.type === "gargoyle_awakened").map((e) => e.payload)).toEqual([
      { actorId: 1, day: 1 },
    ]);
    expect(game.phaseManager.getSnapshot().result).toMatchObject({
      winner: target === "gargoyle" ? Camp.Good : Camp.Wolf,
      reason: target === "gargoyle" ? "all_wolves_eliminated" : "slaughter_side_completed",
    });
    expect(events.findIndex((e) => e.type === "gargoyle_awakened")).toBeLessThan(
      events.findIndex((e) => e.type === "charm_death"),
    );
    expect(game.world.getAliveEntityIds()).toEqual(target === "gargoyle" ? [3, 4, 5] : [1, 5, 6]);
  });

test("real granted Dream plus Hunter shot commits the caster and linked Gargoyle as one extra proposal, without a transient inheritance", async () => {
  const fixed = [Role.Gargoyle, Role.Wolf, Role.Hunter, Role.Bear, Role.Villager, Role.Villager],
    game = bootstrapGame(config(fixed), { fixedRoles: fixed });
  grantNightAbility(
    game.world,
    2,
    {
      id: "gift:gargoyle-chain-dream",
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
      if (request.allowedTools.includes("inspect_role"))
        return { name: "inspect_role", args: { target_id: 3 } };
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
  expect(getGargoyleState(role(game, 1))!.hasInheritedKnife).toBe(false);
  expect(game.phaseManager.getEvents().some((e) => e.type === "gargoyle_awakened")).toBe(false);
  expect(game.phaseManager.getSnapshot().result?.winner).toBe(Camp.Good);
});

test("Gargoyle and Hidden Wolf cannot have simultaneous knives; independent role checks honor masked labels without rewriting old reports", async () => {
  const fixed = [
      Role.Gargoyle,
      Role.HiddenWolf,
      Role.Seer,
      Role.Bear,
      Role.Villager,
      Role.Villager,
    ],
    game = bootstrapGame(config(fixed), { fixedRoles: fixed }),
    events: GameEvent[] = [];
  const gift = grantNightAbility(
    game.world,
    5,
    {
      id: "gift:second-inspector",
      kind: "role_check",
      state: { lastTarget: null, lastDay: null, history: [] },
      source: { kind: "gift", actorId: 3 },
      startsOnDay: 2,
      maxUses: 1,
    },
    events,
  );
  expect(wolfKnifeHolders(game.world, catalog)).toEqual([]);
  expect(knownWolfTeammates(game.world, 1, catalog)).toEqual([]);
  expect(knownWolfTeammates(game.world, 2, catalog)).toEqual([1]);
  await ROLE_INSPECTION_STAGE.execute(
    stageContext(game, events, async () => ({ name: "inspect_role", args: { target_id: 2 } })),
  );
  expect(getRoleInspectionState(role(game, 1))!.history[0].result).toEqual({
    kind: "role",
    role: Role.Villager,
  });
  await new DeathResolution(game.world, events, new ToolGateway(), new EventRegistry(), {
    day: 1,
    phase: Phase.Voting,
    gameOver: false,
    result: null,
  }).resolve(
    [1],
    { 1: [DeathCause.Exile] },
    {
      async getAction() {
        return { name: "speak", args: { text: "Raw" } };
      },
    },
    Phase.Voting,
    Phase.Voting,
  );
  expect(getHiddenWolfState(role(game, 2))!.hasInheritedKnife).toBe(true);
  await ROLE_INSPECTION_STAGE.execute(
    stageContext(
      game,
      events,
      async () => ({ name: "inspect_role", args: { target_id: 2 } }),
      () => true,
      2,
    ),
  );
  expect(gift.state.history[0].result).toEqual({ kind: "role", role: Role.HiddenWolf });
  expect(getRoleInspectionState(role(game, 1))!.history[0].result).toEqual({
    kind: "role",
    role: Role.Villager,
  });
  expect(role(game, 5).camp).toBe(Camp.Good);
});

test("Knight uses Gargoyle true camp despite a prior private role inspection", async () => {
  const { KnightDuelWindow } = await import("../../../src/core"),
    fixed = [Role.Gargoyle, Role.Wolf, Role.Knight, Role.Gravekeeper, Role.Villager, Role.Villager],
    game = bootstrapGame(
      { ...config(fixed), knight: { enabledWindows: [KnightDuelWindow.AfterSpeeches] } },
      { fixedRoles: fixed },
    );
  await game.phaseManager.runSingleCycle({
    async getAction(request) {
      if (request.allowedTools.includes("inspect_role"))
        return { name: "inspect_role", args: { target_id: 3 } };
      if (request.allowedTools.includes("speak_to_wolves"))
        return { name: "speak_to_wolves", args: { text: "End", end_chat: true } };
      if (request.allowedTools.includes("kill_vote"))
        return { name: "kill_vote", args: { target_id: 6, abstain: false } };
      if (request.allowedTools.includes("speak")) return { name: "speak", args: { text: "Raw" } };
      if (request.allowedTools.includes("duel"))
        return { name: "duel", args: { target_id: 1, confirm: true } };
      throw new Error(`unexpected:${request.context.stage}`);
    },
  });
  expect(
    game.phaseManager
      .getEvents()
      .filter((e) => e.type === "knight_duel")
      .map((e) => e.payload),
  ).toEqual([{ actorId: 3, targetId: 1, result: "wolf" }]);
  expect(game.world.getAliveEntityIds()).toEqual([2, 3, 4, 5]);
  expect(game.phaseManager.getSnapshot().gameOver).toBe(false);
  expect(getGargoyleState(role(game, 1))!.hasInheritedKnife).toBe(false);
});

test("native, gift and copy instances each inspect the same target once with separate history/resources and actor-only reports", async () => {
  const game = bootstrapGame(config(), { fixedRoles: deck }),
    events: GameEvent[] = [];
  const native = findNightAbility(role(game, 1), "role_check")!,
    gift = grantNightAbility(
      game.world,
      5,
      {
        id: "gift:independent-check",
        kind: "role_check",
        state: { lastTarget: null, lastDay: null, history: [] },
        source: { kind: "gift", actorId: 3 },
        startsOnDay: 1,
        maxUses: 2,
      },
      events,
    ),
    copy = grantNightAbility(
      game.world,
      6,
      {
        id: "copy:independent-check",
        kind: "role_check",
        state: { lastTarget: null, lastDay: null, history: [] },
        source: { kind: "copy", actorId: 1, abilityId: native.id },
        startsOnDay: 1,
        maxUses: 1,
      },
      events,
    );
  await ROLE_INSPECTION_STAGE.execute(
    stageContext(game, events, async () => ({ name: "inspect_role", args: { target_id: 2 } })),
  );
  for (const ability of [native, gift, copy]) {
    expect(ability.uses).toBe(1);
    expect(ability.state.history).toEqual([
      { day: 1, targetId: 2, result: { kind: "role", role: Role.Wolf } },
    ]);
  }
  expect(gift.state).not.toBe(copy.state);
  expect(gift.state.history).not.toBe(copy.state.history);
  expect(role(game, 5).camp).toBe(Camp.Good);
  expect(role(game, 6).role).toBe(Role.Villager);
  for (const actor of game.world.entityIds())
    expect(
      buildAgentVisibleEventFeed(game.world, events, actor)
        .filter((e) => e.type === "role_inspected")
        .map((e) => e.payload.actorId),
    ).toEqual([1, 5, 6].includes(actor) ? [actor] : []);
});

for (const exileGargoyle of [false, true])
  test(`Bear senses unmasked Gargoyle and Gravekeeper receives frozen Wolf label after ${exileGargoyle ? "Gargoyle" : "ordinary wolf"} exile`, async () => {
    const fixed = [
        Role.Gargoyle,
        Role.Bear,
        Role.Villager,
        Role.Gravekeeper,
        Role.Wolf,
        Role.Villager,
      ],
      game = bootstrapGame(config(fixed), { fixedRoles: fixed });
    let day = 1;
    const provider = {
      async getAction(request: ActionRequest) {
        if (request.allowedTools.includes("inspect_role"))
          return { name: "inspect_role" as const, args: { target_id: day === 1 ? 4 : 3 } };
        if (request.allowedTools.includes("speak_to_wolves"))
          return { name: "speak_to_wolves" as const, args: { text: "End", end_chat: true } };
        if (request.allowedTools.includes("kill_vote"))
          return {
            name: "kill_vote" as const,
            args: {
              target_id: day === 1 ? 6 : exileGargoyle ? 5 : null,
              abstain: day === 2 && !exileGargoyle,
            },
          };
        if (request.allowedTools.includes("speak"))
          return { name: "speak" as const, args: { text: "Raw" } };
        if (request.allowedTools.includes("vote"))
          return {
            name: "vote" as const,
            args: { target_id: day === 1 ? (exileGargoyle ? 1 : 5) : 1, abstain: false },
          };
        throw new Error(`unexpected:${request.context.stage}`);
      },
    };
    await game.phaseManager.runSingleCycle(provider);
    expect(game.phaseManager.getSnapshot().gameOver).toBe(false);
    expect(getGargoyleState(role(game, 1))!.hasInheritedKnife).toBe(!exileGargoyle);
    day = 2;
    await game.phaseManager.runSingleCycle(provider);
    const events = game.phaseManager.getEvents();
    expect(events.filter((e) => e.type === "bear_roared").map((e) => e.payload.roared)).toEqual([
      true,
      true,
    ]);
    expect(events.filter((e) => e.type === "gravekeeper_reported").map((e) => e.payload)).toEqual([
      {
        actorId: 4,
        targetId: exileGargoyle ? 1 : 5,
        exileDay: 1,
        receivedDay: 2,
        result: { kind: "camp", camp: Camp.Wolf },
      },
    ]);
    expect(game.phaseManager.getSnapshot().result?.winner).toBe(Camp.Good);
  });

for (const mutation of [
  "disabled",
  "transfer",
  "state",
  "native_state",
  "actor_revive",
  "wolf_revive",
] as const)
  test(`${mutation}: revoking a completed native inspection never authorizes a later knife or rewrites the committed report`, async () => {
    const fixed = [
        Role.Gargoyle,
        Role.Seer,
        Role.Guard,
        Role.Villager,
        Role.Villager,
        mutation === "wolf_revive" ? Role.Wolf : Role.Villager,
      ],
      game = bootstrapGame(config(fixed), { fixedRoles: fixed }),
      ability = findNightAbility(role(game, 1), "role_check")!;
    let knifeCalls = 0;
    if (mutation === "wolf_revive")
      await new DeathResolution(game.world, [], new ToolGateway(), new EventRegistry(), {
        day: 1,
        phase: Phase.Day,
        gameOver: false,
        result: null,
      }).resolve(
        [6],
        { 6: [DeathCause.Shot] },
        {
          async getAction() {
            return { name: "speak", args: { text: "Raw" } };
          },
        },
        Phase.Day,
        Phase.Day,
      );
    await game.phaseManager.runSingleCycle({
      async getAction(request) {
        if (request.allowedTools.includes("inspect_role"))
          return { name: "inspect_role", args: { target_id: 2 } };
        if (request.allowedTools.includes("guard")) {
          expect(canGargoyleKnife(role(game, 1), game.world)).toBe(true);
          if (mutation === "disabled") ability.disabled = true;
          if (mutation === "transfer")
            transferNightAbility(game.world, 1, 4, ability.id, "transfer:completed-check", [], {
              kind: "role_check",
              statePolicy: (s) => structuredClone(s),
            });
          if (mutation === "state") ability.state = structuredClone(ability.state);
          if (mutation === "native_state")
            setGargoyleState(role(game, 1), structuredClone(getGargoyleState(role(game, 1))!));
          if (mutation === "actor_revive") {
            const life = game.world.getComponent<{ alive: boolean }>(1, COMPONENT.Alive)!;
            life.alive = false;
            life.alive = true;
          }
          if (mutation === "wolf_revive")
            game.world.getComponent<{ alive: boolean }>(6, COMPONENT.Alive)!.alive = true;
          expect(canGargoyleKnife(role(game, 1), game.world)).toBe(false);
          return { name: "guard", args: { target_id: 5, abstain: false } };
        }
        if (request.allowedTools.includes("kill_vote")) {
          if (request.actorId === 1) knifeCalls++;
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
    expect(knifeCalls).toBe(0);
    expect(
      game.phaseManager
        .getEvents()
        .filter((e) => e.type === "role_inspected")
        .map((e) => e.payload.result),
    ).toEqual([{ kind: "role", role: Role.Seer }]);
    expect(ability.uses).toBe(1);
    expect(ability.state.history).toEqual([
      { day: 1, targetId: 2, result: { kind: "role", role: Role.Seer } },
    ]);
    expect(getGargoyleState(role(game, 1))!.hasInheritedKnife).toBe(true);
    expect(game.world.getAliveEntityIds()).toEqual([1, 2, 3, 4, 5, 6]);
    expect(
      game.phaseManager
        .getEvents()
        .filter((e) => e.type === "wolf_kill_vote_cast" && e.payload.actorId === 1),
    ).toEqual([]);
  });
