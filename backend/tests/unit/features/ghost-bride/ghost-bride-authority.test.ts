/**
 * 单元测试：验证鬼新娘授权与只读事实边界。输入为有限板子、精确事实和畸形 descriptor；setup、scope、婚姻库存及隐私的字面断言验证原生所有权。不调用模型或完整对局驱动，不从生产输出重建 oracle。
 */
import { createCampComponent, createAliveComponent } from "../../../../src/game/observation/component-presentation";
import { expect, test, spyOn } from "bun:test";
import { GHOST_BRIDE_POLICY, GHOST_BRIDE_GOAL, GHOST_BRIDE_ROLE, freshGhostBrideState, readGhostBrideState, readWeddingSetup, readWeddingPair, readWeddingGroup, readWeddingKnifeCapture, readWeddingTool } from "@ai-werewolf-arena/game-contract/facts/ghost-bride";
import { World, assertRequestDelivery, deferRequestDelivery, Role, Camp, Phase, COMPONENT, ActionWindow, WitchSelfHealRule, WinCondition, DeathCause, createVictoryComponent, type BoardConfig, type RoleComponent, type AliveComponent, type VictoryComponent, type DeathSources } from "../../../../src/core";
import { createRoleComponent } from "../../../../src/game/observation/role-presentation";
import { assertGhostBridePreset } from "../../../../src/game/mechanisms/roles/ghost_bride/preset";
import {
  installGhostBride,
  beginWeddingSetup,
  openWeddingTurn as openRawWeddingTurn,
  commitWeddingTool,
  closeWeddingTurn,
  closeWeddingSetup,
  weddingSetup,
  weddingPair,
  weddingGroup,
  weddingAuditPlayer,
  ghostBrideReady,
  bindGhostBrideRequest,
  ghostBrideRequestScope,
  inheritGhostBrideDeadlineRequest,
  authorizedWeddingTurn,
  captureWeddingKnife,
  resolveWeddingKnife,
  weddingKnifeCurrent,
  weddingNightCapture,
  takeWeddingChat,
  weddingActorView,
  closeWeddingNight,
  weddingAssignment,
  weddingFactionResult,
  weddingMember,
  expandWeddingDeaths,
  type WeddingRequest,
} from "../../../../src/game/mechanisms/roles/ghost_bride/authority";
const roles = [
  GHOST_BRIDE_ROLE as Role,
  Role.Wolf,
  Role.Wolf,
  Role.Wolf,
  Role.Villager,
  Role.Villager,
  Role.Villager,
  Role.Villager,
  Role.Seer,
  Role.Witch,
  Role.Hunter,
  Role.Guard,
];
function config(): BoardConfig {
  return {
    boardSize: 12,
    enableSheriff: true,
    winConditions: [GHOST_BRIDE_GOAL as WinCondition],
    ghostBride: { policy: GHOST_BRIDE_POLICY },
    roleSetups: [...new Set(roles)].map((role) => ({
      role,
      count: roles.filter((r) => r === role).length,
    })),
    hooks: { onPreElection: true, onPreVote: true, onDaybreak: false, onPerSpeechGap: false },
    selfDestruct: { enabledWindows: [ActionWindow.OnPreElection, ActionWindow.OnPreVote] },
    seer: { targetPolicy: "awa_alive_v1", actionPolicy: "awa_required_when_legal_v1" },
    guard: { repeatPolicy: "netease_consecutive_nights_v1" },
    witch: {
      canSelfHeal: WitchSelfHealRule.Disabled,
      knifeVisibility: "awa_with_heal_v1",
      potionPolicy: "awa_one_native_v1",
    },
    hunter: { deathActionPolicy: "awa_knife_or_exile_v1" },
    sheriff: {
      electionPolicy: "awa_final_candidates_v1",
      badgePolicy: "awa_next_seat_v1",
      voteWeight: 1.5,
    },
    tieBreaker: { sheriffVote: "min_seat", wolfKillVote: "min_id", exileVote: "min_id" },
    voting: { exilePolicy: "awa_direct_v1" },
    disclosure: { deathRevealPolicy: "awa_hidden_v1" },
    lastWords: { policy: "awa_initial_wave_v1" },
  } as BoardConfig;
}
function fixture(groom = 2, witness = 3, install = true) {
  const world = new World(),
    c = config();
  for (const kind of roles) {
    const id = world.createEntity(),
      camp =
        kind === (GHOST_BRIDE_ROLE as Role)
          ? Camp.ThirdParty
          : kind === Role.Wolf
            ? Camp.Wolf
            : Camp.Good,
      role = createRoleComponent(kind);
    (role as { privateState: Readonly<Record<string, unknown>> }).privateState =
      kind === (GHOST_BRIDE_ROLE as Role)
        ? { ghostBride: freshGhostBrideState() }
        : { native: { stock: 1 } };
    world.addComponent(id, COMPONENT.Role, role);
    world.addComponent(id, COMPONENT.Camp, createCampComponent(camp));
    world.addComponent(id, COMPONENT.Alive, createAliveComponent());
    world.addComponent(
      id,
      COMPONENT.Victory,
      createVictoryComponent([{ kind: "faction", faction: camp }]),
    );
  }
  if (install) installGhostBride(world, c);
  return { world, c, groom, witness };
}
type Fixture = ReturnType<typeof fixture>;
const role = (g: Fixture, id: number) => g.world.getComponent(id, COMPONENT.Role)!;
const life = (g: Fixture, id: number) => g.world.getComponent(id, COMPONENT.Alive)!;
const goal = (g: Fixture, id: number) =>
  g.world.getComponent(id, COMPONENT.Victory)!;
