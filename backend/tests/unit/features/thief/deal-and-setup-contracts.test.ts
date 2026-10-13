/**
 * Unit tests for thief setup. Inputs are original N+2 deals, reserve card/lease mutations and strict
 * provider failure tapes. Original literal receipts, reference/getter/error traces, facts and expected
 * state remain the oracle. Original deal/config/multiset and bounded setup window/capability/stock
 * projections. Case11 only invokes blocked PM entry inside active setup; no completed cycle occurs. No
 * complete game phase or paid model runs; existing local windows and denied entry probes remain bounded.
 */
import { expect, test } from "bun:test";
import { shuffled } from "../../../../src/core";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { Role, Camp, COMPONENT, WitchSelfHealRule, createRandom, type BoardConfig, type RoleComponent, type ActionRequest, type ToolCall, type GameEvent, type VictoryComponent, type AliveComponent } from "../../../../src/core";
import { foxBoard } from "../../../support/cursed_fox_scenarios";
import {
  ThiefSetupWindow,
  projectThiefChoices,
  thiefRequestScope,
  inheritThiefDeadlineRequest,
} from "../../../../src/game/mechanisms/roles/thief/setup";
import {
  thiefDeal,
  thiefSetupStatus,
  thiefSetupReady,
  hasActiveThiefSetup,
  projectThiefSetup,
  initialThiefDeal,
} from "../../../../src/game/mechanisms/roles/thief/deal";
import { readThiefTool, getThiefState } from "../../../../src/game/mechanisms/roles/thief/state";
import { ToolGateway } from "../../../../src/game/gateway/tool_gateway";
import { ActionReception } from "../../../../src/ai/agents/player/action_reception";
import { PlayerPromptPolicy } from "../../../../src/ai/agents/player/player_prompt_policy";
import { knownWolfTeammates } from "../../../../src/game/mechanisms/roles/wolf_team";
import {
  getDefaultRoleCatalog,
  getDefaultToolSpecRegistry,
  getDefaultTargetHintRegistry,
  getDefaultPhaseStageLocalizationRegistry,
  getDefaultConfigRenderRegistry,
} from "../../../../src/game/mechanisms";
import {
  getWitchState,
  getHunterState,
  getGuardState,
  getSeerState,
} from "../../../../src/game/mechanisms/roles/private_state";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../../src/runtime/config/board_definition";
import { buildAgentVisibleEventFeed } from "../../../../src/game/engine/agent_visible_event_feed";

const original = [Role.Thief, Role.Wolf, Role.Wolf, Role.Seer, Role.Witch, Role.Hunter];

const deal = [
  Role.Thief,
  Role.Wolf,
  Role.Witch,
  Role.Hunter,
  Role.Villager,
  Role.Villager,
  Role.Wolf,
  Role.Seer,
];

function fixture(cards = deal, extra: Partial<BoardConfig> = {}) {
  const roles = [...cards];
  for (let i = 0; i < 2; i++) {
    const index = roles.indexOf(Role.Villager);
    if (index < 0) throw new Error("fixture_missing_extra_villagers");
    roles.splice(index, 1);
  }
  const config = { ...foxBoard(roles), ...extra };
  return { ...bootstrapGame(config, { fixedRoles: cards }), config, events: [] as GameEvent[] };
}

type Fixture = ReturnType<typeof fixture>;

const choose = (slot: 0 | 1): ToolCall => ({ name: "choose_thief_card", args: { slot } });

const actor = (g: Fixture) => g.world.getComponent<RoleComponent>(1, COMPONENT.Role)!;

const run = (
  g: Fixture,
  body: (r: ActionRequest) => Promise<ToolCall | null>,
  current = () => true,
) =>
  new ThiefSetupWindow(g.world, new ToolGateway(), g.events).execute(
    g.config,
    { getAction: body },
    1,
    current,
  );

