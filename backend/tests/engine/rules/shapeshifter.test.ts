import path from "node:path";
import { promises as fs } from "node:fs";
import * as runtimeFactory from "../../../src/runtime/player_agent_factory";
import { LlmActionProvider } from "../../../src/ai/agents/llm/llm_action_provider";
import { AcpActionProvider } from "../../../src/ai/agents/acp/acp_action_provider";
import { parseRuntimeConfig } from "../../../src/runtime/config/parse_config";
import { resolveGameSetup } from "../../../src/runtime/config/resolve_game_setup";
import { runGame } from "../../../src/runtime/game_runner";
import {
  readReproduction,
  replayReproduction,
} from "../../../src/runtime/simulation/replay_reproduction";
import { createTestTempDirectory } from "../../support/temp_directory";
import { expect, spyOn, test } from "bun:test";
import { shuffled } from "../../../src/core";
import { shapeshifterScenario } from "../../support/shapeshifter_scenarios";
import { bootstrapGame } from "../../../src/app/bootstrap";
import {
  Role,
  Camp,
  Phase,
  COMPONENT,
  PotionType,
  WitchSelfHealRule,
  createRandom,
  type BoardConfig,
  type RoleComponent,
  type ActionRequest,
  type ToolCall,
  type GameEvent,
  type VictoryComponent,
  type AliveComponent,
} from "../../../src/core";
import { foxBoard } from "../../support/cursed_fox_scenarios";
import {
  ShapeshifterSetupWindow,
  projectShapeshifterChoices,
  shapeshifterRequestScope,
  inheritShapeshifterDeadlineRequest,
} from "../../../src/game/mechanisms/roles/shapeshifter/setup";
import {
  shapeshifterDeal,
  shapeshifterSetupStatus,
  shapeshifterSetupReady,
  hasActiveShapeshifterSetup,
  projectShapeshifterSetup,
  initialShapeshifterDeal,
} from "../../../src/game/mechanisms/roles/shapeshifter/deal";
import {
  readShapeshifterTool,
  getShapeshifterState,
} from "../../../src/game/mechanisms/roles/shapeshifter/state";
import { ToolGateway } from "../../../src/game/gateway/tool_gateway";
import { ActionReception } from "../../../src/ai/agents/player/action_reception";
import { PlayerPromptPolicy } from "../../../src/ai/agents/player/player_prompt_policy";
import { knownWolfTeammates } from "../../../src/game/mechanisms/roles/wolf_team";
import {
  getDefaultRoleCatalog,
  getDefaultToolSpecRegistry,
  getDefaultTargetHintRegistry,
  getDefaultPhaseStageLocalizationRegistry,
  getDefaultConfigRenderRegistry,
} from "../../../src/game/mechanisms";
import {
  getWitchState,
  getHunterState,
  getGuardState,
  getSeerState,
} from "../../../src/game/mechanisms/roles/private_state";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../src/runtime/config/board_definition";
import { buildAgentVisibleEventFeed } from "../../../src/game/engine/agent_visible_event_feed";
const original = [Role.Shapeshifter, Role.Wolf, Role.Wolf, Role.Seer, Role.Witch, Role.Hunter];
const deal = [
  Role.Shapeshifter,
  Role.Wolf,
  Role.Wolf,
  Role.Witch,
  Role.Hunter,
  Role.Villager,
  Role.Seer,
  Role.Villager,
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
const choose = (slot: 0 | 1): ToolCall => ({ name: "choose_shapeshifter_card", args: { slot } });
const actor = (g: Fixture) => g.world.getComponent<RoleComponent>(1, COMPONENT.Role)!;
const run = (
  g: Fixture,
  body: (r: ActionRequest) => Promise<ToolCall | null>,
  current = () => true,
) =>
  new ShapeshifterSetupWindow(g.world, new ToolGateway(), g.events).execute(
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
test("normal configuration remains N, Shapeshifter uses actual N+2, full fixed multiset and default policy roundtrip", () => {
  const g = fixture(),
    def = boardDefinitionFromConfig("shapeshifter_fixture", g.config);
  expect(def.board.size).toBe(6);
  expect(def.board.roleSetups.reduce((n, row) => n + row.count, 0)).toBe(6);
  expect(parseBoardDefinition(def).config.shapeshifter?.policy).toBe(
    "awa_netease_shapeshifter_two_extra_villagers_v1",
  );
  expect(g.world.entityIds()).toEqual([1, 2, 3, 4, 5, 6]);
  expect(initialShapeshifterDeal(g.world)).toEqual(deal);
  expect(projectShapeshifterSetup(g.world)?.reserve.map((card) => card.role)).toEqual([
    Role.Seer,
    Role.Villager,
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
    [Role.Shapeshifter, Role.Wolf, Role.Seer, Role.Witch, Role.Hunter, Role.Villager],
    [Role.Shapeshifter, Role.Wolf, Role.Wolf, Role.Wolf, Role.Wolf, Role.Wolf],
    [Role.Shapeshifter, Role.Wolf, Role.Wolf, Role.Seer, Role.Cupid, Role.Villager],
  ]) {
    const config = foxBoard(roles);
    expect(() => bootstrapGame(config)).toThrow();
    expect(() =>
      parseBoardDefinition(boardDefinitionFromConfig("shapeshifter_invalid", config)),
    ).toThrow();
  }
  const config = { ...foxBoard(original), winConditions: ["slaughter_side" as any] };
  expect(() => bootstrapGame(config)).toThrow("role_win_condition_not_supported");
});
test("seeded N+2 dealing does not ensure Shapeshifter or gods in play, immutable original deal survives swaps", async () => {
  let shapeshifterBottom = 0,
    seerBottom = 0;
  for (let i = 0; i < 80; i++) {
    const g = bootstrapGame(foxBoard(original), { random: createRandom(`shapeshifter-deal:${i}`) }),
      full = initialShapeshifterDeal(g.world)!;
    expect(full).toHaveLength(8);
    expect([...full].sort()).toEqual([...original, Role.Villager, Role.Villager].sort());
    if (full.slice(6).includes(Role.Shapeshifter)) shapeshifterBottom++;
    if (full.slice(6).includes(Role.Seer)) seerBottom++;
  }
  expect(shapeshifterBottom).toBeGreaterThan(0);
  expect(seerBottom).toBeGreaterThan(0);
  const g = fixture(),
    before = [...initialShapeshifterDeal(g.world)!];
  await run(g, async () => choose(0));
  expect(initialShapeshifterDeal(g.world)).toEqual(before);
  expect(actor(g).role).toBe(Role.Seer);
});
test("Shapeshifter in reserve has no actor or request and closes setup before native night", async () => {
  const g = fixture([
    Role.Wolf,
    Role.Wolf,
    Role.Seer,
    Role.Witch,
    Role.Hunter,
    Role.Villager,
    Role.Shapeshifter,
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
  expect(shapeshifterSetupReady(g.world)).toBe(true);
  expect(projectShapeshifterSetup(g.world)?.selection).toBeNull();
});
for (const slot of [0, 1] as const)
  test(`both Wolf requires slot ${slot}, installs a real Wolf and conserves physical cards`, async () => {
    const g = fixture([
      Role.Shapeshifter,
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
      expect(projectShapeshifterChoices(g.world, 1)?.mustChoose).toBe(true);
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
    const state = projectShapeshifterSetup(g.world)!;
    expect(state.hands[0]!.cardId).toBe(`deal:${6 + slot}`);
    expect(state.reserve[slot]!.cardId).toBe("deal:0");
    expect([...state.hands, ...state.reserve].map((c) => c.cardId).sort()).toEqual(
      Array.from({ length: 8 }, (_, i) => `deal:${i}`),
    );
  });
for (const action of [
  null,
  { name: "choose_shapeshifter_card", args: { slot: null } },
  { name: "choose_shapeshifter_card", args: { slot: 2 } },
  { name: "choose_shapeshifter_card", args: { slot: 0, extra: true } },
])
  test(`both Wolf missing/invalid ${JSON.stringify(action)} explicitly fails without automatic retention or swap`, async () => {
    const g = fixture([
        Role.Shapeshifter,
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
    expect(shapeshifterSetupStatus(g.world)).toBe("failed");
    expect(g.events).toEqual([]);
    expect(hasActiveShapeshifterSetup(g.world)).toBe(false);
    await expect(run(g, async () => choose(0))).rejects.toThrow("shapeshifter_setup_unavailable");
  });
for (const cards of [
  [
    Role.Shapeshifter,
    Role.Wolf,
    Role.Wolf,
    Role.Witch,
    Role.Hunter,
    Role.Villager,
    Role.Seer,
    Role.Villager,
  ],
  [
    Role.Shapeshifter,
    Role.Wolf,
    Role.Witch,
    Role.Hunter,
    Role.Villager,
    Role.Villager,
    Role.Wolf,
    Role.Seer,
  ],
  [
    Role.Shapeshifter,
    Role.Wolf,
    Role.Witch,
    Role.Hunter,
    Role.Villager,
    Role.Villager,
    Role.Seer,
    Role.Wolf,
  ],
  [
    Role.Shapeshifter,
    Role.Seer,
    Role.Witch,
    Role.Hunter,
    Role.Villager,
    Role.Villager,
    Role.Wolf,
    Role.Wolf,
  ],
])
  test(`0/1/2 Wolf mandatory slot matrix ${cards.slice(6)}`, async () => {
    const allowed =
      cards[6] === Role.Wolf
        ? cards[7] === Role.Wolf
          ? [0, 1]
          : [0]
        : cards[7] === Role.Wolf
          ? [1]
          : [0, 1];
    for (const slot of [0, 1] as const) {
      const g = fixture(cards),
        before = actor(g);
      const task = run(g, async (r) => {
        expect(r.context.turn_constraints).toMatchObject({
          min_valid_actions: 1,
          max_valid_actions: 1,
          required_any_tools: ["choose_shapeshifter_card"],
        });
        expect(projectShapeshifterChoices(g.world, 1)).toMatchObject({
          mustChoose: true,
          allowedSlots: allowed,
        });
        const receipt = new ActionReception(g.world).validate(r, "choose_shapeshifter_card", {
          slot,
        });
        expect(receipt.ok).toBe(allowed.includes(slot));
        return choose(slot);
      });
      if (allowed.includes(slot)) {
        await expect(task).resolves.toBe(true);
        expect(actor(g).role).toBe(cards[6 + slot]!);
        expect(getShapeshifterState(before)).toMatchObject({ remaining: 0, choice: slot });
      } else {
        await expect(task).rejects.toThrow("shapeshifter_choice_invalid");
        expect(actor(g)).toBe(before);
        expect(projectShapeshifterSetup(g.world)?.selection).toBeNull();
      }
    }
    const g = fixture(cards);
    await expect(run(g, async () => null)).rejects.toThrow("shapeshifter_required_choice_missing");
    expect(getShapeshifterState(actor(g))).toMatchObject({ remaining: 0, choice: null });
    expect(shapeshifterSetupStatus(g.world)).toBe("failed");
    expect(g.events).toEqual([]);
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
      actor(g).privateState = {};
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
      shapeshifterDeal(g.world)!.reserve[0] = { ...shapeshifterDeal(g.world)!.reserve[0] };
    },
  ],
  [
    "reserve role",
    (g: Fixture) => {
      shapeshifterDeal(g.world)!.reserve[0].role = Role.Villager;
    },
  ],
  [
    "reserve ID",
    (g: Fixture) => {
      shapeshifterDeal(g.world)!.reserve[0].cardId = "deal:7";
    },
  ],
  [
    "hand ref",
    (g: Fixture) => {
      shapeshifterDeal(g.world)!.hands.set(1, { ...shapeshifterDeal(g.world)!.hands.get(1)! });
    },
  ],
  [
    "policy",
    (g: Fixture) => {
      g.config.shapeshifter = { policy: "bad" as any };
    },
  ],
  [
    "resource",
    (g: Fixture) => {
      getShapeshifterState(actor(g))!.remaining = 0;
    },
  ],
  [
    "camp component",
    (g: Fixture) => {
      g.world.addComponent(1, COMPONENT.Camp, { camp: Camp.Good });
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
        expect(shapeshifterRequestScope(g.world, r)).toBeDefined();
        mutate(g);
        return choose(1);
      }),
    ).toBe(false);
    expect(g.world.getComponent<RoleComponent>(1, COMPONENT.Role)).toBe(old);
    expect(g.events).toEqual([]);
    expect(shapeshifterSetupStatus(g.world)).toBe("cancelled");
    expect(hasActiveShapeshifterSetup(g.world)).toBe(false);
  });
test("pre-request removal of Shapeshifter is revoked rather than mistaken for a bottom-card Shapeshifter", async () => {
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
  expect(shapeshifterSetupStatus(g.world)).toBe("cancelled");
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
  expect(actor(g).role).toBe(Role.Shapeshifter);
  expect(g.events).toEqual([]);
});
test("provider exception survives frozen status cleanup and final authority release", async () => {
  const g = fixture(),
    error = new TypeError("original");
  Object.defineProperty(shapeshifterDeal(g.world)!, "status", { writable: false });
  let caught: unknown;
  try {
    await run(g, async () => {
      throw error;
    });
  } catch (e) {
    caught = e;
  }
  expect(caught).toBe(error);
  expect(hasActiveShapeshifterSetup(g.world)).toBe(false);
  expect(shapeshifterSetupStatus(g.world)).toBe("failed");
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
    ).rejects.toThrow("shapeshifter_setup_reentry");
    await expect(run(g, async () => choose(0))).rejects.toThrow("shapeshifter_setup_reentry");
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
    expect(reception.validate(r1!, "choose_shapeshifter_card", { slot: 0 }).ok).toBe(false);
    expect(reception.validate(r, "choose_shapeshifter_card", { slot: 0 }).ok).toBe(true);
    return choose(1);
  });
  release();
  await pending;
  const g = fixture();
  await run(g, async (r) => {
    const reception = new ActionReception(g.world),
      bounded = { ...r, deadlineAtMs: Date.now() + 500 };
    expect(reception.validate(bounded, "choose_shapeshifter_card", { slot: 0 }).ok).toBe(false);
    inheritShapeshifterDeadlineRequest(r, bounded);
    expect(reception.validate(bounded, "choose_shapeshifter_card", { slot: 0 }).ok).toBe(true);
    const forged = { ...r, actorId: 2 };
    inheritShapeshifterDeadlineRequest(r, forged);
    expect(reception.validate(forged, "choose_shapeshifter_card", { slot: 0 }).ok).toBe(false);
    return choose(0);
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
    expect(new ActionReception(g.world).validate(r, "choose_shapeshifter_card", args).ok).toBe(
      false,
    );
    expect(
      readShapeshifterTool({
        get name() {
          gets++;
          return "choose_shapeshifter_card";
        },
        args: { slot: 0 },
      }),
    ).toBeNull();
    return choose(0);
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
        ? [Role.Shapeshifter, Role.Wolf, Role.Witch, Role.Hunter, Role.Villager, Role.Villager]
        : [Role.Shapeshifter, Role.Wolf, Role.Wolf, Role.Seer, Role.Witch, Role.Villager];
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
      expect(p.buildObservation(r).ownState.shapeshifter?.cards?.map((card) => card.role)).toEqual(
        cards.slice(6),
      );
      expect(projectShapeshifterChoices(g.world, 2)).toBeUndefined();
      expect(p.buildBoardInfo()).toContain("N+2");
      expect(compat.buildBoardInfo()).toEqual(p.buildBoardInfo());
      expect(knownWolfTeammates(g.world, 2, getDefaultRoleCatalog())).toEqual([]);
      return choose(0);
    });
    expect(actor(g).role).toBe(selected);
    expect(actor(g).privateState).not.toHaveProperty("shapeshifter");
    expect(projectShapeshifterSetup(g.world)?.status).toBe("complete");
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
    expect(own.at(-1)?.type).toBe("shapeshifter_identity_chosen");
    expect(other).toEqual([]);
  });
test("first PM cycle enables chosen Wolf before pack chat, rejects ordinary-night reentry and never judges initial zero wolves", async () => {
  const g = fixture([
    Role.Shapeshifter,
    Role.Seer,
    Role.Witch,
    Role.Hunter,
    Role.Villager,
    Role.Villager,
    Role.Wolf,
    Role.Wolf,
  ]);
  const seen: ActionRequest[] = [];
  const snapshot = await g.phaseManager.runSingleCycle({
    async getAction(r) {
      seen.push(r);
      if (r.context.stage === "shapeshifter") return choose(1);
      if (r.allowedTools.includes("speak_to_wolves")) {
        expect(actor(g).role).toBe(Role.Wolf);
        await expect(
          g.phaseManager.runSingleCycle({
            async getAction() {
              return null;
            },
          }),
        ).rejects.toThrow("shapeshifter_setup_reentry");
        return { name: "speak_to_wolves", args: { text: "End", end_chat: true } };
      }
      if (r.allowedTools.includes("kill_vote"))
        return { name: "kill_vote", args: { target_id: null, abstain: true } };
      if (r.allowedTools.includes("check_identity"))
        return { name: "check_identity", args: { target_id: 1 } };
      if (r.allowedTools.includes("use_potion"))
        return { name: "use_potion", args: { target_id: r.actorId, potion_type: PotionType.None } };
      if (r.allowedTools.includes("speak")) return { name: "speak", args: { text: "Raw" } };
      if (r.allowedTools.includes("vote"))
        return { name: "vote", args: { target_id: null, abstain: true } };
      throw new Error(`unexpected:${r.context.stage}`);
    },
  });
  expect(seen[0]?.context.stage).toBe("shapeshifter");
  expect(seen.filter((r) => r.context.stage === "shapeshifter")).toHaveLength(1);
  expect(snapshot).toMatchObject({ day: 2, phase: Phase.Voting, gameOver: false });
});

test("completed stock projection rejects swapped original owner cards and swapped reserve slots", async () => {
  for (const where of ["hands", "reserve"] as const) {
    const g = fixture();
    await run(g, async () => choose(1));
    expect(projectShapeshifterSetup(g.world)).toBeDefined();
    const d = shapeshifterDeal(g.world)!;
    if (where === "hands") {
      const a = d.hands.get(2)!,
        b = d.hands.get(3)!;
      d.hands.set(2, b);
      d.hands.set(3, a);
    } else [d.reserve[0], d.reserve[1]] = [d.reserve[1], d.reserve[0]];
    expect(projectShapeshifterSetup(g.world)).toBeUndefined();
    expect(initialShapeshifterDeal(g.world)).toEqual(deal);
  }
});
test("ordinary N-card deal preserves prior seeded RNG path and has no Shapeshifter stock", () => {
  const config = foxBoard([
      Role.Wolf,
      Role.Wolf,
      Role.Seer,
      Role.Witch,
      Role.Hunter,
      Role.Villager,
    ]),
    g = bootstrapGame(config, { random: createRandom("legacy-shapeshifter-absent") });
  const expected = shuffled(
    [Role.Wolf, Role.Wolf, Role.Seer, Role.Witch, Role.Hunter, Role.Villager],
    createRandom("legacy-shapeshifter-absent").fork("deal"),
  );
  expect(
    g.playerIds.map((id) => g.world.getComponent<RoleComponent>(id, COMPONENT.Role)!.role),
  ).toEqual(expected);
  expect(initialShapeshifterDeal(g.world)).toBeUndefined();
  expect(projectShapeshifterSetup(g.world)).toBeUndefined();
});
test("real Day/Voting recursive PM is rejected before phase/event mutation; later actual night never reopens choice", async () => {
  const scenario = shapeshifterScenario("seer"),
    g = bootstrapGame(scenario.board.config, { fixedRoles: scenario.initialDeal }),
    queues = new Map([...scenario.turns].map(([id, turns]) => [id, [...turns]]));
  let blocked = 0;
  const snapshot = await g.phaseManager.runUntilGameOver(
    {
      async getAction(r) {
        const next = queues.get(r.actorId)!.shift()!;
        expect(next.stage).toBe(r.context.stage);
        expect(next.day).toBe(r.context.day);
        if (["day_speech", "voting"].includes(r.context.stage)) {
          const before = g.phaseManager.getSnapshot(),
            length = g.phaseManager.getEvents().length;
          await expect(
            g.phaseManager.runSingleCycle({
              async getAction() {
                throw new Error("unexpected_reentrant_request");
              },
            }),
          ).rejects.toThrow("shapeshifter_cycle_reentry_after_night");
          expect(g.phaseManager.getSnapshot()).toEqual(before);
          expect(g.phaseManager.getEvents()).toHaveLength(length);
          blocked++;
        }
        return next.action;
      },
    },
    10,
  );
  expect(snapshot.gameOver).toBe(true);
  expect(blocked).toBeGreaterThan(0);
  expect([...queues.values()].every((q) => q.length === 0)).toBe(true);
  expect(
    g.phaseManager.getEvents().filter((e) => e.type === "shapeshifter_identity_chosen"),
  ).toHaveLength(1);
});

for (const transport of ["sdk", "acp"] as const)
  for (const locale of ["zh-CN", "en"] as const)
    for (const failure of ["invalid", "missing"] as const)
      test(`${transport}/${locale}/${failure}: real strict provider failure closes Shapeshifter without fallback or card swap, exact partial Tape`, async () => {
        const scenario = shapeshifterScenario("both0", 6, locale),
          root = await createTestTempDirectory("awa-shapeshifter-failure-"),
          output = await createTestTempDirectory("awa-shapeshifter-failure-replay-");
        const runtime = parseRuntimeConfig({
          providers: {
            default: "synthetic",
            items: { synthetic: { type: "openai", apiKey: "synthetic-only" } },
          },
          agents: {
            default: "synthetic",
            items: { synthetic: { kind: "llm", provider: "synthetic", model: "synthetic" } },
          },
          game: { board: scenario.board.definition.id, seed: scenario.seed, locale },
          debugSummary: { agent: { enabled: false } },
        });
        const setup = resolveGameSetup(
          runtime,
          {
            recordRootDir: root,
            maxDays: 8,
            maxRuntimeMs: 10000,
            streamEvents: false,
            printThinking: false,
            color: false,
          },
          scenario.board,
        );
        let fallbackCalls = 0,
          nativeCalls = 0;
        const create = spyOn(runtimeFactory, "createPlayerAgentRuntime").mockImplementation(
          async (options) => {
            const fallbackProvider = {
                async getAction() {
                  fallbackCalls++;
                  return null;
                },
              },
              client: any = {
                async chat() {
                  throw new Error("unexpected_chat");
                },
                async runToolLoop(_m: any, _t: any, callbacks: any) {
                  if (failure === "invalid")
                    for (let i = 0; i < 3; i++)
                      await callbacks.onToolCall({
                        name: "submit_action",
                        args: {
                          turn_id: "t1",
                          action: "choose_shapeshifter_card",
                          arguments: { slot: 2 },
                        },
                      });
                  return { finalAction: null, assistantText: "End" };
                },
              };
            const provider =
              transport === "sdk"
                ? new LlmActionProvider(options.world, client, {
                    boardConfig: options.boardConfig,
                    fallbackProvider,
                  })
                : new AcpActionProvider(options.world, {
                    boardConfig: options.boardConfig,
                    fallbackProvider,
                    sessionFactory: {
                      async createSession(input) {
                        return {
                          sessionId: "shapeshifter-failure",
                          async prompt() {
                            if (failure === "invalid")
                              for (let i = 0; i < 3; i++)
                                input.registry.submitAction("shapeshifter-failure", {
                                  turn_id: "t1",
                                  action: "choose_shapeshifter_card",
                                  arguments: { slot: 2 },
                                });
                          },
                          async cancel() {},
                          async close() {},
                        };
                      },
                    },
                  });
            let closed = false;
            return {
              kind: transport === "sdk" ? "llm" : "acp",
              provider: {
                getAction(r) {
                  if (r.context.stage !== "shapeshifter") {
                    nativeCalls++;
                    throw new Error("native_before_failed_setup");
                  }
                  return provider.getAction(r);
                },
              },
              get runtimeState() {
                return { closed };
              },
              async close() {
                closed = true;
                await provider.close();
              },
            };
          },
        );
        try {
          await expect(runGame(setup)).rejects.toThrow();
          expect(fallbackCalls).toBe(0);
          expect(nativeCalls).toBe(0);
          const directory = path.join(
              root,
              (await fs.readdir(root)).find((n) => n.startsWith("session_"))!,
            ),
            record = await readReproduction(path.join(directory, "reproduction.json")),
            decision = record.decisions.find((d) => d.stage === "shapeshifter")!;
          expect(decision.request.context.turn_constraints.min_valid_actions).toBe(1);
          expect(decision.request.context.allow_fallback).toBe(false);
          expect(decision.outcome).toMatchObject({ kind: "error", code: "decision_failed" });
          expect(record.checkpoints.at(-1)!.complete).toBe(false);
          expect(record.checkpoints.at(-1)!.shapeshifterSetup).toMatchObject({
            status: "failed",
            selection: null,
          });
          expect(record.checkpoints.at(-1)!.shapeshifterSetup!.hands).toEqual(
            record.checkpoints[0]!.shapeshifterSetup!.hands,
          );
          expect(record.checkpoints.at(-1)!.shapeshifterSetup!.reserve).toEqual(
            record.checkpoints[0]!.shapeshifterSetup!.reserve,
          );
          expect(record.events.some((e) => e.type === "shapeshifter_identity_chosen")).toBe(false);
          expect((await replayReproduction(record, output)).snapshot).toEqual(
            record.checkpoints.at(-1)!.snapshot,
          );
          if (failure === "invalid") {
            const view = await fs.readFile(
              path.join(directory, `players/player_${scenario.actorId}.json`),
              "utf8",
            );
            expect(view).toContain("turn_invalid_action_limit");
            expect(view).not.toContain("transport_error");
          }
        } finally {
          create.mockRestore();
        }
      }, 10000);

test("public six/twelve Shapeshifter examples roundtrip N role parameters and execute actual N+2 initialization", async () => {
  for (const size of [6, 12]) {
    const raw = JSON.parse(
        await fs.readFile(
          path.resolve(
            process.cwd(),
            `../configs.example/boards/awa_netease_shapeshifter_${size}_v1.json`,
          ),
          "utf8",
        ),
      ),
      resolved = parseBoardDefinition(raw),
      g = bootstrapGame(resolved.config, { random: createRandom(`shapeshifter-example:${size}`) });
    expect(resolved.config.boardSize).toBe(size);
    expect(resolved.config.roleSetups.reduce((n, row) => n + row.count, 0)).toBe(size);
    expect(resolved.config.shapeshifter?.policy).toBe(
      "awa_netease_shapeshifter_two_extra_villagers_v1",
    );
    expect(g.playerIds).toHaveLength(size);
    expect(initialShapeshifterDeal(g.world)).toHaveLength(size + 2);
  }
});
