/**
 * Unit tests for lonely girl setup. Inputs are original required choices, getter/revocation matrices and
 * public board configuration. Original literal receipts, reference/getter/error traces, facts and expected
 * state remain the oracle. Bounded setup window/request/late getters/camp ledger and literal checkpoint
 * projection. Case12 only attempts entry while setup authority blocks NightPipeline/PM before a cycle, so
 * it stays the same setup-contract owner. No complete game phase or paid model runs; existing local windows
 * and denied entry probes remain bounded.
 */
import { expect, test, spyOn } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  Role,
  Camp,
  Phase,
  COMPONENT,
  WinCondition,
  createRoleComponent,
  createCampComponent,
  createVictoryComponent,
  createAliveComponent,
  type BoardConfig,
  type ActionRequest,
  type ToolCall,
  type GameEvent,
  type RoleComponent,
  type AliveComponent,
  type VictoryComponent,
} from "../../../../src/core";
import { foxBoard } from "../../../support/cursed_fox_scenarios";
import { LonelyGirlSetupWindow } from "../../../../src/game/mechanisms/roles/lonely_girl/setup";
import {
  getLonelyGirlState,
  LONELY_GIRL_POLICY,
} from "../../../../src/game/mechanisms/roles/lonely_girl/state";
import {
  lonelyGirlBinding,
  lonelyGirlReady,
  hasActiveLonelyGirl,
  projectLonelyGirl,
  projectLonelyGirlSetup,
  lonelyGirlRequestScope,
  inheritLonelyGirlDeadlineRequest,
  openLonelyGirlNight,
} from "../../../../src/game/mechanisms/roles/lonely_girl/lifecycle";
import { ToolGateway } from "../../../../src/game/gateway/tool_gateway";
import { ActionReception } from "../../../../src/ai/agents/player/action_reception";
import { GameActionRequestFactory } from "../../../../src/game/engine/action_request_factory";
import { NightPipeline } from "../../../../src/game/engine/phase_pipeline/night_pipeline";
import { DamageResolutionSystem } from "../../../../src/core/domain/systems/damage_resolution_system";
import { buildAgentVisibleEventFeed } from "../../../../src/game/engine/agent_visible_event_feed";
import {
  readLonelyGirlEventFact,
  readLonelyGirlChoiceTool,
  lonelyGirlEventLabel,
} from "@ai-werewolf-arena/game-text";
import {
  knownWolfTeammates,
  wolfTeamPermissions,
} from "../../../../src/game/mechanisms/roles/wolf_team";
import {
  getDefaultRoleCatalog,
  getDefaultWinConditionRegistry,
} from "../../../../src/game/mechanisms";
import { ConditionRegistry } from "../../../../src/core/domain/registries/condition_registry";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../../src/runtime/config/board_definition";
import { captureCheckpoint } from "../../../../src/runtime/simulation/reproduction_context";

const deck = [Role.LonelyGirl, Role.Wolf, Role.Wolf, Role.Seer, Role.Witch, Role.Villager];

function fixture(roles = deck, extra: Partial<BoardConfig> = {}) {
  const config = { ...foxBoard(roles), ...extra };
  return { ...bootstrapGame(config, { fixedRoles: roles }), config, events: [] as GameEvent[] };
}

type Fixture = ReturnType<typeof fixture>;

const role = (g: Fixture, id = 1) => g.world.getComponent<RoleComponent>(id, COMPONENT.Role)!;

const victory = (g: Fixture) => g.world.getComponent<VictoryComponent>(1, COMPONENT.Victory)!;

const choose = (target_id = 2): ToolCall => ({
  name: "choose_admired_player",
  args: { target_id },
});

const setup = (
  g: Fixture,
  body: (r: ActionRequest) => Promise<ToolCall | null> = async () => choose(),
  current = () => true,
  gateway = new ToolGateway(),
) =>
  new LonelyGirlSetupWindow(g.world, gateway, g.events).execute(
    g.config,
    { getAction: body },
    1,
    current,
  );