function turn(
  g: Fixture,
  kind: "bridegroom" | "chat" | "witness" | "knife",
  actor: number,
  value: unknown,
  day = 1,
) {
  const scope = openWeddingTurn(g.world, kind, actor, day, () => true);
  expect(authorizedWeddingTurn(g.world, actor, Phase.Night, day, scope)).toBe(true);
  const ok = commitWeddingTool(scope, value);
  if (ok && kind === "chat") expect(takeWeddingChat(scope)).not.toBeNull();
  closeWeddingTurn(scope);
  return ok;
}
function pair(g: Fixture) {
  beginWeddingSetup(g.world, g.c, () => true);
  expect(
    turn(g, "bridegroom", 1, { name: "choose_bridegroom", args: { target_id: g.groom } }),
  ).toBe(true);
}
function complete(g: Fixture) {
  pair(g);
  for (const actor of [1, g.groom])
    expect(turn(g, "chat", actor, { name: "speak_to_partner", args: { text: "" } })).toBe(true);
  for (const actor of [1, g.groom])
    expect(
      turn(g, "witness", actor, { name: "choose_wedding_witness", args: { target_id: g.witness } }),
    ).toBe(true);
  expect(ghostBrideReady(g.world)).toBe(true);
}
function kill(g: Fixture, ...ids: number[]) {
  for (const id of ids) life(g, id).alive = false;
}
function knife(g: Fixture, actor: number, target: number | null, day = 1) {
  return turn(
    g,
    "knife",
    actor,
    {
      name:
        weddingNightCapture(g.world, day)?.owner === "ordinary_pack"
          ? "kill_vote"
          : "wedding_kill_vote",
      args: { target_id: target, abstain: target === null },
    },
    day,
  );
}
function laterChats(g: Fixture, day: number) {
  for (const actor of [1, g.groom])
    expect(turn(g, "chat", actor, { name: "speak_to_partner", args: { text: "" } }, day)).toBe(
      true,
    );
}
test("finite preset rejects goal, stock rule, hook, composition and extension variants", () => {
  expect(() => assertGhostBridePreset(config())).not.toThrow();
  const variants: Array<(c: BoardConfig) => void> = [
    (c) => (c.winConditions = [WinCondition.SlaughterCity]),
    (c) => (c.guard = { repeatPolicy: "awa_last_action_v1" }),
    (c) => (c.hunter = { deathActionPolicy: "awa_qualified_sources_v1" }),
    (c) => (c.hooks.onDaybreak = true),
    (c) => (c.roleSetups[0]!.count = 2),
    (c) => c.roleSetups.push({ role: Role.Villager, count: 0 }),
    (c) => (c.witch!.canSelfHeal = WitchSelfHealRule.Always),
    (c) => (c.enableSheriff = false),
    (c) => (c.initialSheriffSeat = 1),
    (c) => (c.events = { pack: "quiet_night" as never }),
    (c) => (c.cupid = { policy: "lui_meme_lovers_only_v1" }),
    (c) => (c.tieBreaker!.wolfKillVote = "no_kill"),
    (c) => (c.sheriff!.voteWeight = 2),
  ];
  for (const mutate of variants) {
    const c = config();
    mutate(c);
    expect(() => assertGhostBridePreset(c)).toThrow();
  }
});
test("shared readers enforce exact setup prefixes and data-only input without evaluating getters", () => {
  const g = fixture();
  expect(readWeddingSetup(weddingSetup(g.world))).not.toBeNull();
  pair(g);
  const p = weddingPair(g.world)!;
  expect(readWeddingPair(p)).toEqual(p);
  expect(readWeddingGroup({ ...p, witnessId: 3 })).not.toBeNull();
  expect(readWeddingGroup({ ...p, witnessId: 2 })).toBeNull();
  expect(readWeddingPair({ ...p, other: 1 })).toBeNull();
  expect(
    readWeddingSetup({ ...weddingSetup(g.world), status: "complete", witnessId: 3 }),
  ).toBeNull();
  expect(
    readWeddingSetup({
      ...weddingSetup(g.world),
      status: "failed",
      witnessVotes: [
        { actorId: 1, targetId: 3 },
        { actorId: 2, targetId: 3 },
      ],
    }),
  ).toBeNull();
  expect(
    readWeddingSetup({
      ...weddingSetup(g.world),
      status: "failed",
      witnessVotes: [
        { actorId: 1, targetId: 3 },
        { actorId: 2, targetId: 4 },
      ],
    }),
  ).not.toBeNull();
  expect(readGhostBrideState({ ...freshGhostBrideState(), remaining: 1, groomId: 2 })).toBeNull();
  let calls = 0;
  const bad = {
    get policy() {
      calls++;
      return GHOST_BRIDE_POLICY;
    },
    remaining: 1,
    groomId: null,
  };
  expect(readGhostBrideState(bad)).toBeNull();
  expect(
    readWeddingTool({
      name: "choose_bridegroom",
      args: {
        get target_id() {
          calls++;
          return 2;
        },
      },
    }),
  ).toBeNull();
  expect(calls).toBe(0);
});
for (const bad of [
  null,
  { name: "choose_bridegroom", args: { target_id: "2" } },
  { name: "choose_bridegroom", args: { target_id: 2, extra: true } },
  { name: "wedding_kill_vote", args: { target_id: null, abstain: false } },
  { name: "wedding_kill_vote", args: { target_id: 2, abstain: true } },
  { name: "speak_to_partner", args: { text: "", extra: 1 } },
])
  test(`strict tool rejects ${JSON.stringify(bad)}`, () => expect(readWeddingTool(bad)).toBeNull());
