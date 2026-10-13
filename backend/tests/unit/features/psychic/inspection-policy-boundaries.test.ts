/**
 * Unit tests verify Spirit Seer direct repeat policy, read-only preflight, optional closure and copied resource privacy.
 * Input: Original locale/change/gateway/legacy-policy matrices with bounded direct inspection handlers and the original cached catalog reference.
 * Output and oracle: Exact role/history/stock, cancellation and foreign native-knife refusal remain unchanged; no complete night, PM or model executes.
 */
import { nightStageContext } from "../../../engine/night_stage_fixture";
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  Camp,
  Role,
  Phase,
  WinCondition,
  COMPONENT,
  type BoardConfig,
  type RoleComponent,
  type GameEvent,
  type ActionRequest,
} from "../../../../src/core";
import { sixPlayerMvpConfig } from "../../../../src/runtime/scenarios/six_player_mvp";
import { getGargoyleState } from "../../../../src/game/mechanisms/roles/gargoyle/ports";
import {
  allNightAbilities,
  findNightAbility,
  roleInspectionPolicy,
} from "../../../../src/game/mechanisms/roles/abilities";
import {
  grantNightAbility,
  transferNightAbility,
} from "../../../../src/game/mechanisms/roles/ability_changes";
import {
  ROLE_INSPECTION_STAGE,
  PSYCHIC_INSPECTION_STAGE,
} from "../../../../src/game/mechanisms/roles/role_inspection/night_stages";
import { hasRoleInspectionNightCommit } from "../../../../src/game/mechanisms/roles/role_inspection/night_scope";
import { canGargoyleKnife } from "../../../../src/game/mechanisms/roles/gargoyle/inheritance";
import { NightStageRegistry } from "../../../../src/game/mechanisms/stages/night/night_stage_registry";
import { getDefaultRoleCatalog } from "../../../../src/game/mechanisms/roles/catalog";
import { GameActionRequestFactory } from "../../../../src/game/engine/action_request_factory";
import { ToolGateway } from "../../../../src/game/gateway/tool_gateway";
import { ActionReception } from "../../../../src/ai/agents/player/action_reception";
import { buildAgentVisibleEventFeed } from "../../../../src/game/engine/agent_visible_event_feed";
import { createAliveComponent } from "../../../../src/core/domain/components/alive";
import type { NightStageContext } from "../../../../src/game/mechanisms/stages/night/contracts";

const deck = [Role.Psychic, Role.Wolf, Role.Witch, Role.Guard, Role.Villager, Role.Villager],
  catalog = getDefaultRoleCatalog();

const board = (roles = deck): BoardConfig => ({
  ...sixPlayerMvpConfig,
  boardSize: roles.length,
  roleSetups: [...new Set(roles)].map((role) => ({
    role,
    count: roles.filter((r) => r === role).length,
  })),
  winConditions: [WinCondition.SlaughterSide],
  selfDestruct: { enabledWindows: [] },
});

const role = (game: ReturnType<typeof bootstrapGame>, actor: number) =>
  game.world.getComponent<RoleComponent>(actor, COMPONENT.Role)!;