const changes: { name: string; apply: (g: Fixture) => void }[] = [
  {
    name: "actor life",
    apply: (g) => g.world.addComponent(1, COMPONENT.Alive, createAliveComponent()),
  },
  {
    name: "actor revive",
    apply: (g) => {
      const a = g.world.getComponent<AliveComponent>(1, COMPONENT.Alive)!;
      a.alive = false;
      a.alive = true;
    },
  },
  {
    name: "actor body",
    apply: (g) =>
      g.world.addComponent(1, COMPONENT.Role, createRoleComponent(Role.LonelyGirl, Camp.Good)),
  },
  {
    name: "actor role value",
    apply: (g) => {
      role(g).role = Role.Villager;
    },
  },
  {
    name: "actor role camp",
    apply: (g) => {
      role(g).camp = Camp.Wolf;
    },
  },
  {
    name: "actor private container",
    apply: (g) => {
      (role(g) as { privateState: Readonly<Record<string, unknown>> }).privateState = {
        ...role(g).privateState,
      };
    },
  },
  {
    name: "actor replacement state",
    apply: (g) => {
      (role(g).privateState as Record<string, unknown>).lonelyGirl = {
        ...getLonelyGirlState(role(g))!,
      };
    },
  },
  {
    name: "actor Camp",
    apply: (g) => g.world.addComponent(1, COMPONENT.Camp, createCampComponent(Camp.Good)),
  },
  {
    name: "actor Victory",
    apply: (g) => g.world.addComponent(1, COMPONENT.Victory, createVictoryComponent([])),
  },
  {
    name: "Victory empty new array",
    apply: (g) => {
      victory(g).affiliations = [];
    },
  },
  {
    name: "Victory same array nonempty",
    apply: (g) => {
      victory(g).affiliations.push({ kind: "faction", faction: Camp.Good });
    },
  },
  {
    name: "state changed",
    apply: (g) => {
      (getLonelyGirlState(role(g))! as { remaining: 0 | 1 }).remaining = 0;
    },
  },
  {
    name: "config changed",
    apply: (g) => {
      g.config.boardSize = 7;
    },
  },
  {
    name: "target life",
    apply: (g) => g.world.addComponent(2, COMPONENT.Alive, createAliveComponent()),
  },
  {
    name: "target dead",
    apply: (g) => {
      g.world.getComponent<AliveComponent>(2, COMPONENT.Alive)!.alive = false;
    },
  },
  {
    name: "target Role",
    apply: (g) =>
      g.world.addComponent(2, COMPONENT.Role, createRoleComponent(Role.Wolf, Camp.Wolf)),
  },
  {
    name: "target camp value",
    apply: (g) => {
      role(g, 2).camp = Camp.Good;
    },
  },
  {
    name: "target Camp",
    apply: (g) => g.world.addComponent(2, COMPONENT.Camp, createCampComponent(Camp.Wolf)),
  },
  {
    name: "target private container",
    apply: (g) => {
      (role(g, 2) as { privateState: Readonly<Record<string, unknown>> }).privateState = {};
    },
  },
  {
    name: "other candidate Camp",
    apply: (g) => g.world.addComponent(3, COMPONENT.Camp, createCampComponent(Camp.Wolf)),
  },
];