test("native Wolf groom and witness retain originals, immutable pair is never mutated into group", () => {
  const g = fixture(),
    originals = roles.map((_, i) => ({
      role: role(g, i + 1),
      life: life(g, i + 1),
      state: role(g, i + 1).privateState,
    }));
  complete(g);
  const p = weddingPair(g.world)!,
    group = weddingGroup(g.world)!;
  expect(Object.isFrozen(p)).toBe(true);
  expect(Object.isFrozen(group)).toBe(true);
  expect(Object.hasOwn(p, "witnessId")).toBe(false);
  expect(p).not.toBe(group);
  for (let i = 0; i < 12; i++) {
    expect(role(g, i + 1)).toBe(originals[i]!.role);
    expect(life(g, i + 1)).toBe(originals[i]!.life);
    expect(role(g, i + 1).privateState).toBe(originals[i]!.state);
    expect(g.world.getComponent(i + 1, COMPONENT.Camp)!.camp).toBe(i === 0 ? Camp.ThirdParty : i < 4 ? Camp.Wolf : Camp.Good);
    expect(goal(g, i + 1).affiliations).toEqual([
      { kind: "faction", faction: i < 3 ? Camp.ThirdParty : i < 4 ? Camp.Wolf : Camp.Good },
    ]);
  }
  expect(weddingMember(g.world, role(g, 2))).toBe(true);
  expect(weddingMember(g.world, role(g, 4))).toBe(false);
  expect(() => beginWeddingSetup(g.world, g.c, () => true)).toThrow();
});
test("chat order, proposal order, duplicate window and disagreement preserve a real closed prefix", () => {
  const g = fixture();
  pair(g);
  expect(() => openWeddingTurn(g.world, "witness", 1, 1, () => true)).toThrow();
  expect(() => openWeddingTurn(g.world, "chat", 2, 1, () => true)).toThrow();
  for (const actor of [1, 2])
    expect(turn(g, "chat", actor, { name: "speak_to_partner", args: { text: "" } })).toBe(true);
  const first = openWeddingTurn(g.world, "witness", 1, 1, () => true);
  expect(() => openWeddingTurn(g.world, "witness", 1, 1, () => true)).toThrow();
  expect(commitWeddingTool(first, { name: "choose_wedding_witness", args: { target_id: 3 } })).toBe(
    true,
  );
  expect(commitWeddingTool(first, { name: "choose_wedding_witness", args: { target_id: 3 } })).toBe(
    false,
  );
  expect(turn(g, "witness", 2, { name: "choose_wedding_witness", args: { target_id: 4 } })).toBe(
    false,
  );
  expect(readWeddingSetup(weddingSetup(g.world))).toEqual({
    policy: GHOST_BRIDE_POLICY,
    status: "failed",
    actorId: 1,
    groomId: 2,
    witnessId: null,
    witnessVotes: [
      { actorId: 1, targetId: 3 },
      { actorId: 2, targetId: 4 },
    ],
  });
  expect(weddingGroup(g.world)).toBeNull();
  expect(ghostBrideReady(g.world)).toBe(false);
  expect(() => captureWeddingKnife(g.world, 1, () => true)).toThrow();
  expect(() => weddingAssignment(g.world)).toThrow();
  expect(goal(g, 2).affiliations).toEqual([{ kind: "faction", faction: Camp.ThirdParty }]);
  expect(goal(g, 3).affiliations).toEqual([{ kind: "faction", faction: Camp.Wolf }]);
});
for (const target of [1, 0, 99])
  test(`invalid groom ${target} cannot consume original choice`, () => {
    const g = fixture();
    beginWeddingSetup(g.world, g.c, () => true);
    expect(
      turn(g, "bridegroom", 1, { name: "choose_bridegroom", args: { target_id: target } }),
    ).toBe(false);
    expect(weddingPair(g.world)).toBeNull();
    closeWeddingSetup(g.world, "failed");
    expect(
      readGhostBrideState((role(g, 1).privateState as { readonly ghostBride?: unknown }).ghostBride)
        ?.remaining,
    ).toBe(0);
  });
const mutations: Record<string, (g: Fixture) => void> = {
  death: (g) => kill(g, 3),
  revive: (g) => {
    kill(g, 3);
    life(g, 3).alive = true;
  },
  newLife: (g) => g.world.addComponent(3, COMPONENT.Alive, createAliveComponent()),
  newRole: (g) =>
    g.world.addComponent(3, COMPONENT.Role, createRoleComponent(Role.Wolf)),
  roleTruth: (g) => (role(g, 3).role = Role.Villager),
  roleCamp: (g) => (g.world.getComponent(3, COMPONENT.Camp)!.camp = Camp.Good),
  state: (g) =>
    ((role(g, 3) as { privateState: Readonly<Record<string, unknown>> }).privateState = {}),
  stock: (g) =>
    ((
      (role(g, 3).privateState as { readonly native?: unknown }).native as { stock: number }
    ).stock = 0),
  goal: (g) => (goal(g, 3).affiliations = [{ kind: "faction", faction: Camp.Good }]),
  goalValue: (g) => (goal(g, 3).affiliations[0] = { kind: "faction", faction: Camp.Good }),
  config: (g) => (g.c.hooks.onDaybreak = true),
};
for (const [name, mutate] of Object.entries(mutations))
  test(`second vote late ${name} revokes setup without committed witness`, () => {
    const g = fixture();
    pair(g);
    for (const actor of [1, 2])
      turn(g, "chat", actor, { name: "speak_to_partner", args: { text: "" } });
    turn(g, "witness", 1, { name: "choose_wedding_witness", args: { target_id: 3 } });
    const scope = openWeddingTurn(g.world, "witness", 2, 1, () => true);
    mutate(g);
    expect(
      commitWeddingTool(scope, { name: "choose_wedding_witness", args: { target_id: 3 } }),
    ).toBe(false);
    closeWeddingSetup(g.world, "cancelled");
    expect(weddingGroup(g.world)).toBeNull();
    expect(weddingSetup(g.world)?.witnessVotes).toEqual([{ actorId: 1, targetId: 3 }]);
    expect(() => beginWeddingSetup(g.world, g.c, () => true)).toThrow();
  });