function context(
  game: ReturnType<typeof bootstrapGame>,
  events: GameEvent[],
  getAction: NightStageContext["actionProvider"]["getAction"],
  day = 1,
  clock = () => true,
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
  test(`${locale}: native Spirit Seer is Good with explicit repeat policy and read-only numeric preflight`, () => {
    const game = bootstrapGame(board(), { fixedRoles: deck, locale }),
      ability = findNightAbility(role(game, 1), "role_check")!,
      before = structuredClone(ability);
    const request: ActionRequest = {
      actorId: 1,
      phase: Phase.Night,
      allowedTools: ["inspect_role"],
      context: {
        day: 1,
        stage: "psychic",
        ability_id: ability.id,
        visible_events: [],
        turn_constraints: { min_valid_actions: 0, max_valid_actions: 1 },
      },
    };
    expect(role(game, 1).camp).toBe(Camp.Good);
    expect(ability.state.policy).toBe("psychic");
    for (const target_id of [1, 999, null, 2.5])
      expect(
        new ActionReception(game.world).validate(request, "inspect_role", { target_id }).ok,
      ).toBe(false);
    expect(
      new ActionReception(game.world).validate(request, "inspect_role", { target_id: 2 }).ok,
    ).toBe(true);
    expect(
      new ActionReception(game.world).validate({ ...request, phase: Phase.Day }, "inspect_role", {
        target_id: 2,
      }),
    ).toMatchObject({ ok: false, error: "ability_phase" });
    expect(ability).toEqual(before);
  });

test("two policies on one Villager run at separate priorities, keep their real identity, and only Psychic repeats next night", async () => {
  const game = bootstrapGame(board(), { fixedRoles: deck }),
    events: GameEvent[] = [],
    calls: Array<[number, string, string | undefined]> = [];
  const garg = grantNightAbility(
    game.world,
    5,
    {
      id: "gift:early-check",
      kind: "role_check",
      state: { lastTarget: null, lastDay: null, history: [] },
      source: { kind: "gift", actorId: 2 },
      startsOnDay: 1,
      maxUses: 2,
    },
    events,
  );
  const psychic = grantNightAbility(
    game.world,
    5,
    {
      id: "gift:late-check",
      kind: "role_check",
      state: { policy: "psychic", lastTarget: null, lastDay: null, history: [] },
      source: { kind: "gift", actorId: 1 },
      startsOnDay: 1,
      maxUses: 3,
    },
    events,
  );
  const stages = new NightStageRegistry().getStages(board(), game.world);
  expect(stages.find((s) => s.id === "role_inspection")!.priority).toBe(180);
  expect(stages.find((s) => s.id === "psychic_inspection")!.priority).toBe(600);
  expect(stages.find((s) => s.id === "witch_action")!.priority).toBeLessThan(600);
  const action: NightStageContext["actionProvider"]["getAction"] = async (request) => {
    calls.push([request.actorId, request.context.stage, request.context.ability_id]);
    expect(request.context.turn_constraints.min_valid_actions).toBe(
      request.context.stage === "psychic" ? 0 : 1,
    );
    return { name: "inspect_role", args: { target_id: 2 } };
  };
  await ROLE_INSPECTION_STAGE.execute(context(game, events, action));
  expect(calls).toEqual([[5, "role_inspection", garg.id]]);
  expect(psychic.uses).toBe(0);
  await PSYCHIC_INSPECTION_STAGE.execute(context(game, events, action));
  expect(calls.slice(1).map((c) => c.slice(0, 2))).toEqual([
    [1, "psychic"],
    [5, "psychic"],
  ]);
  expect(garg.uses).toBe(1);
  expect(psychic.uses).toBe(1);
  expect(role(game, 5).role).toBe(Role.Villager);
  expect(role(game, 5).camp).toBe(Camp.Good);
  const request: ActionRequest = {
    actorId: 5,
    phase: Phase.Night,
    allowedTools: ["inspect_role"],
    context: {
      day: 2,
      stage: "psychic",
      ability_id: psychic.id,
      visible_events: [],
      turn_constraints: {},
    },
  };
  expect(
    new ActionReception(game.world).validate(request, "inspect_role", { target_id: 2 }).ok,
  ).toBe(true);
  expect(
    new ActionReception(game.world).validate(
      { ...request, context: { ...request.context, ability_id: garg.id } },
      "inspect_role",
      { target_id: 2 },
    ),
  ).toMatchObject({ ok: false, error: "role_inspection_repeat" });
  await PSYCHIC_INSPECTION_STAGE.execute(context(game, events, action, 2));
  expect(psychic.state.history).toEqual([
    { day: 1, targetId: 2, result: { kind: "role", role: Role.Wolf } },
    { day: 2, targetId: 2, result: { kind: "role", role: Role.Wolf } },
  ]);
  expect(psychic.uses).toBe(2);
  for (const actor of game.world.entityIds())
    expect(
      buildAgentVisibleEventFeed(game.world, events, actor)
        .filter((e) => e.type === "role_inspected")
        .every((e) => e.payload.actorId === actor),
    ).toBe(true);
});

test("a genuine optional pass closes and transfers this night without consuming a use or rewriting the last report", async () => {
  const game = bootstrapGame(board(), { fixedRoles: deck }),
    events: GameEvent[] = [],
    ability = findNightAbility(role(game, 1), "role_check")!;
  await PSYCHIC_INSPECTION_STAGE.execute(
    context(game, events, async () => ({ name: "inspect_role", args: { target_id: 2 } })),
  );
  await PSYCHIC_INSPECTION_STAGE.execute(
    context(
      game,
      events,
      async (request) => {
        expect(request.context.turn_constraints.min_valid_actions).toBe(0);
        return null;
      },
      2,
    ),
  );
  expect(ability.uses).toBe(1);
  expect(ability.lastUsedDay).toBe(2);
  expect(ability.state.lastDay).toBe(1);
  expect(ability.state.history).toHaveLength(1);
  expect(hasRoleInspectionNightCommit(game.world, 2)).toBe(true);
  expect(events.filter((e) => e.type === "role_inspection_skipped").map((e) => e.payload)).toEqual([
    { actorId: 1, day: 2, reason: "passed" },
  ]);
  transferNightAbility(game.world, 1, 5, ability.id, "transfer:closed-psychic", events, {
    kind: "role_check",
    statePolicy: (state) => ({
      history: structuredClone(state.history),
      lastTarget: state.lastTarget,
      lastDay: state.lastDay,
      policy: state.policy,
    }),
  });
  const moved = findNightAbility(role(game, 5), "role_check", "transfer:closed-psychic")!;
  expect(moved.lastUsedDay).toBe(2);
  expect(moved.uses).toBe(1);
  await PSYCHIC_INSPECTION_STAGE.execute(
    context(
      game,
      events,
      async () => {
        throw new Error("no_same_night_reuse");
      },
      2,
    ),
  );
  const before = events.length;
  expect(() =>
    transferNightAbility(game.world, 5, 6, moved.id, "transfer:changed-policy", events, {
      kind: "role_check",
      statePolicy: (state) => ({ ...state, policy: "gargoyle" }),
    }),
  ).toThrow("ability_transfer_role_inspection_history_changed");
  expect(events).toHaveLength(before);
});

test("no living targets closes without a request/use/result, whereas three illegal replies fail rather than masquerade as a pass", async () => {
  const game = bootstrapGame(board(), { fixedRoles: deck }),
    events: GameEvent[] = [],
    ability = findNightAbility(role(game, 1), "role_check")!;
  let calls = 0;
  await expect(
    PSYCHIC_INSPECTION_STAGE.execute(
      context(game, events, async () => {
        calls++;
        return { name: "inspect_role", args: { target_id: 1 } };
      }),
    ),
  ).rejects.toThrow("role_inspection_valid_action_missing");
  expect(calls).toBe(3);
  expect(ability.lastUsedDay).toBeNull();
  expect(ability.uses).toBe(0);
  expect(events).toEqual([]);
  for (const id of game.world.getAliveEntityIds().filter((id) => id !== 1))
    game.world.getComponent<{ alive: boolean }>(id, COMPONENT.Alive)!.alive = false;
  await PSYCHIC_INSPECTION_STAGE.execute(
    context(game, events, async () => {
      throw new Error("no_empty_request");
    }),
  );
  expect(ability.uses).toBe(0);
  expect(ability.lastUsedDay).toBe(1);
  expect(ability.state.history).toEqual([]);
  expect(
    events.filter((e) => e.type === "role_inspection_skipped").map((e) => e.payload.reason),
  ).toEqual(["no_targets"]);
});

for (const change of [
  "clock",
  "actor_revive",
  "target_revive",
  "target_replace",
  "role",
  "state",
  "policy",
  "disabled",
] as const)
  test(`${change}: a late role inspection cannot consume/report through a replaced scope`, async () => {
    const game = bootstrapGame(board(), { fixedRoles: deck }),
      events: GameEvent[] = [],
      ability = findNightAbility(role(game, 1), "role_check")!,
      old = ability.state;
    let current = true,
      calls = 0;
    const ctx = context(
      game,
      events,
      async () => {
        calls++;
        if (change === "clock") current = false;
        if (change === "actor_revive" || change === "target_revive") {
          const life = game.world.getComponent<{ alive: boolean }>(
            change === "actor_revive" ? 1 : 2,
            COMPONENT.Alive,
          )!;
          life.alive = false;
          life.alive = true;
        }
        if (change === "target_replace")
          game.world.addComponent(2, COMPONENT.Alive, createAliveComponent());
        if (change === "role") role(game, 1).role = Role.Seer;
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
          ).policy = "gargoyle";
        if (change === "disabled") (ability as { disabled: boolean }).disabled = true;
        return { name: "inspect_role", args: { target_id: 2 } };
      },
      1,
      () => current,
    );
    if (change.startsWith("target"))
      await expect(PSYCHIC_INSPECTION_STAGE.execute(ctx)).rejects.toThrow(
        "role_inspection_valid_action_missing",
      );
    else await PSYCHIC_INSPECTION_STAGE.execute(ctx);
    expect(old.history).toEqual([]);
    expect(ability.uses).toBe(0);
    expect(ability.lastUsedDay).toBeNull();
    expect(events).toEqual([]);
    expect(calls).toBe(change.startsWith("target") ? 3 : 1);
  });