for (const target of [2, 4, 6])
  test(`true original target ${target}: own role/camp/stock unchanged and independent membership`, async () => {
    const g = fixture(),
      original = role(g),
      originalLife = g.world.getComponent<AliveComponent>(1, COMPONENT.Alive);
    expect(victory(g).affiliations).toEqual([]);
    await setup(g, async (r) => {
      expect(r.allowedTools).toEqual(["choose_admired_player"]);
      expect(r.context.turn_constraints.min_valid_actions).toBe(1);
      expect(r.context.turn_constraints.max_valid_actions).toBe(1);
      expect(r.context.turn_constraints.required_any_tools).toEqual(["choose_admired_player"]);
      expect(r.context.allow_fallback).toBe(false);
      expect(r.context.action_failure_policy).toBe("error");
      expect(lonelyGirlRequestScope(g.world, r)).toBe(lonelyGirlBinding(g.world));
      return choose(target);
    });
    expect(role(g)).toBe(original);
    expect(role(g).role).toBe(Role.LonelyGirl);
    expect(role(g).camp).toBe(Camp.Good);
    expect(g.world.getComponent<AliveComponent>(1, COMPONENT.Alive)).toBe(originalLife);
    expect(Object.keys(role(g).privateState)).toEqual(["lonelyGirl"]);
    expect(getLonelyGirlState(role(g))).toEqual({
      policy: LONELY_GIRL_POLICY,
      remaining: 0,
      choice: { day: 1, targetId: target },
    });
    expect(victory(g).affiliations).toEqual([
      { kind: "faction", faction: target === 2 ? Camp.Wolf : Camp.Good },
    ]);
    expect(projectLonelyGirlSetup(g.world)).toEqual({
      policy: LONELY_GIRL_POLICY,
      actorId: 1,
      status: "complete",
    });
    expect(lonelyGirlReady(g.world)).toBe(true);
    expect(knownWolfTeammates(g.world, 1, getDefaultRoleCatalog())).toEqual([]);
    expect(wolfTeamPermissions(role(g), getDefaultRoleCatalog(), g.world).canVoteForKill).toBe(
      false,
    );
  });

for (const raw of [
  null,
  choose(1),
  choose(99),
  { name: "choose_admired_player", args: { target_id: null } },
  { name: "choose_admired_player", args: { target_id: "2" } },
  { name: "choose_admired_player", args: { target_id: true } },
  { name: "choose_admired_player", args: { target_id: 2, extra: 1 } },
  { name: "choose_exemplar", args: { target_id: 2 } },
])
  test(`mandatory invalid choice ${JSON.stringify(raw)} closes no membership/fallback`, async () => {
    const g = fixture();
    await expect(setup(g, async () => raw as ToolCall | null)).rejects.toThrow();
    expect(projectLonelyGirlSetup(g.world)?.status).toBe("failed");
    expect(getLonelyGirlState(role(g))?.remaining).toBe(0);
    expect(victory(g).affiliations).toEqual([]);
    expect(g.events).toEqual([]);
    expect(hasActiveLonelyGirl(g.world)).toBe(false);
    expect(lonelyGirlReady(g.world)).toBe(false);
    await expect(setup(g)).rejects.toThrow();
  });

for (const change of changes)
  test(`late ${change.name}: cancel with no fact or new state consumption`, async () => {
    const g = fixture(),
      old = getLonelyGirlState(role(g))!;
    expect(
      await setup(g, async () => {
        change.apply(g);
        return choose();
      }),
    ).toBe(false);
    expect(projectLonelyGirlSetup(g.world)?.status).toBe("cancelled");
    expect(g.events).toEqual([]);
    expect(old.remaining).toBe(0);
    expect(old.choice).toBeNull();
    expect(lonelyGirlBinding(g.world)?.membership).toBeNull();
    expect(hasActiveLonelyGirl(g.world)).toBe(false);
    if (change.name === "actor replacement state")
      expect(getLonelyGirlState(role(g))?.remaining).toBe(1);
  });

for (const [id, field] of [
  [1, "role"],
  [1, "privateState"],
  [2, "role"],
  [2, "camp"],
  [2, "privateState"],
] as const)
  test(`late ${id}/${field} getter is never invoked`, async () => {
    const g = fixture();
    let reads = 0;
    expect(
      await setup(g, async () => {
        Object.defineProperty(role(g, id), field, {
          get() {
            reads++;
            throw new Error("getter_read");
          },
          configurable: true,
        });
        return choose();
      }),
    ).toBe(false);
    expect(reads).toBe(0);
    expect(g.events).toEqual([]);
  });