test("no foreign getter runs in request rejection or failed identity audit", () => {
  const g = fixture();
  beginWeddingSetup(g.world, g.c, () => true);
  const scope = openWeddingTurn(g.world, "bridegroom", 1, 1, () => true);
  let calls = 0;
  Object.defineProperty(role(g, 3), "privateState", {
    enumerable: true,
    get() {
      calls++;
      return {};
    },
  });
  expect(commitWeddingTool(scope, { name: "choose_bridegroom", args: { target_id: 2 } })).toBe(
    false,
  );
  closeWeddingSetup(g.world, "failed");
  expect(weddingAuditPlayer(g.world, 3)?.privateState).toEqual({ native: { stock: 1 } });
  expect(calls).toBe(0);
});
function request(
  actorId = 1,
  tool = "choose_bridegroom",
  stage = "ghost_bride_groom",
  day = 1,
): WeddingRequest {
  return {
    actorId,
    phase: Phase.Night,
    allowedTools: [tool],
    context: {
      day,
      stage,
      allow_fallback: false,
      action_failure_policy: "error",
      turn_constraints: { min_valid_actions: 1, max_valid_actions: 1, required_any_tools: [tool] },
    },
  } as WeddingRequest;
}
function openWeddingTurn(
  world: World,
  kind: "bridegroom" | "chat" | "witness" | "knife",
  actorId: number,
  day: number,
  current: () => boolean,
): object {
  const scope = openRawWeddingTurn(world, kind, actorId, day, current),
    ordinary = kind === "knife" && weddingNightCapture(world, day)?.owner === "ordinary_pack",
    tool =
      kind === "bridegroom"
        ? "choose_bridegroom"
        : kind === "chat"
          ? "speak_to_partner"
          : kind === "witness"
            ? "choose_wedding_witness"
            : ordinary
              ? "kill_vote"
              : "wedding_kill_vote",
    stage =
      kind === "bridegroom"
        ? "ghost_bride_groom"
        : kind === "chat"
          ? "ghost_bride_chat"
          : kind === "witness"
            ? "ghost_bride_witness"
            : ordinary
              ? "wolf_vote"
              : "ghost_bride_knife";
  bindGhostBrideRequest(world, request(actorId, tool, stage, day));
  return scope;
}
test("opaque request belongs to original world/window; only reference-preserving deadline clones inherit", () => {
  const g = fixture(),
    other = fixture();
  beginWeddingSetup(g.world, g.c, () => true);
  const scope = openRawWeddingTurn(g.world, "bridegroom", 1, 1, () => true),
    r = request();
  bindGhostBrideRequest(g.world, r);
  expect(ghostBrideRequestScope(g.world, r)).toBe(scope);
  expect(ghostBrideRequestScope(other.world, r)).toBeUndefined();
  expect(ghostBrideRequestScope(g.world, structuredClone(r))).toBeUndefined();
  const deadline = { ...r, deadlineAtMs: Date.now() + 60_000 };
  inheritGhostBrideDeadlineRequest(r, deadline);
  expect(ghostBrideRequestScope(g.world, deadline)).toBe(scope);
  const forged = { ...r, context: { ...r.context }, deadlineAtMs: Date.now() + 60_000 };
  inheritGhostBrideDeadlineRequest(r, forged);
  expect(ghostBrideRequestScope(g.world, forged)).toBeUndefined();
  let calls = 0;
  Object.defineProperty(r, "context", {
    get() {
      calls++;
      return deadline.context;
    },
    enumerable: true,
  });
  expect(ghostBrideRequestScope(g.world, r)).toBeUndefined();
  expect(calls).toBe(0);
  closeWeddingTurn(scope);
  expect(ghostBrideRequestScope(g.world, deadline)).toBeUndefined();
});
test("private stock mutates naturally after setup but component/goal drift closes victory", () => {
  const g = fixture(9, 10);
  complete(g);
  ((role(g, 10).privateState as { readonly native?: unknown }).native as { stock: number }).stock =
    0;
  expect(weddingAssignment(g.world)).toHaveLength(12);
  goal(g, 10).affiliations[0] = { kind: "faction", faction: Camp.Good };
  expect(() => weddingAssignment(g.world)).toThrow();
  expect(() => weddingFactionResult(g.world)).toThrow();
});
for (const camp of [Camp.Good, Camp.Wolf, Camp.ThirdParty])
  test(`only remaining faction ${camp} wins with dead members included`, () => {
    const g = fixture();
    complete(g);
    const assignment = weddingAssignment(g.world)!;
    for (const [id, f] of assignment) if (f !== camp) kill(g, id);
    const members = assignment.filter(([, f]) => f === camp).map(([id]) => id);
    if (members.length > 1) kill(g, members[0]!);
    expect(weddingFactionResult(g.world)).toEqual({ faction: camp, winningPlayerIds: members });
  });