test("invalid policy is rejected before installing an instance, and gifted Psychic completion never grants a Gargoyle native knife", async () => {
  const fixed = [Role.Gargoyle, Role.Seer, Role.Guard, Role.Witch, Role.Villager, Role.Villager],
    game = bootstrapGame(board(fixed), { fixedRoles: fixed }),
    events: GameEvent[] = [];
  expect(() =>
    grantNightAbility(
      game.world,
      5,
      {
        id: "gift:invalid-policy",
        kind: "role_check",
        state: { policy: "unknown" as any, lastTarget: null, lastDay: null, history: [] },
        source: { kind: "gift", actorId: 2 },
        startsOnDay: 1,
        maxUses: 1,
      },
      events,
    ),
  ).toThrow("role_inspection_policy_invalid");
  expect(allNightAbilities(role(game, 5))).toEqual([]);
  expect(events).toEqual([]);
  const native = findNightAbility(role(game, 1), "role_check")!;
  (native as { disabled: boolean }).disabled = true;
  grantNightAbility(
    game.world,
    1,
    {
      id: "gift:late-to-gargoyle",
      kind: "role_check",
      state: { policy: "psychic", lastTarget: null, lastDay: null, history: [] },
      source: { kind: "gift", actorId: 2 },
      startsOnDay: 1,
      maxUses: 1,
    },
    events,
  );
  await ROLE_INSPECTION_STAGE.execute(
    context(game, events, async () => {
      throw new Error("disabled_native_no_request");
    }),
  );
  await PSYCHIC_INSPECTION_STAGE.execute(
    context(game, events, async () => ({ name: "inspect_role", args: { target_id: 2 } })),
  );
  expect(getGargoyleState(role(game, 1))!.hasInheritedKnife).toBe(true);
  expect(canGargoyleKnife(role(game, 1), game.world)).toBe(false);
  expect(roleInspectionPolicy(native.state)).toBe("gargoyle");
});