function policy(g: Fixture, withConfig = true) {
  return new PlayerPromptPolicy(g.world, {
    roleCatalog: getDefaultRoleCatalog(),
    toolSpecRegistry: getDefaultToolSpecRegistry(),
    targetHintRegistry: getDefaultTargetHintRegistry(),
    phaseStageLocalizationRegistry: getDefaultPhaseStageLocalizationRegistry(),
    configRenderRegistry: getDefaultConfigRenderRegistry(),
    ...(withConfig ? { boardConfig: g.config } : {}),
  });
}

test("normal configuration remains N, Thief uses actual N+2, full fixed multiset and default policy roundtrip", () => {
  const g = fixture(),
    def = boardDefinitionFromConfig("thief_fixture", g.config);
  expect(def.board.size).toBe(6);
  expect(def.board.roleSetups.reduce((n, row) => n + row.count, 0)).toBe(6);
  expect(parseBoardDefinition(def).config.thief?.policy).toBe(
    "lui_meme_thief_two_extra_villagers_v1",
  );
  expect(g.world.entityIds()).toEqual([1, 2, 3, 4, 5, 6]);
  expect(initialThiefDeal(g.world)).toEqual(deal);
  expect(projectThiefSetup(g.world)?.reserve.map((card) => card.role)).toEqual([
    Role.Wolf,
    Role.Seer,
  ]);
  expect(() => bootstrapGame(g.config, { fixedRoles: deal.slice(0, 6) })).toThrow(
    "fixed_role_deck_mismatch",
  );
  expect(() => bootstrapGame(g.config, { fixedRoles: [...deal.slice(0, 7), Role.Wolf] })).toThrow(
    "fixed_role_deck_mismatch",
  );
});

test("finite City/basic restriction and engineering faction lower bounds are enforced at both entrances", () => {
  for (const roles of [
    [Role.Thief, Role.Wolf, Role.Seer, Role.Witch, Role.Hunter, Role.Villager],
    [Role.Thief, Role.Wolf, Role.Wolf, Role.Wolf, Role.Wolf, Role.Villager],
    [Role.Thief, Role.Wolf, Role.Wolf, Role.Seer, Role.Cupid, Role.Villager],
  ]) {
    const config = foxBoard(roles);
    expect(() => bootstrapGame(config)).toThrow();
    expect(() =>
      parseBoardDefinition(boardDefinitionFromConfig("thief_invalid", config)),
    ).toThrow();
  }
  const config = { ...foxBoard(original), winConditions: ["slaughter_side" as any] };
  expect(() => bootstrapGame(config)).toThrow("role_win_condition_not_supported");
});

test("seeded N+2 dealing does not ensure Thief or gods in play, immutable original deal survives swaps", async () => {
  let thiefBottom = 0,
    seerBottom = 0;
  for (let i = 0; i < 80; i++) {
    const g = bootstrapGame(foxBoard(original), { random: createRandom(`thief-deal:${i}`) }),
      full = initialThiefDeal(g.world)!;
    expect(full).toHaveLength(8);
    expect([...full].sort()).toEqual([...original, Role.Villager, Role.Villager].sort());
    if (full.slice(6).includes(Role.Thief)) thiefBottom++;
    if (full.slice(6).includes(Role.Seer)) seerBottom++;
  }
  expect(thiefBottom).toBeGreaterThan(0);
  expect(seerBottom).toBeGreaterThan(0);
  const g = fixture(),
    before = [...initialThiefDeal(g.world)!];
  await run(g, async () => choose(1));
  expect(initialThiefDeal(g.world)).toEqual(before);
  expect(actor(g).role).toBe(Role.Seer);
});

test("Thief in reserve has no actor or request and closes setup before native night", async () => {
  const g = fixture([
    Role.Wolf,
    Role.Wolf,
    Role.Seer,
    Role.Witch,
    Role.Hunter,
    Role.Villager,
    Role.Thief,
    Role.Villager,
  ]);
  let calls = 0;
  expect(
    await run(g, async () => {
      calls++;
      return null;
    }),
  ).toBe(true);
  expect(calls).toBe(0);
  expect(thiefSetupReady(g.world)).toBe(true);
  expect(projectThiefSetup(g.world)?.selection).toBeNull();
});