test("one faction eliminated continues, simultaneous all-faction wipe draws", () => {
  const g = fixture();
  complete(g);
  kill(g, 4);
  expect(weddingFactionResult(g.world)).toBeNull();
  kill(g, ...g.world.entityIds());
  expect(weddingFactionResult(g.world)).toEqual({ faction: null, winningPlayerIds: [] });
});
test("ordinary pack excludes native Wolf wedding members and capture freezes one knife for the night", () => {
  const g = fixture();
  complete(g);
  const capture = captureWeddingKnife(g.world, 1, () => true);
  expect(capture.owner).toBe("ordinary_pack");
  expect(capture.actorIds).toEqual([4]);
  expect(readWeddingKnifeCapture(capture)).toEqual(capture);
  expect(() => captureWeddingKnife(g.world, 1, () => true)).toThrow();
  expect(() => openWeddingTurn(g.world, "knife", 2, 1, () => true)).toThrow();
  expect(knife(g, 4, 5)).toBe(true);
  expect(resolveWeddingKnife(g.world, 1)).toBe(5);
  expect(weddingKnifeCurrent(g.world, 1, 5)).toBe(true);
  kill(g, 4);
  expect(weddingKnifeCurrent(g.world, 1, 5)).toBe(false);
  expect(() => captureWeddingKnife(g.world, 1, () => true)).toThrow();
  closeWeddingNight(g.world);
  expect(() => captureWeddingKnife(g.world, 1, () => true)).toThrow();
  expect(captureWeddingKnife(g.world, 2, () => true).owner).toBe("pair");
});
for (const votes of [
  [null, null, null],
  [null, 6, 6],
  [8, 6, 6],
  [5, 5, 5],
] as const)
  test(`pair explicit knife protocol ${JSON.stringify(votes)}`, () => {
    const g = fixture();
    complete(g);
    kill(g, 4);
    captureWeddingKnife(g.world, 1, () => true);
    expect(knife(g, 1, votes[0])).toBe(true);
    expect(knife(g, 2, votes[1])).toBe(true);
    expect(resolveWeddingKnife(g.world, 1)).toBe(votes[2]);
    expect(() => resolveWeddingKnife(g.world, 1)).toThrow();
  });
test("pair self targets forbidden; lost second member cannot downgrade to one ballot", () => {
  const g = fixture();
  complete(g);
  kill(g, 4);
  captureWeddingKnife(g.world, 1, () => true);
  expect(knife(g, 1, 2)).toBe(false);
  expect(knife(g, 1, 5)).toBe(true);
  kill(g, 2);
  expect(() => openWeddingTurn(g.world, "knife", 2, 1, () => true)).toThrow();
  expect(resolveWeddingKnife(g.world, 1)).toBeNull();
});
test("mandatory missing knife never becomes fabricated abstention", () => {
  const g = fixture();
  complete(g);
  captureWeddingKnife(g.world, 1, () => true);
  expect(() => resolveWeddingKnife(g.world, 1)).toThrow("ghost_bride_required_knife_missing");
});
test("witness knife requires both pair dead; no threshold recapture or self target", () => {
  const g = fixture();
  complete(g);
  kill(g, 4, 1, 2);
  expect(captureWeddingKnife(g.world, 1, () => true).owner).toBe("witness");
  expect(knife(g, 3, 3)).toBe(false);
  expect(knife(g, 3, 5)).toBe(true);
  expect(resolveWeddingKnife(g.world, 1)).toBe(5);
  kill(g, 5);
  life(g, 5).alive = true;
  expect(weddingKnifeCurrent(g.world, 1, 5)).toBe(false);
});
test("one living partner produces no knife; later living pair chat must finish before either knife", () => {
  const g = fixture();
  complete(g);
  kill(g, 4, 1);
  expect(captureWeddingKnife(g.world, 1, () => true).owner).toBe("none");
  expect(resolveWeddingKnife(g.world, 1)).toBeNull();
  closeWeddingNight(g.world);
  const h = fixture();
  complete(h);
  captureWeddingKnife(h.world, 1, () => true);
  knife(h, 4, null);
  resolveWeddingKnife(h.world, 1);
  closeWeddingNight(h.world);
  captureWeddingKnife(h.world, 2, () => true);
  expect(() => openWeddingTurn(h.world, "knife", 4, 2, () => true)).toThrow();
  laterChats(h, 2);
  expect(knife(h, 4, 5, 2)).toBe(true);
});
for (const causes of [
  [DeathCause.WolfKill],
  [DeathCause.Poison],
  [DeathCause.Shot],
  [DeathCause.Exile],
  [DeathCause.SelfDestruct],
  [DeathCause.WolfKill, DeathCause.Poison],
  [DeathCause.WolfKill, DeathCause.Shot],
])
  test(`single external groom root preserves all causes ${causes}`, () => {
    const g = fixture(11, 3);
    complete(g);
    const ids = [11],
      sources: DeathSources = { 11: [...causes] },
      night = new Set([11]);
    expect(expandWeddingDeaths(g.world, ids, sources, new Set(), night)).toEqual([
      { actorId: 11, targetId: 1 },
    ]);
    expect(ids).toEqual([11, 1]);
    expect(sources[11]).toEqual(causes);
    expect(sources[1]).toEqual([DeathCause.Lovers]);
    expect(night.has(1)).toBe(true);
    expect(expandWeddingDeaths(g.world, ids, sources, new Set(), night)).toEqual([]);
    expect(sources[11]).toEqual(causes);
  });
test("dual independent roots each keep external causes and Lovers; witness never links", () => {
  const g = fixture(11, 3);
  complete(g);
  const ids = [1, 11],
    sources: DeathSources = { 1: [DeathCause.Poison], 11: [DeathCause.WolfKill] };
  expect(expandWeddingDeaths(g.world, ids, sources, new Set())).toEqual([
    { actorId: 1, targetId: 11 },
    { actorId: 11, targetId: 1 },
  ]);
  expect(sources).toEqual({
    1: [DeathCause.Poison, DeathCause.Lovers],
    11: [DeathCause.WolfKill, DeathCause.Lovers],
  });
  expect(ids).toEqual([1, 11]);
  const wIds = [3],
    wSources: DeathSources = { 3: [DeathCause.WolfKill] };
  expect(expandWeddingDeaths(g.world, wIds, wSources, new Set())).toEqual([]);
  expect(wIds).toEqual([3]);
});

