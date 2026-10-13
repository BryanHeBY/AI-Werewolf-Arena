/**
 * Tests verify Cupid setup, lover membership and actual death/game interactions.
 * Inputs are original finite boards, mandatory-choice replies and deliberately
 * replaced private records. Literal affiliation, privacy, checkpoint and rejection
 * assertions remain the oracle; fixture writes retain their original targets and
 * use explicit test-only container access without widening production read rights.
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import {
  Camp,
  COMPONENT,
  DeathCause,
  Phase,
  Role,
  WinCondition,
  createAliveComponent,
  createVictoryComponent,
  type RoleComponent,
  type VictoryComponent,
  type AliveComponent,
  type GameEvent,
  type ActionRequest,
  type ToolCall,
  type RuntimeSnapshot,
} from "../../../src/core";
import { foxBoard } from "../../support/cursed_fox_scenarios";
import { CUPID_STAGE } from "../../../src/game/mechanisms/roles/cupid/night_stage";
import { getCupidState, projectCupidState } from "../../../src/game/mechanisms/roles/cupid/state";
import {
  loversRecord,
  projectLover,
  livingOriginalLovers,
  hasCupidNightCommit,
} from "../../../src/game/mechanisms/roles/cupid/relation";
import { cupidCityDecision } from "../../../src/game/mechanisms/roles/cupid/victory";
import { nightStageContext } from "../night_stage_fixture";
import { GameActionRequestFactory } from "../../../src/game/engine/action_request_factory";
import { buildAgentVisibleEventFeed } from "../../../src/game/engine/agent_visible_event_feed";
import { ToolGateway } from "../../../src/game/gateway/tool_gateway";
import { DeathResolution } from "../../../src/game/engine/death_resolution";
import { EventRegistry } from "../../../src/game/engine/event_registry";
import { DreamNightFrame } from "../../../src/game/mechanisms/roles/dreamer/night_frame";
import { aliveLifeVersion } from "../../../src/core/domain/components/alive";
import { permitsCharm, bindCharm } from "../../../src/game/mechanisms/roles/wolf_beauty/relation";
import { getWolfBeautyState } from "../../../src/game/mechanisms/roles/private_state";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../src/runtime/config/board_definition";
import { getDefaultRoleCatalog } from "../../../src/game/mechanisms/roles/catalog";
import { knownWolfTeammates, wolfKnifeHolders } from "../../../src/game/mechanisms/roles/wolf_team";
import { resolveInspection } from "../../../src/game/mechanisms/roles/inspection";
import { captureCheckpoint } from "../../../src/runtime/simulation/reproduction_context";
import { cupidEventLabel, readCupidEventFact, text } from "@ai-werewolf-arena/game-text";
const deck = [Role.Cupid, Role.Hunter, Role.Wolf, Role.Villager, Role.Wolf, Role.Villager];
type CupidPolicy = import("../../../src/core/domain/board").CupidPolicy;
const fixture = (roles = deck, policy: CupidPolicy = "netease_2017_cupid_follows_lovers_v1") => {
  const config = { ...foxBoard(roles), cupid: { policy } };
  return { ...bootstrapGame(config, { fixedRoles: roles }), config };
};
const role = (game: ReturnType<typeof fixture>, id: number) =>
  game.world.getComponent<RoleComponent>(id, COMPONENT.Role)!;
const life = (game: ReturnType<typeof fixture>, id: number) =>
  game.world.getComponent<AliveComponent>(id, COMPONENT.Alive)!;
const choose = (a: number, b: number): ToolCall => ({
  name: "choose_lovers",
  args: { first_id: a, second_id: b },
});
function context(
  game: ReturnType<typeof fixture>,
  events: GameEvent[],
  getAction: (request: ActionRequest) => Promise<ToolCall | null>,
  isCurrent = () => true,
) {
  const factory = new GameActionRequestFactory(game.world, events, 1);
  return nightStageContext({
    world: game.world,
    events,
    isCurrent,
    getAliveByRole: (r) => game.world.getAliveEntityIds().filter((id) => role(game, id).role === r),
    actionProvider: { getAction },
    makeRequest: (actorId, tools, extras) =>
      factory.create({
        actorId,
        allowedTools: tools,
        phase: Phase.Night,
        stage: extras.stage,
        requiresAction: extras.requiresAction ?? true,
        summary: "Offline",
        context: extras,
      }),
  });
}
async function connect(
  game: ReturnType<typeof fixture>,
  a: number,
  b: number,
  events: GameEvent[] = [],
) {
  await CUPID_STAGE.execute(context(game, events, async () => choose(a, b)));
  return events;
}
const snapshot = (): RuntimeSnapshot => ({
  day: 1,
  phase: Phase.Day,
  gameOver: false,
  result: null,
});
function resolver(game: ReturnType<typeof fixture>, events: GameEvent[]) {
  return new DeathResolution(
    game.world,
    events,
    new ToolGateway(),
    new EventRegistry(),
    snapshot(),
    game.config,
  );
}

test("source schema, normalized reverse config, counts and finite goals are strict at both entrypoints", () => {
  const game = fixture(),
    definition = boardDefinitionFromConfig("cupid", game.config);
  expect(parseBoardDefinition(definition).config.cupid).toEqual(game.config.cupid);
  expect(
    getDefaultRoleCatalog()
      .require(Role.Cupid)
      .configuration!.schema.safeParse({ policy: "arbitrary" }).success,
  ).toBe(false);
  for (const goal of [WinCondition.SlaughterSide, WinCondition.WolfReachHalf]) {
    const board = { ...game.config, winConditions: [goal] };
    expect(() => bootstrapGame(board)).toThrow("role_win_condition_not_supported");
    expect(() => parseBoardDefinition(boardDefinitionFromConfig("bad", board))).toThrow(
      "board_config_role_win_condition_not_supported",
    );
  }
  expect(() => fixture([Role.Cupid, Role.Cupid, Role.Wolf])).toThrow("role_count_exceeds_limit");
  expect(() => fixture([Role.Cupid, Role.CursedFox, Role.Wolf])).toThrow(
    "role_combination_not_supported",
  );
  expect(() => fixture([Role.Cupid, Role.Hybrid, Role.Wolf])).toThrow(
    "role_combination_not_supported",
  );
});
for (const policy of ["netease_2017_cupid_follows_lovers_v1", "lui_meme_lovers_only_v1"] as const)
  test(`${policy}: strict mandatory request, self selection, original permissions, private recipients and God checkpoint`, async () => {
    const game = fixture(deck, policy),
      events: GameEvent[] = [],
      requests: ActionRequest[] = [];
    await CUPID_STAGE.execute(
      context(game, events, async (request) => {
        requests.push(request);
        return choose(1, 3);
      }),
    );
    expect(requests).toHaveLength(1);
    expect(requests[0]!.context.turn_constraints.min_valid_actions).toBe(1);
    expect(requests[0]!.context.allow_fallback).toBe(false);
    expect(requests[0]!.context.action_failure_policy).toBe("error");
    expect(loversRecord(game.world)).toMatchObject({
      pairIds: [1, 3],
      pairCamps: [Camp.Good, Camp.Wolf],
      mixed: true,
      policy,
    });
    expect(role(game, 1).camp).toBe(Camp.Good);
    expect(wolfKnifeHolders(game.world, getDefaultRoleCatalog())).toEqual([3, 5]);
    expect(knownWolfTeammates(game.world, 1, getDefaultRoleCatalog())).toEqual([]);
    expect(knownWolfTeammates(game.world, 3, getDefaultRoleCatalog())).toEqual([5]);
    expect(resolveInspection(game.world, 1, "camp", getDefaultRoleCatalog())).toEqual({
      kind: "camp",
      camp: Camp.Good,
    });
    for (const id of game.playerIds) {
      const visible = buildAgentVisibleEventFeed(game.world, events, id);
      expect(visible.map((event) => event.type)).toEqual(
        id === 1
          ? ["cupid_lovers_chosen", "lover_recognized"]
          : id === 3
            ? ["lover_recognized"]
            : [],
      );
      expect(JSON.stringify(visible)).not.toContain("pairCamps");
      expect(JSON.stringify(visible)).not.toContain("mixed");
      if (id === 3) expect(visible[0]!.payload).toEqual({ actorId: 3, partnerId: 1 });
    }
    role(game, 6).role = Role.Cupid;
    expect(buildAgentVisibleEventFeed(game.world, events, 6)).toEqual([]);
    const recorded = captureCheckpoint(game.world, snapshot(), 1, true, events.length);
    expect(recorded.players[0]!.lovers).toEqual(loversRecord(game.world)!);
    expect(JSON.stringify(recorded)).not.toContain("actorLife");
  });
for (const bad of [null, choose(2, 2), choose(2, 99), choose(2.5, 3)])
  test(`mandatory invalid ${JSON.stringify(bad)} fails three times without state, membership or notification writes`, async () => {
    const game = fixture(),
      events: GameEvent[] = [];
    let calls = 0;
    await expect(
      CUPID_STAGE.execute(
        context(game, events, async () => {
          calls++;
          return bad;
        }),
      ),
    ).rejects.toThrow("cupid_valid_action_missing");
    expect(calls).toBe(3);
    expect(events).toEqual([]);
    expect(loversRecord(game.world)).toBeNull();
    expect(getCupidState(role(game, 1))!.remaining).toBe(1);
  });
for (const mutation of [
  "target_role",
  "target_camp",
  "target_state",
  "target_life",
  "target_revive",
  "target_victory",
  "target_affiliations",
  "target_member",
  "owner_state",
  "owner_life",
  "owner_policy",
  "owner_victory",
  "phase",
])
  test(`selection rejects late ${mutation} without committing its old reply`, async () => {
    const game = fixture(),
      events: GameEvent[] = [],
      oldState = getCupidState(role(game, 1))!;
    let current = true,
      calls = 0;
    const operation = CUPID_STAGE.execute(
      context(
        game,
        events,
        async () => {
          if (calls++) return null;
          const victory = game.world.getComponent<VictoryComponent>(2, COMPONENT.Victory)!;
          if (mutation === "target_role") role(game, 2).role = Role.Villager;
          if (mutation === "target_camp") role(game, 2).camp = Camp.Wolf;
          if (mutation === "target_state")
            (role(game, 2) as { privateState: Readonly<Record<string, unknown>> }).privateState =
              {};
          if (mutation === "target_life")
            game.world.addComponent(2, COMPONENT.Alive, createAliveComponent());
          if (mutation === "target_revive") {
            life(game, 2).alive = false;
            life(game, 2).alive = true;
          }
          if (mutation === "target_victory")
            game.world.addComponent(
              2,
              COMPONENT.Victory,
              createVictoryComponent([{ kind: "faction", faction: Camp.Good }]),
            );
          if (mutation === "target_affiliations") victory.affiliations = [...victory.affiliations];
          if (mutation === "target_member")
            victory.affiliations[0] = { kind: "faction", faction: Camp.Wolf };
          if (mutation === "owner_state")
            (role(game, 1) as { privateState: Readonly<Record<string, unknown>> }).privateState =
              {};
          if (mutation === "owner_life")
            game.world.addComponent(1, COMPONENT.Alive, createAliveComponent());
          if (mutation === "owner_policy") oldState.policy = "lui_meme_lovers_only_v1";
          if (mutation === "owner_victory")
            game.world.addComponent(1, COMPONENT.Victory, createVictoryComponent([]));
          if (mutation === "phase") current = false;
          return choose(2, 3);
        },
        () => current,
      ),
    );
    if (mutation.startsWith("target_"))
      await expect(operation).rejects.toThrow("cupid_valid_action_missing");
    else await operation;
    expect(loversRecord(game.world)).toBeNull();
    expect(oldState.remaining).toBe(1);
    expect(events).toEqual([]);
  });
test("request construction revocation never reaches provider; committed reentry cannot replenish new state", async () => {
  const game = fixture(),
    events: GameEvent[] = [];
  let current = true,
    calls = 0;
  const ctx = context(
      game,
      events,
      async () => {
        calls++;
        return choose(2, 3);
      },
      () => current,
    ),
    make = ctx.makeRequest;
  ctx.makeRequest = (...args) => {
    const request = make(...args);
    current = false;
    return request;
  };
  await CUPID_STAGE.execute(ctx);
  expect(calls).toBe(0);
  expect(events).toEqual([]);
  await connect(game, 2, 3, events);
  (role(game, 1) as { privateState: Readonly<Record<string, unknown>> }).privateState = {
    cupid: { policy: "netease_2017_cupid_follows_lovers_v1", remaining: 1, choice: null },
  };
  expect(hasCupidNightCommit(game.world, 1)).toBe(true);
  await expect(connect(game, 4, 5)).rejects.toThrow("cupid_night_reentry_after_commit");
  expect(loversRecord(game.world)!.pairIds).toEqual([2, 3]);
});
for (const policy of ["netease_2017_cupid_follows_lovers_v1", "lui_meme_lovers_only_v1"] as const)
  test(`${policy}: manual same-Wolf, mixed, Good and no-phantom-Wolf count and membership oracles`, async () => {
    const wolves = fixture(deck, policy);
    await connect(wolves, 3, 5);
    for (const id of [2, 4, 6]) life(wolves, id).alive = false;
    expect(cupidCityDecision(wolves.world)!.decision?.winner ?? null).toBe(
      policy === "netease_2017_cupid_follows_lovers_v1" ? Camp.Wolf : null,
    );
    if (policy === "netease_2017_cupid_follows_lovers_v1")
      expect(cupidCityDecision(wolves.world)!.decision!.outcome).toMatchObject({
        winningPlayerIds: [1, 3, 5],
      });
    for (const id of [3, 5]) life(wolves, id).alive = false;
    expect(cupidCityDecision(wolves.world)!.decision).toMatchObject({
      winner: Camp.Good,
      outcome: {
        winningPlayerIds:
          policy === "netease_2017_cupid_follows_lovers_v1" ? [2, 4, 6] : [1, 2, 4, 6],
      },
    });
    const mixed = fixture(deck, policy);
    await connect(mixed, 2, 3);
    for (const id of [4, 5, 6]) life(mixed, id).alive = false;
    expect(cupidCityDecision(mixed.world)!.decision?.reason ?? null).toBe(
      policy === "netease_2017_cupid_follows_lovers_v1" ? "cupid_lovers_only_survivors" : null,
    );
    life(mixed, 1).alive = false;
    expect(cupidCityDecision(mixed.world)!.decision!.outcome).toMatchObject({
      primary: { kind: "relationship", groupId: "cupid_lovers" },
      winningPlayerIds: policy === "netease_2017_cupid_follows_lovers_v1" ? [1, 2, 3] : [2, 3],
    });
    const good = fixture(deck, policy);
    await connect(good, 2, 4);
    for (const id of [2, 3, 4, 5]) life(good, id).alive = false;
    expect(cupidCityDecision(good.world)!.decision!.outcome).toMatchObject({
      winningPlayerIds: [1, 2, 4, 6],
    });
  });
test("Lui-même forbids mutual exile and PK, Net retains permission, sheriff election unaffected", async () => {
  for (const policy of [
    "netease_2017_cupid_follows_lovers_v1",
    "lui_meme_lovers_only_v1",
  ] as const) {
    const game = fixture(deck, policy);
    await connect(game, 2, 3);
    const gateway = new ToolGateway();
    for (const exileCandidates of [undefined, [3, 4]])
      expect(
        gateway.validateAndSanitize(
          game.world,
          2,
          { name: "vote", args: { target_id: 3, abstain: false } },
          { phase: Phase.Voting, day: 1, exileCandidates },
        ).ok,
      ).toBe(policy !== "lui_meme_lovers_only_v1");
    expect(
      gateway.validateAndSanitize(
        game.world,
        2,
        { name: "vote_for_sheriff", args: { target_id: 3, abstain: false } },
        { phase: Phase.Day, day: 1, sheriffCandidates: [3, 4] },
      ).ok,
    ).toBe(true);
  }
});
test("cancelled death settlement has no events/consumption, then original legitimate wave still settles once", async () => {
  const game = fixture(),
    events: GameEvent[] = [];
  await connect(game, 1, 2);
  const resolution = resolver(game, events);
  await resolution.resolve(
    [2],
    { 2: [DeathCause.WolfKill] },
    {
      async getAction() {
        throw new Error("unexpected");
      },
    },
    Phase.Night,
    Phase.Day,
    {},
    { nightOriginIds: [2], isCurrent: () => false },
  );
  expect(events).toEqual([]);
  expect(game.world.getAliveEntityIds()).toEqual([1, 2, 3, 4, 5, 6]);
  const guns: number[] = [];
  await resolution.resolve(
    [2],
    { 2: [DeathCause.WolfKill] },
    {
      async getAction(request) {
        if (request.allowedTools.includes("shoot")) {
          guns.push(request.actorId);
          return { name: "shoot", args: { target_id: 3 } };
        }
        return { name: "speak", args: { text: "last" } };
      },
    },
    Phase.Night,
    Phase.Day,
    {},
    { nightOriginIds: [2] },
  );
  expect(guns).toEqual([2]);
  expect(game.world.getAliveEntityIds()).toEqual([4, 5, 6]);
  expect(events.filter((e) => e.type === "lovers_death").map((e) => e.payload)).toEqual([
    { actorId: 2, targetId: 1 },
  ]);
});
for (const both of [false, true])
  test(`Hunter lovers: two independent seeds=${both} qualify before any gun request; root never gets reverse heartbeat`, async () => {
    const game = fixture([Role.Cupid, Role.Hunter, Role.Wolf, Role.Hunter, Role.Villager]),
      events: GameEvent[] = [];
    await connect(game, 2, 4);
    const guns: number[] = [];
    await resolver(game, events).resolve(
      both ? [2, 4] : [2],
      both ? { 2: [DeathCause.WolfKill], 4: [DeathCause.Exile] } : { 2: [DeathCause.WolfKill] },
      {
        async getAction(request) {
          if (request.allowedTools.includes("shoot")) {
            guns.push(request.actorId);
            return { name: "shoot", args: { target_id: 3 } };
          }
          return { name: "speak", args: { text: "last" } };
        },
      },
      Phase.Night,
      Phase.Day,
      {},
      { nightOriginIds: [2] },
    );
    expect(guns).toEqual(both ? [] : [2]);
    expect(life(game, 2).alive).toBe(false);
    expect(life(game, 4).alive).toBe(false);
  });
for (const night of [false, true])
  test(`paid Dreamer night=${night}: Cupid closure precedes Dream-target gun qualification`, async () => {
    const game = fixture([Role.Cupid, Role.Dreamer, Role.Wolf, Role.Hunter, Role.Villager]),
      events: GameEvent[] = [];
    await connect(game, 1, 2);
    const actorLife = life(game, 2),
      targetLife = life(game, 4),
      dreams = new DreamNightFrame([
        {
          actorId: 2,
          targetId: 4,
          day: 1,
          consecutive: false,
          actorLife,
          actorVersion: aliveLifeVersion(actorLife),
          targetLife,
          targetVersion: aliveLifeVersion(targetLife),
        },
      ]);
    const guns: number[] = [];
    await resolver(game, events).resolve(
      [1],
      { 1: [night ? DeathCause.WolfKill : DeathCause.Exile] },
      {
        async getAction(request) {
          if (request.allowedTools.includes("shoot")) guns.push(request.actorId);
          return { name: "speak", args: { text: "last" } };
        },
      },
      night ? Phase.Night : Phase.Day,
      Phase.Day,
      {},
      { dreams, nightOriginIds: night ? [1] : [] },
    );
    expect(life(game, 4).alive).toBe(!night);
    expect(guns).toEqual([]);
    expect(events.some((e) => e.type === "dream_death")).toBe(night);
  });
for (const policy of ["awa_exile_poison_v1", "heroes_s7_2017_exile_hunter_v1"] as const)
  test(`${policy}: Beauty poison+heartbreak does not charm a third player`, async () => {
    const game = fixture([Role.Cupid, Role.WolfBeauty, Role.Wolf, Role.Hunter, Role.Villager]),
      events: GameEvent[] = [];
    await connect(game, 1, 2);
    const beauty = getWolfBeautyState(role(game, 2))!;
    (
      beauty as {
        deathLinkPolicy: "awa_exile_poison_v1" | "heroes_s7_2017_exile_hunter_v1" | undefined;
      }
    ).deathLinkPolicy = policy;
    (beauty as { targetId: number | null }).targetId = 4;
    bindCharm(game.world, 2, 4);
    await resolver(game, events).resolve(
      [1, 2],
      { 1: [DeathCause.Exile], 2: [DeathCause.Poison] },
      {
        async getAction() {
          return { name: "speak", args: { text: "last" } };
        },
      },
      Phase.Day,
      Phase.Day,
    );
    expect(life(game, 4).alive).toBe(true);
    expect(events.some((e) => e.type === "charm_death")).toBe(false);
    for (const cause of Object.values(DeathCause))
      expect(permitsCharm([cause, DeathCause.Lovers], policy, true)).toBe(false);
  });
test("paid relation survives Cupid/partner role replacement, while revived or replaced lives do not inherit it", async () => {
  const game = fixture();
  await connect(game, 2, 3);
  const record = loversRecord(game.world)!;
  role(game, 1).role = Role.Villager;
  (role(game, 1) as { privateState: Readonly<Record<string, unknown>> }).privateState = {};
  life(game, 1).alive = false;
  role(game, 2).role = Role.Villager;
  (role(game, 2) as { privateState: Readonly<Record<string, unknown>> }).privateState = {};
  expect(loversRecord(game.world)).toBe(record);
  expect(projectLover(game.world, 2)).toEqual({ partnerId: 3, mayNotVotePartner: false });
  await resolver(game, []).resolve(
    [2],
    { 2: [DeathCause.Exile] },
    {
      async getAction() {
        return { name: "speak", args: { text: "last" } };
      },
    },
    Phase.Day,
    Phase.Day,
  );
  expect(life(game, 3).alive).toBe(false);
  life(game, 2).alive = true;
  life(game, 3).alive = true;
  for (const id of [4, 5, 6]) life(game, id).alive = false;
  expect(livingOriginalLovers(game.world)).toBe(false);
  expect(projectLover(game.world, 2)).toBeNull();
  expect(cupidCityDecision(game.world)!.decision).toBeNull();
  game.world.addComponent(2, COMPONENT.Alive, createAliveComponent());
  const events: GameEvent[] = [];
  await resolver(game, events).resolve(
    [3],
    { 3: [DeathCause.Poison] },
    {
      async getAction() {
        return { name: "speak", args: { text: "last" } };
      },
    },
    Phase.Day,
    Phase.Day,
  );
  expect(life(game, 2).alive).toBe(true);
  expect(events.some((e) => e.type === "lovers_death")).toBe(false);
});
for (const replacement of [false, true])
  test(`partner original life replacement=${replacement} revokes active DTO/prompt and mutual-vote restriction without deleting historical notification`, async () => {
    const game = fixture(deck, "lui_meme_lovers_only_v1"),
      events = await connect(game, 2, 3);
    expect(projectLover(game.world, 2)).toEqual({ partnerId: 3, mayNotVotePartner: true });
    if (replacement) game.world.addComponent(3, COMPONENT.Alive, createAliveComponent());
    else {
      life(game, 3).alive = false;
      life(game, 3).alive = true;
    }
    expect(projectLover(game.world, 2)).toBeNull();
    expect(
      new ToolGateway().validateAndSanitize(
        game.world,
        2,
        { name: "vote", args: { target_id: 3, abstain: false } },
        { phase: Phase.Voting, day: 1 },
      ).ok,
    ).toBe(true);
    expect(buildAgentVisibleEventFeed(game.world, events, 2).map((event) => event.payload)).toEqual(
      [{ actorId: 2, partnerId: 3 }],
    );
  });

test("restricted-observation final gun with no living targets deliberately passes instead of failing the required turn", async () => {
  const { ObservedBot } = await import("../../../src/ai/agents/providers/observed_bot");
  const game = fixture(),
    request = new GameActionRequestFactory(game.world, [], 1).create({
      actorId: 2,
      phase: Phase.Day,
      allowedTools: ["shoot"],
      stage: "hunter_shot",
      requiresAction: true,
      summary: "Offline",
    });
  const action = await new ObservedBot({ next: () => 0.5 }, "active").decide({
    request,
    identity: { role: Role.Hunter, camp: Camp.Good },
    knownAliveIds: [],
    teammateIds: [],
    abilities: [],
    deathAbilities: [],
    ownNightActions: [],
    ownState: { hunter: { canShoot: true } },
  });
  expect(action).toEqual({ name: "shoot", args: { target_id: null } });
});

test("strict source fact readers and DTO projection reject extra secrets/getters without evaluating them", () => {
  let getters = 0;
  const state = {
    policy: "netease_2017_cupid_follows_lovers_v1",
    remaining: 1,
    choice: { day: 1, pairIds: [2, 3, "secret"] },
  };
  expect(projectCupidState(state as any).choice).toBeNull();
  Object.defineProperty(state, "choice", {
    enumerable: true,
    get() {
      getters++;
      return { day: 1, pairIds: [2, 3] };
    },
  });
  expect(projectCupidState(state as any).choice).toBeNull();
  expect(getters).toBe(0);
  expect(
    readCupidEventFact("lover_recognized", {
      actorId: 2,
      partnerId: 3,
      pairCamps: ["good", "wolf"],
    }),
  ).toBeNull();
  const event = {
    actorId: 2,
    get partnerId() {
      getters++;
      return 3;
    },
  };
  for (const locale of ["en", "zh-CN"] as const)
    expect(cupidEventLabel("lover_recognized", event, locale)).toBe(text(locale, "replay.unknown"));
  expect(getters).toBe(0);
});

for (const causes of [[DeathCause.Lovers], []])
  test(`external lethal wave with causes=${JSON.stringify(causes)} still closes paid relationship`, async () => {
    const game = fixture(),
      events: GameEvent[] = [];
    await connect(game, 2, 4);
    await resolver(game, events).resolve(
      [2],
      { 2: causes },
      {
        async getAction() {
          return { name: "speak", args: { text: "last" } };
        },
      },
      Phase.Day,
      Phase.Day,
    );
    expect(life(game, 2).alive).toBe(false);
    expect(life(game, 4).alive).toBe(false);
    expect(events.filter((e) => e.type === "lovers_death").map((e) => e.payload)).toEqual([
      { actorId: 2, targetId: 4 },
    ]);
  });

test("Cupid own DTO and bilingual role prompt preserve the committed choice without opponent secrets", async () => {
  for (const policy of [
    "netease_2017_cupid_follows_lovers_v1",
    "lui_meme_lovers_only_v1",
  ] as const) {
    const game = fixture(deck, policy);
    await connect(game, 2, 3);
    const state = getCupidState(role(game, 1))!;
    expect(projectCupidState(state)).toEqual({
      policy,
      remaining: 0,
      choice: { day: 1, pairIds: [2, 3] },
    });
    for (const locale of ["zh-CN", "en"] as const) {
      const prompt = role(game, 1).renderPrompt(locale);
      expect(prompt).toContain('"pairIds":[2,3]');
      expect(prompt).not.toContain("pairCamps");
    }
    let getters = 0;
    const pairIds = [2, 3];
    Object.defineProperty(pairIds, "0", {
      get() {
        getters++;
        return 2;
      },
    });
    expect(
      projectCupidState({ ...state, choice: { day: 1, pairIds: pairIds as [number, number] } })
        .choice,
    ).toBeNull();
    expect(getters).toBe(0);
  }
});