for (const slot of [0, 1] as const)
  test(`both Wolf requires slot ${slot}, installs a real Wolf and conserves physical cards`, async () => {
    const g = fixture([
      Role.Thief,
      Role.Seer,
      Role.Witch,
      Role.Hunter,
      Role.Villager,
      Role.Villager,
      Role.Wolf,
      Role.Wolf,
    ]);
    const refs = [COMPONENT.Identity, COMPONENT.Alive, COMPONENT.Badge, COMPONENT.VotingRight].map(
      (name) => g.world.getComponent(1, name),
    );
    expect(knownWolfTeammates(g.world, 1, getDefaultRoleCatalog())).toEqual([]);
    await run(g, async (request) => {
      expect(request.context.turn_constraints.min_valid_actions).toBe(1);
      expect(request.context.allow_fallback).toBe(false);
      expect(projectThiefChoices(g.world, 1)?.required).toBe(true);
      return choose(slot);
    });
    expect(actor(g).role).toBe(Role.Wolf);
    expect(actor(g).camp).toBe(Camp.Wolf);
    expect(g.world.getComponent<{ camp: Camp }>(1, COMPONENT.Camp)?.camp).toBe(Camp.Wolf);
    expect(g.world.getComponent<VictoryComponent>(1, COMPONENT.Victory)).toEqual({
      affiliations: [{ kind: "faction", faction: Camp.Wolf }],
    });
    expect(
      [COMPONENT.Identity, COMPONENT.Alive, COMPONENT.Badge, COMPONENT.VotingRight].map((name) =>
        g.world.getComponent(1, name),
      ),
    ).toEqual(refs);
    const state = projectThiefSetup(g.world)!;
    expect(state.hands[0]!.cardId).toBe(`deal:${6 + slot}`);
    expect(state.reserve[slot]!.cardId).toBe("deal:0");
    expect([...state.hands, ...state.reserve].map((c) => c.cardId).sort()).toEqual(
      Array.from({ length: 8 }, (_, i) => `deal:${i}`),
    );
  });

for (const action of [
  null,
  { name: "choose_thief_card", args: { slot: null } },
  { name: "choose_thief_card", args: { slot: 2 } },
  { name: "choose_thief_card", args: { slot: 0, extra: true } },
])
  test(`both Wolf missing/invalid ${JSON.stringify(action)} explicitly fails without automatic retention or swap`, async () => {
    const g = fixture([
        Role.Thief,
        Role.Seer,
        Role.Witch,
        Role.Hunter,
        Role.Villager,
        Role.Villager,
        Role.Wolf,
        Role.Wolf,
      ]),
      before = actor(g);
    await expect(run(g, async () => action as ToolCall | null)).rejects.toThrow();
    expect(actor(g)).toBe(before);
    expect(thiefSetupStatus(g.world)).toBe("failed");
    expect(g.events).toEqual([]);
    expect(hasActiveThiefSetup(g.world)).toBe(false);
    await expect(run(g, async () => choose(0))).rejects.toThrow("thief_setup_unavailable");
  });

test("one Wolf permits clean retention, once closes without creating a skill", async () => {
  const g = fixture(),
    before = actor(g);
  expect(
    await run(g, async (r) => {
      expect(r.context.turn_constraints.min_valid_actions).toBe(0);
      return null;
    }),
  ).toBe(true);
  expect(actor(g)).toBe(before);
  expect(actor(g).role).toBe(Role.Thief);
  expect(getThiefState(actor(g))?.remaining).toBe(0);
  expect(projectThiefSetup(g.world)?.selection).toEqual({
    actorId: 1,
    slot: null,
    role: Role.Thief,
  });
  let calls = 0;
  expect(
    await run(g, async () => {
      calls++;
      return choose(0);
    }),
  ).toBe(true);
  expect(calls).toBe(0);
});