for (const field of ["policy", "remaining", "choice"] as const)
  test(`late owned state ${field} getter zero with authoritative failure projection`, async () => {
    const g = fixture();
    let reads = 0;
    expect(
      await setup(g, async () => {
        Object.defineProperty(getLonelyGirlState(role(g))!, field, {
          get() {
            reads++;
            throw new Error("getter_read");
          },
          configurable: true,
        });
        return choose();
      }),
    ).toBe(false);
    expect(reads).toBe(0);
    expect(projectLonelyGirl(g.world, role(g))).toEqual({
      policy: LONELY_GIRL_POLICY,
      remaining: 0,
      choice: null,
    });
    const cp = captureCheckpoint(
      g.world,
      g.phaseManager.getSnapshot(),
      0,
      false,
      0,
      new Error("cancelled"),
    );
    expect(cp.players[0]?.privateState).toEqual({
      lonelyGirl: { policy: LONELY_GIRL_POLICY, remaining: 0, choice: null },
    });
    expect(cp.players[0]?.victory.affiliations).toEqual([]);
    expect(reads).toBe(0);
  });

test("original target Camp replacement before setup cancels before factory/provider", async () => {
  const g = fixture();
  g.world.addComponent(2, COMPONENT.Camp, createCampComponent(Camp.Wolf));
  let calls = 0;
  expect(
    await setup(g, async () => {
      calls++;
      return choose();
    }),
  ).toBe(false);
  expect(calls).toBe(0);
  expect(projectLonelyGirlSetup(g.world)?.status).toBe("cancelled");
});

test("post-gateway cancellation cannot install affiliation", async () => {
  const g = fixture(),
    gateway = new ToolGateway(),
    original = gateway.validateAndSanitize.bind(gateway);
  const spy = spyOn(gateway, "validateAndSanitize").mockImplementation((...args) => {
    const result = original(...args);
    g.world.getComponent<AliveComponent>(1, COMPONENT.Alive)!.alive = false;
    return result;
  });
  try {
    expect(
      await setup(
        g,
        async () => choose(),
        () => true,
        gateway,
      ),
    ).toBe(false);
    expect(lonelyGirlBinding(g.world)?.membership).toBeNull();
    expect(g.events).toEqual([]);
  } finally {
    spy.mockRestore();
  }
});

test("factory-side revocation is checked before provider", async () => {
  const g = fixture(),
    original = GameActionRequestFactory.prototype.create;
  let calls = 0;
  const spy = spyOn(GameActionRequestFactory.prototype, "create").mockImplementation(function (
    this: GameActionRequestFactory,
    input,
  ) {
    const r = original.call(this, input);
    g.world.addComponent(2, COMPONENT.Camp, createCampComponent(Camp.Wolf));
    return r;
  });
  try {
    expect(
      await setup(g, async () => {
        calls++;
        return choose();
      }),
    ).toBe(false);
    expect(calls).toBe(0);
    expect(g.events).toEqual([]);
  } finally {
    spy.mockRestore();
  }
});

test("opaque request only trusted deadline clone and original context", async () => {
  const g = fixture();
  await setup(g, async (r) => {
    const receiver = new ActionReception(g.world),
      bounded = { ...r, deadlineAtMs: Date.now() + 1000 };
    expect(receiver.validate(r, "choose_admired_player", { target_id: 2 }).ok).toBe(true);
    expect(receiver.validate(bounded, "choose_admired_player", { target_id: 2 }).ok).toBe(false);
    inheritLonelyGirlDeadlineRequest(r, bounded);
    expect(receiver.validate(bounded, "choose_admired_player", { target_id: 2 }).ok).toBe(true);
    const forged = { ...r, context: { ...r.context } };
    inheritLonelyGirlDeadlineRequest(r, forged);
    expect(receiver.validate(forged, "choose_admired_player", { target_id: 2 }).ok).toBe(false);
    expect(receiver.validate(r, "choose_exemplar", { target_id: 2 }).ok).toBe(false);
    return choose();
  });
});