test("first consent remains independently revocable after its turn closes", () => {
  const g = fixture();
  pair(g);
  for (const actor of [1, 2])
    turn(g, "chat", actor, { name: "speak_to_partner", args: { text: "" } });
  let current = true;
  const first = openWeddingTurn(g.world, "witness", 1, 1, () => current);
  expect(commitWeddingTool(first, { name: "choose_wedding_witness", args: { target_id: 3 } })).toBe(
    true,
  );
  current = false;
  const second = openWeddingTurn(g.world, "witness", 2, 1, () => true);
  expect(
    commitWeddingTool(second, { name: "choose_wedding_witness", args: { target_id: 3 } }),
  ).toBe(false);
  expect(weddingGroup(g.world)).toBeNull();
  expect(weddingSetup(g.world)?.witnessVotes).toHaveLength(1);
});
test("a first consent original request cannot be replaced or edited before agreement", () => {
  const g = fixture();
  pair(g);
  for (const actor of [1, 2])
    turn(g, "chat", actor, { name: "speak_to_partner", args: { text: "" } });
  const first = openRawWeddingTurn(g.world, "witness", 1, 1, () => true),
    r = request(1, "choose_wedding_witness", "ghost_bride_witness");
  bindGhostBrideRequest(g.world, r);
  expect(commitWeddingTool(first, { name: "choose_wedding_witness", args: { target_id: 3 } })).toBe(
    true,
  );
  r.context.day = 2;
  const second = openWeddingTurn(g.world, "witness", 2, 1, () => true);
  expect(
    commitWeddingTool(second, { name: "choose_wedding_witness", args: { target_id: 3 } }),
  ).toBe(false);
  expect(weddingGroup(g.world)).toBeNull();
});
test("deadline inheritance only tightens, expiration also revokes domain commit", () => {
  const g = fixture();
  beginWeddingSetup(g.world, g.c, () => true);
  const scope = openRawWeddingTurn(g.world, "bridegroom", 1, 1, () => true),
    r = request(),
    now = Date.now();
  bindGhostBrideRequest(g.world, r);
  const deadline = { ...r, deadlineAtMs: now + 60_000 };
  inheritGhostBrideDeadlineRequest(r, deadline);
  expect(ghostBrideRequestScope(g.world, deadline)).toBe(scope);
  for (const target of [
    { ...deadline, deadlineAtMs: now + 120_000 },
    { ...r },
    { ...deadline, deadlineAtMs: now - 1 },
  ]) {
    inheritGhostBrideDeadlineRequest(deadline, target);
    expect(ghostBrideRequestScope(g.world, target)).toBeUndefined();
  }
  const shorter = { ...deadline, deadlineAtMs: now + 30_000 };
  inheritGhostBrideDeadlineRequest(deadline, shorter);
  expect(ghostBrideRequestScope(g.world, shorter)).toBe(scope);
  const clock = spyOn(Date, "now").mockReturnValue(now + 30_001);
  try {
    expect(ghostBrideRequestScope(g.world, r)).toBeUndefined();
    expect(ghostBrideRequestScope(g.world, shorter)).toBeUndefined();
    expect(commitWeddingTool(scope, { name: "choose_bridegroom", args: { target_id: 2 } })).toBe(
      false,
    );
  } finally {
    clock.mockRestore();
  }
});
test("unbound scope and installed-world missing owner never authorize", () => {
  const g = fixture();
  beginWeddingSetup(g.world, g.c, () => true);
  const scope = openRawWeddingTurn(g.world, "bridegroom", 1, 1, () => true);
  expect(authorizedWeddingTurn(g.world, 1, Phase.Night, 1, scope)).toBe(false);
  expect(commitWeddingTool(scope, { name: "choose_bridegroom", args: { target_id: 2 } })).toBe(
    false,
  );
  expect(ghostBrideReady(fixture(2, 3, false).world)).toBe(false);
  expect(ghostBrideReady(new World())).toBe(true);
});
test("illegal native data already present at open cannot authorize knife or victory", () => {
  const g = fixture();
  complete(g);
  let calls = 0;
  Object.defineProperty(
    (role(g, 10).privateState as { readonly native?: unknown }).native,
    "stock",
    {
      enumerable: true,
      get() {
        calls++;
        return 1;
      },
    },
  );
  expect(() => weddingAssignment(g.world)).toThrow();
  expect(() => captureWeddingKnife(g.world, 1, () => true)).toThrow();
  expect(calls).toBe(0);
});
test("factory life descriptor rejects substituted getter even before authority installation", () => {
  const g = fixture(2, 3, false);
  let calls = 0;
  Object.defineProperty(life(g, 3), "alive", {
    enumerable: true,
    get() {
      calls++;
      return true;
    },
  });
  expect(() => installGhostBride(g.world, g.c)).toThrow();
  expect(calls).toBe(0);
});
for (const mutation of [
  (c: BoardConfig) => {
    (c as unknown as { enableSheriff: number }).enableSheriff = 1;
  },
  (c: BoardConfig) => {
    delete (c.hooks as Partial<typeof c.hooks>).onDaybreak;
  },
  (c: BoardConfig) => {
    (c.guard as unknown as { extra: string }).extra = "unfrozen";
  },
  (c: BoardConfig) => {
    (c as unknown as { extra: string }).extra = "unfrozen";
  },
  (c: BoardConfig) => {
    (c.roleSetups[0] as unknown as { extra: string }).extra = "unfrozen";
  },
])
  test("internal preset rejects non-boolean/omitted/extra shape", () => {
    const c = config();
    mutation(c);
    expect(() => assertGhostBridePreset(c)).toThrow("ghost_bride_preset_invalid");
  });