for (const [label, mutate] of [
  [
    "death",
    (g: Fixture) => {
      g.world.getComponent<AliveComponent>(1, COMPONENT.Alive)!.alive = false;
    },
  ],
  [
    "revive",
    (g: Fixture) => {
      const l = g.world.getComponent<AliveComponent>(1, COMPONENT.Alive)!;
      l.alive = false;
      l.alive = true;
    },
  ],
  [
    "role",
    (g: Fixture) => {
      actor(g).role = Role.Villager;
    },
  ],
  [
    "camp",
    (g: Fixture) => {
      actor(g).camp = Camp.Wolf;
    },
  ],
  [
    "state",
    (g: Fixture) => {
      (actor(g) as { privateState: Readonly<Record<string, unknown>> }).privateState = {};
    },
  ],
  [
    "other role",
    (g: Fixture) => {
      g.world.getComponent<RoleComponent>(2, COMPONENT.Role)!.role = Role.Villager;
    },
  ],
  [
    "other death",
    (g: Fixture) => {
      g.world.getComponent<AliveComponent>(2, COMPONENT.Alive)!.alive = false;
    },
  ],
  [
    "reserve ref",
    (g: Fixture) => {
      thiefDeal(g.world)!.reserve[0] = { ...thiefDeal(g.world)!.reserve[0] };
    },
  ],
  [
    "reserve role",
    (g: Fixture) => {
      thiefDeal(g.world)!.reserve[0].role = Role.Villager;
    },
  ],
  [
    "reserve ID",
    (g: Fixture) => {
      thiefDeal(g.world)!.reserve[0].cardId = "deal:7";
    },
  ],
  [
    "hand ref",
    (g: Fixture) => {
      thiefDeal(g.world)!.hands.set(1, { ...thiefDeal(g.world)!.hands.get(1)! });
    },
  ],
  [
    "policy",
    (g: Fixture) => {
      g.config.thief = { policy: "bad" as any };
    },
  ],
  [
    "resource",
    (g: Fixture) => {
      getThiefState(actor(g))!.remaining = 0;
    },
  ],
  [
    "camp component",
    (g: Fixture) => {
      g.world.addComponent<unknown>(1, COMPONENT.Camp, { camp: Camp.Good });
    },
  ],
  [
    "victory component",
    (g: Fixture) => {
      g.world.addComponent(1, COMPONENT.Victory, {
        affiliations: [{ kind: "faction", faction: Camp.Good }],
      });
    },
  ],
] as const)
  test(`late ${label} withdrawal causes no swap, closes once and forbids old authority`, async () => {
    const g = fixture(),
      old = actor(g);
    expect(
      await run(g, async (r) => {
        expect(thiefRequestScope(g.world, r)).toBeDefined();
        mutate(g);
        return choose(1);
      }),
    ).toBe(false);
    expect(g.world.getComponent<RoleComponent>(1, COMPONENT.Role)).toBe(old);
    expect(g.events).toEqual([]);
    expect(thiefSetupStatus(g.world)).toBe("cancelled");
    expect(hasActiveThiefSetup(g.world)).toBe(false);
  });

test("pre-request removal of Thief is revoked rather than mistaken for a bottom-card Thief", async () => {
  const g = fixture();
  actor(g).role = Role.Villager;
  let calls = 0;
  expect(
    await run(g, async () => {
      calls++;
      return null;
    }),
  ).toBe(false);
  expect(calls).toBe(0);
  expect(thiefSetupStatus(g.world)).toBe("cancelled");
});

test("phase withdrawal after await produces no change or late private fact", async () => {
  const g = fixture();
  let current = true;
  expect(
    await run(
      g,
      async () => {
        current = false;
        return choose(0);
      },
      () => current,
    ),
  ).toBe(false);
  expect(actor(g).role).toBe(Role.Thief);
  expect(g.events).toEqual([]);
});