test("cross World request does not gain authority", async () => {
  const a = fixture(),
    b = fixture();
  let original: ActionRequest | undefined,
    release = () => {};
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  const running = setup(a, async (r) => {
    original = r;
    await wait;
    return choose();
  });
  await setup(b, async (r) => {
    expect(
      new ActionReception(b.world).validate(original!, "choose_admired_player", { target_id: 2 })
        .ok,
    ).toBe(false);
    expect(
      new ActionReception(b.world).validate(r, "choose_admired_player", { target_id: 2 }).ok,
    ).toBe(true);
    return choose();
  });
  release();
  await running;
});

test("Girl state/fact never reveals target camp to actor or other seats", async () => {
  const g = fixture();
  await setup(g);
  for (const id of g.world.entityIds()) {
    const feed = buildAgentVisibleEventFeed(g.world, g.events, id);
    expect(feed).toHaveLength(id === 1 ? 1 : 0);
    if (id === 1) {
      expect(Object.keys(feed[0]!.payload).sort()).toEqual([
        "actorId",
        "day",
        "policy",
        "targetId",
      ]);
      expect(feed[0]!.payload).not.toHaveProperty("camp");
      expect(readLonelyGirlEventFact(feed[0]!.type, feed[0]!.payload)).not.toBeNull();
    }
  }
  expect(projectLonelyGirl(g.world, role(g))).not.toHaveProperty("membership");
  expect(projectLonelyGirl(g.world, role(g))).not.toHaveProperty("camp");
  expect(readLonelyGirlEventFact(g.events[0]!.type, g.events[0]!.payload)?.camp).toBe(Camp.Wolf);
});

test("Girl membership survives both deaths and target future change; City still counts real Good Girl", async () => {
  const g = fixture();
  await setup(g);
  role(g, 2).camp = Camp.Good;
  g.world.addComponent(2, COMPONENT.Camp, createCampComponent(Camp.Good));
  g.world.getComponent<AliveComponent>(2, COMPONENT.Alive)!.alive = false;
  expect(victory(g).affiliations).toEqual([{ kind: "faction", faction: Camp.Wolf }]);
  g.world.getComponent<AliveComponent>(6, COMPONENT.Alive)!.alive = false;
  const judge = new ConditionRegistry(getDefaultWinConditionRegistry());
  expect(judge.evaluate(g.world, WinCondition.SlaughterCity)).toBeNull();
  for (const id of [4, 5]) g.world.getComponent<AliveComponent>(id, COMPONENT.Alive)!.alive = false;
  expect(judge.evaluate(g.world, WinCondition.SlaughterCity)).toBeNull();
  g.world.getComponent<AliveComponent>(1, COMPONENT.Alive)!.alive = false;
  expect(judge.evaluate(g.world, WinCondition.SlaughterCity)?.winner).toBe(Camp.Wolf);
  expect(projectLonelyGirl(g.world, role(g))?.choice).toEqual({ day: 1, targetId: 2 });
  expect(victory(g).affiliations).toEqual([{ kind: "faction", faction: Camp.Wolf }]);
});

test("pending/active/closed setup and ordinary Night cannot be bypassed; reentry leaves PM events untouched", async () => {
  const g = fixture(),
    pipeline = new NightPipeline({
      world: g.world,
      toolGateway: new ToolGateway(),
      damageResolutionSystem: new DamageResolutionSystem(),
      events: g.events,
    });
  await expect(
    pipeline.execute(
      g.config,
      {
        async getAction() {
          return null;
        },
      },
      1,
    ),
  ).rejects.toThrow("lonely_girl_setup_before_night_required");
  expect(() => g.phaseManager.jumpTo(Phase.Day)).toThrow();
  await setup(g, async () => {
    const before = g.phaseManager.getSnapshot(),
      count = g.phaseManager.getEvents().length;
    await expect(
      g.phaseManager.runSingleCycle({
        async getAction() {
          return null;
        },
      }),
    ).rejects.toThrow();
    expect(() => g.phaseManager.jumpTo(Phase.Voting)).toThrow();
    expect(g.phaseManager.getSnapshot()).toEqual(before);
    expect(g.phaseManager.getEvents()).toHaveLength(count);
    await expect(setup(g)).rejects.toThrow();
    return choose();
  });
  openLonelyGirlNight(g.world, 1)();
  expect(() => openLonelyGirlNight(g.world, 1)).toThrow();
});