for (const mutation of ["disabled", "policy", "transfer", "clock"] as const)
  test(`${mutation}: a successful gateway cannot commit after bound permission is revoked`, async () => {
    const game = bootstrapGame(board(), { fixedRoles: deck }),
      events: GameEvent[] = [],
      ability = findNightAbility(role(game, 1), "role_check")!,
      gateway = new ToolGateway(),
      validate = gateway.validateAndSanitize.bind(gateway);
    let current = true;
    gateway.validateAndSanitize = (world, actorId, call, validationContext) => {
      const result = validate(world, actorId, call, validationContext);
      if (mutation === "disabled") (ability as { disabled: boolean }).disabled = true;
      if (mutation === "policy")
        (
          ability.state as {
            policy: import("@ai-werewolf-arena/game-contract").RoleInspectionPolicy | undefined;
          }
        ).policy = "gargoyle";
      if (mutation === "transfer")
        transferNightAbility(game.world, 1, 5, ability.id, "transfer:gateway-revoke", events, {
          kind: "role_check",
          statePolicy: (s) => structuredClone(s),
        });
      if (mutation === "clock") current = false;
      return result;
    };
    const ctx = context(
      game,
      events,
      async () => ({ name: "inspect_role", args: { target_id: 2 } }),
      1,
      () => current,
    );
    ctx.toolGateway = gateway;
    await PSYCHIC_INSPECTION_STAGE.execute(ctx);
    expect(ability.uses).toBe(0);
    expect(ability.lastUsedDay).toBeNull();
    expect(ability.state.history).toEqual([]);
    expect(
      events.filter((e) => e.type === "role_inspected" || e.type === "role_inspection_skipped"),
    ).toEqual([]);
    expect(hasRoleInspectionNightCommit(game.world, 1)).toBe(false);
  });

