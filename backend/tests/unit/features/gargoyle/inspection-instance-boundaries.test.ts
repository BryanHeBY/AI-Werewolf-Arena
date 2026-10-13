/**
 * Unit tests check Gargoyle inspection permissions, captured stage scopes and separate native/gift/copy instance histories. Inputs are literal decks, controlled single-stage callbacks and revocation mutations; literal reports, use counts and original references are the oracle. Complete phase cycles and death-resolution interaction chains belong to the scenario file.
 */
import { nightStageContext } from "../../../engine/night_stage_fixture";
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  Role,
  Camp,
  Phase,
  WinCondition,
  COMPONENT,
  type BoardConfig,
  type RoleComponent,
  type ActionRequest,
  type GameEvent,
} from "../../../../src/core";
import { sixPlayerMvpConfig } from "../../../../src/runtime/scenarios/six_player_mvp";
import {
  getGargoyleState,
  setGargoyleState,
} from "../../../../src/game/mechanisms/roles/private_state";
import {
  findNightAbility,
  allNightAbilities,
} from "../../../../src/game/mechanisms/roles/abilities";
import { canGargoyleKnife } from "../../../../src/game/mechanisms/roles/gargoyle/inheritance";
import { ROLE_INSPECTION_STAGE } from "../../../../src/game/mechanisms/roles/role_inspection/night_stages";
import {
  knownWolfTeammates,
  wolfChatParticipants,
  wolfKnifeHolders,
} from "../../../../src/game/mechanisms/roles/wolf_team";
import { getDefaultRoleCatalog } from "../../../../src/game/mechanisms/roles/catalog";
import { ActionReception } from "../../../../src/ai/agents/player/action_reception";
import { ToolGateway } from "../../../../src/game/gateway/tool_gateway";
import { GameActionRequestFactory } from "../../../../src/game/engine/action_request_factory";
import type { NightStageContext } from "../../../../src/game/mechanisms/stages/night/contracts";
import { buildAgentVisibleEventFeed } from "../../../../src/game/engine/agent_visible_event_feed";
import {
  grantNightAbility,
  transferNightAbility,
} from "../../../../src/game/mechanisms/roles/ability_changes";
import { createAliveComponent } from "../../../../src/core/domain/components/alive";

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
        if (mutation === "state")
          (
            ability as {
              state: import("@ai-werewolf-arena/game-contract").RoleInspectionReadState;
            }
          ).state = { lastTarget: null, lastDay: null, history: [] };
        if (mutation === "native_state")
          setGargoyleState(role(game, 1), structuredClone(getGargoyleState(role(game, 1))!));
        if (mutation === "disabled") (ability as { disabled: boolean }).disabled = true;
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
  (
    ability.state as unknown as {
      history: {
        day: number;
        targetId: import("@ai-werewolf-arena/game-contract").EntityId;
        result: Extract<
          import("@ai-werewolf-arena/game-contract").InspectionResult,
          { kind: "role" }
        >;
      }[];
    }
  ).history = game.world
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
    (
      ability.state as unknown as {
        history: {
          day: number;
          targetId: import("@ai-werewolf-arena/game-contract").EntityId;
          result: Extract<
            import("@ai-werewolf-arena/game-contract").InspectionResult,
            { kind: "role" }
          >;
        }[];
      }
    ).history = [{ day: 0, targetId: 3, result: { kind: "role", role: Role.Villager } }];
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