test("provider exception and late phase cancellation close original resources", async () => {
  const a = fixture();
  const error = new Error("strict_failure");
  await expect(
    setup(a, async () => {
      throw error;
    }),
  ).rejects.toBe(error);
  expect(projectLonelyGirlSetup(a.world)?.status).toBe("failed");
  const b = fixture();
  let active = true;
  expect(
    await setup(
      b,
      async () => {
        active = false;
        return choose();
      },
      () => active,
    ),
  ).toBe(false);
  expect(projectLonelyGirlSetup(b.world)?.status).toBe("cancelled");
  expect(b.events).toEqual([]);
});

test("finite config roundtrip requires City/basic/singleton/nonempty factions and normal N", () => {
  const g = fixture(),
    def = boardDefinitionFromConfig("girl", g.config);
  expect(parseBoardDefinition(def).config.lonelyGirl?.policy).toBe(LONELY_GIRL_POLICY);
  expect(g.world.entityIds()).toHaveLength(6);
  for (const roles of [
    [Role.LonelyGirl, Role.Wolf, Role.Hybrid, Role.Seer, Role.Witch, Role.Villager],
    [Role.LonelyGirl, Role.LonelyGirl, Role.Wolf, Role.Seer, Role.Witch, Role.Villager],
    [Role.LonelyGirl, Role.Wolf, Role.Wolf, Role.Wolf, Role.Wolf, Role.Wolf],
    [Role.LonelyGirl, Role.Wolf, Role.Seer, Role.Villager],
    [Role.LonelyGirl, Role.Villager, Role.Seer, Role.Witch, Role.Hunter, Role.Guard],
  ])
    expect(() => fixture(roles)).toThrow();
  expect(() => fixture(deck, { winConditions: [WinCondition.WolfReachHalf] })).toThrow();
  expect(() => fixture(deck, { events: { pack: "awa_wall_notes_once_v1" } })).toThrow();
});

test("shared strict full/lean readers reject extra fields/getters and never need live state", () => {
  const full = {
      policy: LONELY_GIRL_POLICY,
      actorId: 1,
      day: 1 as const,
      targetId: 2,
      camp: Camp.Wolf as const,
    },
    lean = { policy: LONELY_GIRL_POLICY, actorId: 1, day: 1 as const, targetId: 2 };
  expect(readLonelyGirlEventFact("lonely_girl_admired_chosen", full)).toEqual(full);
  expect(readLonelyGirlEventFact("lonely_girl_admired_chosen", lean)).toEqual(lean);
  expect(
    readLonelyGirlEventFact("lonely_girl_admired_chosen", { ...lean, affiliation: Camp.Wolf }),
  ).toBeNull();
  let reads = 0;
  const bad = Object.defineProperty({ ...lean }, "camp", {
    get() {
      reads++;
      return Camp.Wolf;
    },
    enumerable: true,
  });
  expect(readLonelyGirlEventFact("lonely_girl_admired_chosen", bad)).toBeNull();
  expect(
    readLonelyGirlChoiceTool({
      name: "choose_admired_player",
      args: { target_id: 2, extra: true },
    }),
  ).toBeNull();
  expect(reads).toBe(0);
  for (const locale of ["zh-CN", "en"] as const) {
    expect(lonelyGirlEventLabel("lonely_girl_admired_chosen", full, locale)).not.toBeNull();
    expect(lonelyGirlEventLabel("lonely_girl_admired_chosen", lean, locale)).not.toBeNull();
  }
});