test("provider exception survives frozen status cleanup and final authority release", async () => {
  const g = fixture(),
    error = new TypeError("original");
  Object.defineProperty(thiefDeal(g.world)!, "status", { writable: false });
  let caught: unknown;
  try {
    await run(g, async () => {
      throw error;
    });
  } catch (e) {
    caught = e;
  }
  expect(caught).toBe(error);
  expect(hasActiveThiefSetup(g.world)).toBe(false);
  expect(thiefSetupStatus(g.world)).toBe("failed");
  expect(g.events).toEqual([]);
});

test("pending NightPipeline and reentrant PhaseManager/Window cannot bypass setup", async () => {
  const g = fixture();
  await run(g, async () => {
    await expect(
      g.phaseManager.runSingleCycle({
        async getAction() {
          return null;
        },
      }),
    ).rejects.toThrow("thief_setup_reentry");
    await expect(run(g, async () => choose(0))).rejects.toThrow("thief_setup_reentry");
    return choose(0);
  });
});

test("factory request capability is World-bound and survives only deadline-only derivation", async () => {
  const first = fixture(),
    second = fixture();
  let release: () => void = () => {},
    r1: ActionRequest | undefined;
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  const pending = run(first, async (r) => {
    r1 = r;
    await wait;
    return choose(0);
  });
  await run(second, async (r) => {
    const reception = new ActionReception(second.world);
    expect(reception.validate(r1!, "choose_thief_card", { slot: 0 }).ok).toBe(false);
    expect(reception.validate(r, "choose_thief_card", { slot: 0 }).ok).toBe(true);
    return choose(1);
  });
  release();
  await pending;
  const g = fixture();
  await run(g, async (r) => {
    const reception = new ActionReception(g.world),
      bounded = { ...r, deadlineAtMs: Date.now() + 500 };
    expect(reception.validate(bounded, "choose_thief_card", { slot: 0 }).ok).toBe(false);
    inheritThiefDeadlineRequest(r, bounded);
    expect(reception.validate(bounded, "choose_thief_card", { slot: 0 }).ok).toBe(true);
    const forged = { ...r, actorId: 2 };
    inheritThiefDeadlineRequest(r, forged);
    expect(reception.validate(forged, "choose_thief_card", { slot: 0 }).ok).toBe(false);
    return null;
  });
});

test("malformed tool/args getters are never invoked by engine or actual reception", async () => {
  const g = fixture();
  let gets = 0;
  await run(g, async (r) => {
    const args = {
      get slot() {
        gets++;
        return 0;
      },
    };
    expect(new ActionReception(g.world).validate(r, "choose_thief_card", args).ok).toBe(false);
    expect(
      readThiefTool({
        get name() {
          gets++;
          return "choose_thief_card";
        },
        args: { slot: 0 },
      }),
    ).toBeNull();
    return null;
  });
  expect(gets).toBe(0);
});