test("cancelled null is not a legal pass and copied Psychic policy keeps independent resources/history and timing", async () => {
  const game = bootstrapGame(board(), { fixedRoles: deck }),
    events: GameEvent[] = [],
    native = findNightAbility(role(game, 1), "role_check")!;
  let current = true;
  await PSYCHIC_INSPECTION_STAGE.execute(
    context(
      game,
      events,
      async () => {
        current = false;
        return null;
      },
      1,
      () => current,
    ),
  );
  expect(native.lastUsedDay).toBeNull();
  expect(events).toEqual([]);
  expect(hasRoleInspectionNightCommit(game.world, 1)).toBe(false);
  const copy = grantNightAbility(
      game.world,
      5,
      {
        id: "copy:late-inspection",
        kind: "role_check",
        state: { policy: "psychic", lastTarget: null, lastDay: null, history: [] },
        source: { kind: "copy", actorId: 1, abilityId: native.id },
        startsOnDay: 1,
        maxUses: 1,
      },
      events,
    ),
    calls: number[] = [];
  const act: NightStageContext["actionProvider"]["getAction"] = async (request) => {
    calls.push(request.actorId);
    return { name: "inspect_role", args: { target_id: 2 } };
  };
  await ROLE_INSPECTION_STAGE.execute(context(game, events, act));
  expect(calls).toEqual([]);
  await PSYCHIC_INSPECTION_STAGE.execute(context(game, events, act));
  expect(calls).toEqual([1, 5]);
  expect(copy.uses).toBe(1);
  expect(native.uses).toBe(1);
  expect(copy.state.history).toEqual(native.state.history);
  expect(copy.state.history).not.toBe(native.state.history);
  expect(role(game, 5).camp).toBe(Camp.Good);
  (copy.state.history[0] as { targetId: number }).targetId = 6;
  expect(native.state.history[0].targetId).toBe(2);
});

test("legacy omitted Gargoyle policy remains equivalent to optional undefined in a complete JSON-normalized transfer", () => {
  const game = bootstrapGame(board(), { fixedRoles: deck }),
    events: GameEvent[] = [],
    ability = grantNightAbility(
      game.world,
      5,
      {
        id: "gift:legacy-no-policy",
        kind: "role_check",
        state: {
          lastTarget: 2,
          lastDay: 1,
          history: [{ day: 1, targetId: 2, result: { kind: "role", role: Role.Wolf } }],
        },
        source: { kind: "gift", actorId: 1 },
        startsOnDay: 1,
        maxUses: 2,
      },
      events,
    );
  transferNightAbility(game.world, 5, 6, ability.id, "transfer:legacy-no-policy", events, {
    kind: "role_check",
    statePolicy: (state) => ({ ...state, policy: undefined }),
  });
  const moved = findNightAbility(role(game, 6), "role_check", "transfer:legacy-no-policy")!;
  expect(moved.state).toEqual(ability.state);
  expect(Object.hasOwn(moved.state, "policy")).toBe(false);
  expect(roleInspectionPolicy(moved.state)).toBe("gargoyle");
});