test("committed chats deliver once to original living partner; Witness projection contains no private chat or votes", () => {
  const g = fixture();
  pair(g);
  const scope = openWeddingTurn(g.world, "chat", 1, 1, () => true);
  expect(commitWeddingTool(scope, { name: "speak_to_partner", args: { text: "private" } })).toBe(
    true,
  );
  expect(takeWeddingChat(scope)).toEqual({ actorId: 1, recipientId: 2, day: 1, text: "private" });
  expect(takeWeddingChat(scope)).toBeNull();
  turn(g, "chat", 2, { name: "speak_to_partner", args: { text: "" } });
  turn(g, "witness", 1, { name: "choose_wedding_witness", args: { target_id: 3 } });
  expect(weddingActorView(g.world, 2)?.member).toBe("groom");
  expect(weddingActorView(g.world, 2)).toHaveProperty("proposedWitnessId", 3);
  expect(weddingActorView(g.world, 1)).not.toHaveProperty("proposedWitnessId");
  expect(weddingActorView(g.world, 3)).toBeNull();
  turn(g, "witness", 2, { name: "choose_wedding_witness", args: { target_id: 3 } });
  expect(weddingActorView(g.world, 3)).toEqual({
    policy: GHOST_BRIDE_POLICY,
    member: "witness",
    faction: Camp.ThirdParty,
    brideId: 1,
    groomId: 2,
    canKnife: false,
  });
  expect(weddingActorView(g.world, 4)).toBeNull();
  expect(weddingActorView(g.world, 2)).not.toHaveProperty("proposedWitnessId");
});
for (const mutate of [
  (g: Fixture) => kill(g, 2),
  (g: Fixture) => {
    kill(g, 2);
    life(g, 2).alive = true;
  },
  (g: Fixture) =>
    g.world.addComponent(2, COMPONENT.Role, createRoleComponent(Role.Wolf)),
])
  test("chat delivery independently revokes original receiver after committed choice", () => {
    const g = fixture();
    pair(g);
    const scope = openWeddingTurn(g.world, "chat", 1, 1, () => true);
    expect(commitWeddingTool(scope, { name: "speak_to_partner", args: { text: "private" } })).toBe(
      true,
    );
    mutate(g);
    expect(takeWeddingChat(scope)).toBeNull();
    closeWeddingSetup(g.world, "cancelled");
  });
test("first consent expires independently before agreement and keeps one-vote prefix", () => {
  const g = fixture();
  pair(g);
  for (const actor of [1, 2])
    turn(g, "chat", actor, { name: "speak_to_partner", args: { text: "" } });
  const scope = openRawWeddingTurn(g.world, "witness", 1, 1, () => true),
    r = request(1, "choose_wedding_witness", "ghost_bride_witness"),
    now = Date.now();
  r.deadlineAtMs = now + 1000;
  bindGhostBrideRequest(g.world, r);
  expect(commitWeddingTool(scope, { name: "choose_wedding_witness", args: { target_id: 3 } })).toBe(
    true,
  );
  const clock = spyOn(Date, "now").mockReturnValue(now + 1001);
  try {
    const second = openWeddingTurn(g.world, "witness", 2, 1, () => true);
    expect(authorizedWeddingTurn(g.world, 2, Phase.Night, 1, second)).toBe(false);
    expect(
      commitWeddingTool(second, { name: "choose_wedding_witness", args: { target_id: 3 } }),
    ).toBe(false);
  } finally {
    clock.mockRestore();
  }
  expect(weddingGroup(g.world)).toBeNull();
  expect(weddingSetup(g.world)?.witnessVotes).toHaveLength(1);
});

for (const mutation of [
  (c: BoardConfig) => {
    (c.roleSetups[1] as unknown as { role: unknown }).role = ["wolf"];
  },
  (c: BoardConfig) => {
    (c as unknown as { winConditions: unknown }).winConditions = [[GHOST_BRIDE_GOAL]];
  },
  (c: BoardConfig) => {
    (c as unknown as { winCondition: unknown }).winCondition = [GHOST_BRIDE_GOAL];
  },
  (c: BoardConfig) => {
    (c as unknown as { winConditions: unknown }).winConditions = null;
    c.winCondition = GHOST_BRIDE_GOAL as WinCondition;
  },
])
  test("preset never coerces malformed role or goal types", () => {
    const c = config();
    mutation(c);
    expect(() => assertGhostBridePreset(c)).toThrow("ghost_bride_preset_invalid");
  });
for (const [groom, witness, actors, targets, expected] of [
  [2, 5, [3, 4], [8, 7], 7],
  [5, 6, [2, 3, 4], [8, 7, 8], 8],
] as const)
  test(`original ordinary kill_vote: ${actors.length} ballots and min-id tie`, () => {
    const g = fixture(groom, witness);
    complete(g);
    expect(captureWeddingKnife(g.world, 1, () => true).actorIds).toEqual([...actors]);
    for (let i = 0; i < actors.length; i++) expect(knife(g, actors[i]!, targets[i]!)).toBe(true);
    expect(resolveWeddingKnife(g.world, 1)).toBe(expected);
  });
test("unconsumed chat receipt prevents reopening or advancing a turn", () => {
  const g = fixture();
  pair(g);
  const scope = openWeddingTurn(g.world, "chat", 1, 1, () => true);
  expect(commitWeddingTool(scope, { name: "speak_to_partner", args: { text: "" } })).toBe(true);
  expect(() => openWeddingTurn(g.world, "chat", 1, 1, () => true)).toThrow();
  expect(() => openWeddingTurn(g.world, "chat", 2, 1, () => true)).toThrow();
  expect(takeWeddingChat(scope)).not.toBeNull();
  expect(() => openWeddingTurn(g.world, "chat", 2, 1, () => true)).not.toThrow();
});