for (const selected of [
  Role.Wolf,
  Role.Seer,
  Role.Witch,
  Role.Hunter,
  Role.Guard,
  Role.Idiot,
  Role.Villager,
])
  test(`native ${selected} swaps atomically with complete configured stock; own choices only and public candidate counts`, async () => {
    const others =
      selected === Role.Wolf
        ? [Role.Thief, Role.Wolf, Role.Witch, Role.Hunter, Role.Villager, Role.Villager]
        : [Role.Thief, Role.Wolf, Role.Wolf, Role.Seer, Role.Witch, Role.Villager];
    if (selected === Role.Seer) others[3] = Role.Hunter;
    if (selected === Role.Witch) others[4] = Role.Hunter;
    const cards = [...others, selected, selected === Role.Wolf ? Role.Seer : Role.Villager],
      g = fixture(cards, {
        witch: { canSelfHeal: WitchSelfHealRule.Always },
        guard: { repeatPolicy: "netease_consecutive_nights_v1" },
        hunter: { deathActionPolicy: "awa_knife_or_exile_v1" },
        seer: { targetPolicy: "awa_fresh_others_v1", actionPolicy: "awa_optional_v1" },
      }),
      p = policy(g),
      compat = policy(g, false);
    await run(g, async (r) => {
      expect(p.buildObservation(r).ownState.thief?.cards?.map((card) => card.role)).toEqual(
        cards.slice(6),
      );
      expect(projectThiefChoices(g.world, 2)).toBeUndefined();
      expect(p.buildBoardInfo()).toContain("N+2");
      expect(compat.buildBoardInfo()).toEqual(p.buildBoardInfo());
      expect(knownWolfTeammates(g.world, 2, getDefaultRoleCatalog())).toEqual([]);
      return choose(0);
    });
    expect(actor(g).role).toBe(selected);
    expect(actor(g).privateState).not.toHaveProperty("thief");
    expect(projectThiefSetup(g.world)?.status).toBe("complete");
    if (selected === Role.Witch)
      expect(getWitchState(actor(g))).toMatchObject({
        heal: 1,
        poison: 1,
        canSelfHeal: true,
        selfHealRule: WitchSelfHealRule.Always,
      });
    if (selected === Role.Hunter)
      expect(getHunterState(actor(g))).toMatchObject({
        canShoot: true,
        deathActionPolicy: "awa_knife_or_exile_v1",
      });
    if (selected === Role.Guard)
      expect(getGuardState(actor(g))).toMatchObject({
        lastTarget: null,
        repeatPolicy: "netease_consecutive_nights_v1",
      });
    if (selected === Role.Seer)
      expect(getSeerState(actor(g))).toMatchObject({
        history: [],
        targetPolicy: "awa_fresh_others_v1",
        actionPolicy: "awa_optional_v1",
      });
    if (selected === Role.Wolf)
      expect(knownWolfTeammates(g.world, 1, getDefaultRoleCatalog())).toEqual([2]);
    const own = buildAgentVisibleEventFeed(g.world, g.events, 1),
      other = buildAgentVisibleEventFeed(g.world, g.events, 2);
    expect(own.at(-1)?.type).toBe("thief_identity_chosen");
    expect(other).toEqual([]);
  });

test("completed stock projection rejects swapped original owner cards and swapped reserve slots", async () => {
  for (const where of ["hands", "reserve"] as const) {
    const g = fixture();
    await run(g, async () => choose(1));
    expect(projectThiefSetup(g.world)).toBeDefined();
    const d = thiefDeal(g.world)!;
    if (where === "hands") {
      const a = d.hands.get(2)!,
        b = d.hands.get(3)!;
      d.hands.set(2, b);
      d.hands.set(3, a);
    } else [d.reserve[0], d.reserve[1]] = [d.reserve[1], d.reserve[0]];
    expect(projectThiefSetup(g.world)).toBeUndefined();
    expect(initialThiefDeal(g.world)).toEqual(deal);
  }
});

test("ordinary N-card deal preserves prior seeded RNG path and has no Thief stock", () => {
  const config = foxBoard([
      Role.Wolf,
      Role.Wolf,
      Role.Seer,
      Role.Witch,
      Role.Hunter,
      Role.Villager,
    ]),
    g = bootstrapGame(config, { random: createRandom("legacy-thief-absent") });
  const expected = shuffled(
    [Role.Wolf, Role.Wolf, Role.Seer, Role.Witch, Role.Hunter, Role.Villager],
    createRandom("legacy-thief-absent").fork("deal"),
  );
  expect(
    g.playerIds.map((id) => g.world.getComponent<RoleComponent>(id, COMPONENT.Role)!.role),
  ).toEqual(expected);
  expect(initialThiefDeal(g.world)).toBeUndefined();
  expect(projectThiefSetup(g.world)).toBeUndefined();
});