for (const change of ["mutation", "getter"] as const)
  test(`completed original nested choice ${change} cannot pollute authority, DTO or checkpoint`, async () => {
    const g = fixture();
    await setup(g);
    const original = getLonelyGirlState(role(g))!.choice!;
    let reads = 0;
    if (change === "mutation") (original as { targetId: number }).targetId = 6;
    else
      Object.defineProperty(original, "targetId", {
        get() {
          reads++;
          throw new Error("foreign_getter");
        },
        enumerable: true,
        configurable: true,
      });
    expect(projectLonelyGirl(g.world, role(g))?.choice).toEqual({ day: 1, targetId: 2 });
    const cp = captureCheckpoint(g.world, g.phaseManager.getSnapshot(), 1, true, g.events.length);
    expect(cp.players[0]!.privateState.lonelyGirl).toEqual({
      policy: LONELY_GIRL_POLICY,
      remaining: 0,
      choice: { day: 1, targetId: 2 },
    });
    expect(cp.players[0]!.victory.affiliations).toEqual([{ kind: "faction", faction: Camp.Wolf }]);
    expect(reads).toBe(0);
  });

for (const change of ["role_getter", "replaced_state_getter", "target_getter"] as const)
  test(`failed ${change}: safe original audit snapshot invokes no foreign getter`, async () => {
    const g = fixture();
    let reads = 0;
    expect(
      await setup(g, async () => {
        if (change === "role_getter")
          Object.defineProperty(role(g), "role", {
            get() {
              reads++;
              throw new Error("foreign_role");
            },
            configurable: true,
          });
        else if (change === "target_getter")
          Object.defineProperty(role(g, 2), "camp", {
            get() {
              reads++;
              throw new Error("foreign_target");
            },
            configurable: true,
          });
        else {
          const next = createRoleComponent(Role.LonelyGirl, Camp.Good);
          Object.defineProperty(next, "privateState", {
            get() {
              reads++;
              throw new Error("foreign_state");
            },
            configurable: true,
          });
          g.world.addComponent(1, COMPONENT.Role, next);
        }
        return choose();
      }),
    ).toBe(false);
    const cp = captureCheckpoint(
      g.world,
      g.phaseManager.getSnapshot(),
      1,
      false,
      0,
      new Error("cancelled"),
    );
    expect(cp.lonelyGirlSetup?.status).toBe("cancelled");
    expect(cp.players[0]!.role).toBe(Role.LonelyGirl);
    expect(cp.players[0]!.camp).toBe(Camp.Good);
    expect(cp.players[0]!.privateState.lonelyGirl).toEqual({
      policy: LONELY_GIRL_POLICY,
      remaining: 0,
      choice: null,
    });
    expect(cp.players[1]!.camp).toBe(Camp.Wolf);
    expect(reads).toBe(0);
  });

for (const status of ["cancelled", "failed"] as const)
  test(`closed ${status} cannot be rewritten by repeated setup`, async () => {
    const g = fixture();
    if (status === "cancelled")
      expect(
        await setup(
          g,
          async () => choose(),
          () => false,
        ),
      ).toBe(false);
    else
      await expect(
        setup(g, async () => {
          throw new Error("strict_failure");
        }),
      ).rejects.toThrow("strict_failure");
    const before = captureCheckpoint(g.world, g.phaseManager.getSnapshot(), 0, false, 0);
    await expect(setup(g)).rejects.toThrow("lonely_girl_setup_unavailable");
    expect(projectLonelyGirlSetup(g.world)?.status).toBe(status);
    expect(captureCheckpoint(g.world, g.phaseManager.getSnapshot(), 0, false, 0)).toEqual(before);
    expect(g.events).toEqual([]);
  });