test("authorized deadline clones retain the transaction and reject await-time revocation", () => {
  const g = fixture();
  let current = true;
  beginWeddingSetup(g.world, g.c, () => current);
  const scope = openRawWeddingTurn(g.world, "bridegroom", 1, 1, () => current);
  const original = request(1, "choose_bridegroom", "ghost_bride_groom", 1);
  bindGhostBrideRequest(g.world, original);
  const timed = { ...original, deadlineAtMs: Date.now() + 1000 };
  inheritGhostBrideDeadlineRequest(original, timed);
  expect(ghostBrideRequestScope(g.world, timed)).toBe(scope);
  expect(() => assertRequestDelivery(timed as never)).not.toThrow();
  const receipt = { settled: null as boolean | null };
  expect(
    deferRequestDelivery(timed as never, (accepted) => {
      receipt.settled = accepted;
    }),
  ).toBe(true);
  current = false;
  expect(() => assertRequestDelivery(timed as never)).toThrow(
    "action_request_delivery_authority_revoked",
  );
  closeWeddingSetup(g.world, "cancelled");
  expect(receipt.settled as boolean | null).toBe(false);
});
test("first consent expires after delivery validation but before second commit without a successful receipt", () => {
  const g = fixture();
  pair(g);
  for (const actor of [1, g.groom])
    expect(turn(g, "chat", actor, { name: "speak_to_partner", args: { text: "" } })).toBe(true);
  let now = 1000;
  const clock = spyOn(Date, "now").mockImplementation(() => now);
  try {
    const first = openRawWeddingTurn(g.world, "witness", 1, 1, () => true);
    const firstRequest = {
      ...request(1, "choose_wedding_witness", "ghost_bride_witness", 1),
      deadlineAtMs: 1010,
    };
    bindGhostBrideRequest(g.world, firstRequest);
    expect(
      commitWeddingTool(first, { name: "choose_wedding_witness", args: { target_id: g.witness } }),
    ).toBe(true);
    const second = openRawWeddingTurn(g.world, "witness", g.groom, 1, () => true);
    const secondRequest = request(g.groom, "choose_wedding_witness", "ghost_bride_witness", 1);
    bindGhostBrideRequest(g.world, secondRequest);
    expect(() => assertRequestDelivery(secondRequest as never)).not.toThrow();
    const receipt = { settled: null as boolean | null };
    expect(
      deferRequestDelivery(secondRequest as never, (accepted) => {
        receipt.settled = accepted;
      }),
    ).toBe(true);
    now = 1011;
    expect(
      commitWeddingTool(second, { name: "choose_wedding_witness", args: { target_id: g.witness } }),
    ).toBe(false);
    expect(receipt.settled as boolean | null).toBe(false);
    expect(weddingSetup(g.world)!.witnessVotes).toHaveLength(1);
    expect(weddingGroup(g.world)).toBeNull();
    closeWeddingSetup(g.world, "failed");
  } finally {
    clock.mockRestore();
  }
});
test("chat receipt waits for final delivery, and disagreement records the actually committed second vote", () => {
  const g = fixture();
  pair(g);
  const chat = openRawWeddingTurn(g.world, "chat", 1, 1, () => true);
  const chatRequest = request(1, "speak_to_partner", "ghost_bride_chat", 1);
  bindGhostBrideRequest(g.world, chatRequest);
  const receipt = { settled: null as boolean | null };
  deferRequestDelivery(chatRequest as never, (accepted) => {
    receipt.settled = accepted;
  });
  expect(commitWeddingTool(chat, { name: "speak_to_partner", args: { text: "" } })).toBe(true);
  expect(receipt.settled as boolean | null).toBeNull();
  expect(takeWeddingChat(chat)).not.toBeNull();
  expect(receipt.settled as boolean | null).toBe(true);
  expect(turn(g, "chat", g.groom, { name: "speak_to_partner", args: { text: "" } })).toBe(true);
  expect(
    turn(g, "witness", 1, { name: "choose_wedding_witness", args: { target_id: g.witness } }),
  ).toBe(true);
  const vote = openRawWeddingTurn(g.world, "witness", g.groom, 1, () => true);
  const voteRequest = request(g.groom, "choose_wedding_witness", "ghost_bride_witness", 1);
  bindGhostBrideRequest(g.world, voteRequest);
  receipt.settled = null;
  deferRequestDelivery(voteRequest as never, (accepted) => {
    receipt.settled = accepted;
  });
  expect(commitWeddingTool(vote, { name: "choose_wedding_witness", args: { target_id: 4 } })).toBe(
    false,
  );
  expect(receipt.settled as boolean | null).toBe(true);
  expect(weddingSetup(g.world)!.witnessVotes).toHaveLength(2);
  expect(weddingSetup(g.world)!.status).toBe("failed");
});

test("a rejected pending chat settles error in its own turn without waiting for global setup close", () => {
  const g = fixture();
  pair(g);
  let current = true;
  const chat = openRawWeddingTurn(g.world, "chat", 1, 1, () => current);
  const chatRequest = request(1, "speak_to_partner", "ghost_bride_chat", 1);
  bindGhostBrideRequest(g.world, chatRequest);
  const receipt = { settled: null as boolean | null };
  deferRequestDelivery(chatRequest as never, (accepted) => {
    receipt.settled = accepted;
  });
  expect(commitWeddingTool(chat, { name: "speak_to_partner", args: { text: "" } })).toBe(true);
  current = false;
  expect(takeWeddingChat(chat)).toBeNull();
  closeWeddingTurn(chat);
  expect(receipt.settled as boolean | null).toBe(false);
  expect(weddingSetup(g.world)!.status).toBe("paired");
  expect(() => openRawWeddingTurn(g.world, "chat", g.groom, 1, () => true)).toThrow();
});
