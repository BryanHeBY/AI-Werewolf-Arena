import { expect, test, spyOn } from "bun:test";
import {
  World,
  Role,
  Camp,
  Phase,
  COMPONENT,
  WinCondition,
  ActionWindow,
  WitchSelfHealRule,
  createRoleComponent,
  createCampComponent,
  createVictoryComponent,
  createAliveComponent,
  assertRequestDelivery,
  deferRequestDelivery,
  bindRequestDeliveryGuard,
  type BoardConfig,
  type ActionStage,
  type ToolName,
  type GameEvent,
  type RoleComponent,
  type AliveComponent,
} from "../../../src/core";
import {
  installDemonHunter,
  beginDemonHunterNight,
  openDemonHunterTurn,
  bindDemonHunterRequest,
  demonHunterRequestScope,
  inheritDemonHunterDeadlineRequest,
  authorizedDemonHunter,
  commitDemonHunt,
  closeDemonHunterTurn,
  closeDemonHunterNight,
  freezeDemonHunt,
  committedDemonFaultBoundary,
  projectDemonHunter,
  demonHunterAuditPlayer,
  type DemonHunterRequest,
} from "../../../src/game/mechanisms/roles/demon_hunter/authority";
import {
  DEMON_HUNTER_ROLE,
  freshDemonHunterState,
} from "../../../src/game/mechanisms/roles/demon_hunter/state";
import {
  installNativeAbility,
  recordNightAbilityUse,
  type NightAbility,
} from "../../../src/game/mechanisms/roles/abilities";
import {
  captureDemonNativePoison,
  commitDemonNativePoison,
  freezeDemonNativePoison,
  freezeDemonNightSources,
} from "../../../src/game/mechanisms/roles/demon_hunter/native_poison";
import { NightFaultPlan } from "../../../src/game/engine/fault_plan";
function fixture() {
  const world = new World(),
    roles = [Role.Wolf, Role.Wolf, Role.Villager, Role.Seer, Role.Witch, DEMON_HUNTER_ROLE as Role];
  for (const kind of roles) {
    const id = world.createEntity(),
      camp = kind === Role.Wolf ? Camp.Wolf : Camp.Good,
      role = createRoleComponent(kind, camp);
    if (String(kind) === DEMON_HUNTER_ROLE) role.privateState.demonHunter = freshDemonHunterState();
    if (kind === Role.Witch)
      installNativeAbility(role, "potion", {
        heal: 1,
        poison: 1,
        selfHealRule: WitchSelfHealRule.Disabled,
        canSelfHeal: false,
        healUsedThisNight: false,
        poisonUsedThisNight: false,
      });
    world.addComponent(id, COMPONENT.Role, role);
    world.addComponent(id, COMPONENT.Camp, createCampComponent(camp));
    world.addComponent(
      id,
      COMPONENT.Victory,
      createVictoryComponent([{ kind: "faction", faction: camp }]),
    );
    world.addComponent(id, COMPONENT.Alive, createAliveComponent());
  }
  const config: BoardConfig = {
    boardSize: 6,
    enableSheriff: false,
    roleSetups: [...new Set(roles)].map((role) => ({
      role,
      count: roles.filter((r) => r === role).length,
    })),
    winConditions: [WinCondition.SlaughterCity],
    hooks: { onPreElection: true, onPreVote: true, onDaybreak: false, onPerSpeechGap: false },
    selfDestruct: { enabledWindows: [ActionWindow.OnPreElection, ActionWindow.OnPreVote] },
    witch: {
      canSelfHeal: WitchSelfHealRule.Disabled,
      knifeVisibility: "awa_with_heal_v1",
      potionPolicy: "awa_one_native_v1",
    },
    seer: { targetPolicy: "awa_alive_v1", actionPolicy: "awa_required_when_legal_v1" },
    tieBreaker: { wolfKillVote: "min_id", exileVote: "min_id" },
    voting: { exilePolicy: "awa_direct_v1" },
    disclosure: { deathRevealPolicy: "awa_hidden_v1" },
    lastWords: { policy: "awa_initial_wave_v1" },
    ...{ demonHunter: { policy: "awa_netease_demon_hunter_v1" } },
  };
  installDemonHunter(world, config);
  return { world, config, role: world.getComponent<RoleComponent>(6, COMPONENT.Role)! };
}
function turn(
  f: ReturnType<typeof fixture>,
  day = 2,
  isCurrent = () => true,
  deadlineAtMs?: number,
) {
  beginDemonHunterNight(f.world, day, isCurrent);
  const scope = openDemonHunterTurn(f.world),
    request: DemonHunterRequest = {
      actorId: 6,
      phase: Phase.Night,
      allowedTools: ["demon_hunt"],
      context: {
        day,
        stage: "demon_hunter",
        requiresAction: true,
        allow_fallback: false,
        action_failure_policy: "error",
        turn_constraints: {
          min_valid_actions: 1,
          max_valid_actions: 1,
          required_any_tools: ["demon_hunt"],
        },
      },
      ...(deadlineAtMs === undefined ? {} : { deadlineAtMs }),
    };
  bindDemonHunterRequest(f.world, request);
  expect(demonHunterRequestScope(f.world, request)).toBe(scope);
  return { scope, request };
}
const hunt = (target_id: number | null) => ({
  name: "demon_hunt",
  args: { target_id, abstain: target_id === null },
});
for (const [targetId, expected] of [
  [1, { targetId: 1, cause: "demon_hunt" }],
  [3, { targetId: 6, cause: "demon_hunt_backlash" }],
  [null, null],
] as const)
  test(`target ${targetId}: commit preserves native identity and freezes the correct independent source`, () => {
    const f = fixture(),
      nativeRole = f.role,
      state = f.role.privateState.demonHunter,
      { scope } = turn(f);
    expect(commitDemonHunt(f.world, scope, hunt(targetId))).toEqual({ day: 2, targetId });
    expect(f.role).toBe(nativeRole);
    expect(f.role.camp).toBe(Camp.Good);
    expect(f.role.privateState.demonHunter).toBe(state);
    expect(projectDemonHunter(f.world, f.role)?.history).toEqual([{ day: 2, targetId }]);
    expect(freezeDemonHunt(f.world)).toEqual({
      choice: { day: 2, targetId },
      damage: expected,
      cancelled: null,
    });
    expect(() => freezeDemonHunt(f.world)).toThrow("demon_hunter_freeze_unavailable");
    expect(f.world.getAliveEntityIds()).toEqual([1, 2, 3, 4, 5, 6]);
  });
test("first night has passive frame but opens no tool or history", () => {
  const f = fixture();
  beginDemonHunterNight(f.world, 1, () => true);
  expect(() => openDemonHunterTurn(f.world)).toThrow("demon_hunter_turn_unavailable");
  expect(freezeDemonHunt(f.world).damage).toBeNull();
  expect(projectDemonHunter(f.world, f.role)?.history).toEqual([]);
  closeDemonHunterNight(f.world);
  expect(() => beginDemonHunterNight(f.world, 1, () => true)).toThrow(
    "demon_hunter_night_unavailable",
  );
});
test("each night has one response, with repeat target and explicit abstention recorded on later nights", () => {
  const f = fixture();
  for (const [day, target] of [
    [2, 1],
    [3, null],
    [4, 1],
  ] as const) {
    const { scope } = turn(f, day);
    expect(commitDemonHunt(f.world, scope, hunt(target))).not.toBeNull();
    expect(commitDemonHunt(f.world, scope, hunt(target))).toBeNull();
    freezeDemonHunt(f.world);
    closeDemonHunterNight(f.world);
  }
  expect(projectDemonHunter(f.world, f.role)?.history).toEqual([
    { day: 2, targetId: 1 },
    { day: 3, targetId: null },
    { day: 4, targetId: 1 },
  ]);
});
for (const target of [6, 99, 0])
  test(`invalid target ${target} does not consume the response`, () => {
    const f = fixture(),
      { scope } = turn(f);
    expect(commitDemonHunt(f.world, scope, hunt(target))).toBeNull();
    expect(projectDemonHunter(f.world, f.role)?.history).toEqual([]);
    expect(commitDemonHunt(f.world, scope, hunt(1))).not.toBeNull();
  });
test("a previously dead target and revived target never borrow an original target proof", () => {
  const f = fixture();
  const life = f.world.getComponent<AliveComponent>(1, COMPONENT.Alive)!;
  life.alive = false;
  const { scope } = turn(f);
  expect(commitDemonHunt(f.world, scope, hunt(1))).toBeNull();
  life.alive = true;
  expect(commitDemonHunt(f.world, scope, hunt(1))).toBeNull();
  expect(projectDemonHunter(f.world, f.role)?.history).toEqual([]);
});
test("domain commit, not provider return, settles the recorded original request", () => {
  const f = fixture(),
    { scope, request } = turn(f);
  const settled: boolean[] = [];
  expect(
    deferRequestDelivery(request as any, (accepted) => {
      settled.push(accepted);
    }),
  ).toBe(true);
  expect(settled).toEqual([]);
  expect(commitDemonHunt(f.world, scope, hunt(1))).not.toBeNull();
  expect(settled).toEqual([true]);
  closeDemonHunterTurn(scope);
  expect(settled).toEqual([true]);
});
test("closing an uncommitted response records rejection and does not invent history", () => {
  const f = fixture(),
    { scope, request } = turn(f);
  const settled: boolean[] = [];
  deferRequestDelivery(request as any, (a) => {
    settled.push(a);
  });
  closeDemonHunterTurn(scope);
  expect(settled).toEqual([false]);
  expect(commitDemonHunt(f.world, scope, hunt(1))).toBeNull();
  expect(projectDemonHunter(f.world, f.role)?.history).toEqual([]);
});
test("the original factory request and shortened inherited clone carry authority; copied metadata cannot", () => {
  const f = fixture(),
    { scope, request } = turn(f, 2, () => true, Date.now() + 10000),
    copy = { ...request };
  expect(demonHunterRequestScope(f.world, copy)).toBeUndefined();
  expect(authorizedDemonHunter(f.world, 6, Phase.Night, 2, Object.freeze({}))).toBe(false);
  const extended = { ...request, deadlineAtMs: request.deadlineAtMs! + 100 };
  inheritDemonHunterDeadlineRequest(request, extended);
  expect(demonHunterRequestScope(f.world, extended)).toBeUndefined();
  const timed = { ...request, deadlineAtMs: request.deadlineAtMs! - 100 };
  inheritDemonHunterDeadlineRequest(request, timed);
  expect(demonHunterRequestScope(f.world, timed)).toBe(scope);
  expect(demonHunterRequestScope(fixture().world, timed)).toBeUndefined();
});
test("a deadline expires before commit, with no choice, but a committed effect outlives its closed request budget", () => {
  const f = fixture(),
    { scope, request } = turn(f, 2, () => true, Date.now() + 10000);
  request.deadlineAtMs = Date.now() - 1;
  expect(commitDemonHunt(f.world, scope, hunt(1))).toBeNull();
  expect(() => assertRequestDelivery(request as any)).toThrow();
  const g = fixture(),
    t = turn(g, 2, () => true, Date.now() + 10000);
  expect(commitDemonHunt(g.world, t.scope, hunt(1))).not.toBeNull();
  t.request.deadlineAtMs = Date.now() - 1;
  expect(freezeDemonHunt(g.world).damage).toEqual({ targetId: 1, cause: "demon_hunt" });
});
for (const variant of [
  "actor_life",
  "target_life",
  "role",
  "camp",
  "state",
  "victory",
  "policy",
  "phase",
  "getter",
  "proxy",
] as const)
  test(`${variant}: actual late revocation retains choice and cancels only its pending damage`, () => {
    const f = fixture();
    let current = true,
      reads = 0;
    const { scope } = turn(f, 2, () => current);
    expect(commitDemonHunt(f.world, scope, hunt(1))).not.toBeNull();
    if (variant === "actor_life") f.world.addComponent(6, COMPONENT.Alive, createAliveComponent());
    if (variant === "target_life") f.world.addComponent(1, COMPONENT.Alive, createAliveComponent());
    if (variant === "role")
      f.world.addComponent(
        6,
        COMPONENT.Role,
        createRoleComponent(DEMON_HUNTER_ROLE as Role, Camp.Good),
      );
    if (variant === "camp") f.role.camp = Camp.Wolf;
    if (variant === "state") f.role.privateState.demonHunter = freshDemonHunterState();
    if (variant === "victory")
      f.world.addComponent(
        6,
        COMPONENT.Victory,
        createVictoryComponent([{ kind: "faction", faction: Camp.Good }]),
      );
    if (variant === "policy") f.config.witch!.canSelfHeal = WitchSelfHealRule.Always;
    if (variant === "phase") current = false;
    if (variant === "getter")
      Object.defineProperty(f.role, "privateState", {
        enumerable: true,
        get() {
          reads++;
          return {};
        },
      });
    if (variant === "proxy")
      f.role.privateState.demonHunter = new Proxy(f.role.privateState.demonHunter as object, {
        getPrototypeOf() {
          reads++;
          return Object.prototype;
        },
      });
    const result = freezeDemonHunt(f.world);
    expect(result.choice).toEqual({ day: 2, targetId: 1 });
    expect(result.damage).toBeNull();
    expect(result.cancelled).toEqual({
      policy: "awa_netease_demon_hunter_v1",
      actorId: 6,
      day: 2,
      targetId: 1,
      reason: "authority_revoked",
      faultId: null,
    });
    expect(reads).toBe(0);
    expect(() => openDemonHunterTurn(f.world)).toThrow();
  });
test("an independently supplied fault really replaces the life and the engine independently cancels its original committed source", () => {
  const f = fixture(),
    { scope } = turn(f);
  commitDemonHunt(f.world, scope, hunt(1));
  const runtime = new NightFaultPlan(f.world, {
    version: "awa_fault_plan_v1",
    steps: [
      {
        id: "f1",
        at: {
          day: 2,
          point: "before_night_source_freeze",
          afterDecision: { actorId: 6, stage: "demon_hunter", turn: 1 },
        },
        mutation: { kind: "replace_alive_component", playerId: 6, alive: true },
      },
    ],
  });
  const before = f.world.getComponent(6, COMPONENT.Alive),
    applied: unknown[] = [];
  const ids = runtime.applyBeforeNightSourceFreeze(
    2,
    committedDemonFaultBoundary(f.world),
    (op) => {
      applied.push(op);
    },
  );
  expect(f.world.getComponent(6, COMPONENT.Alive)).not.toBe(before);
  expect(freezeDemonHunt(f.world, ids[0]!).cancelled?.faultId).toBe("f1");
  expect(applied).toHaveLength(1);
  runtime.assertConsumed();
});
test("the original native potion consumption is independently audited; getter/Proxy substitutions preserve that last snapshot", () => {
  const f = fixture(),
    witch = f.world.getComponent<RoleComponent>(5, COMPONENT.Role)!;
  const ability = (witch.privateState.abilities as Record<string, NightAbility<"potion">>)[
    "native:potion"
  ]!;
  beginDemonHunterNight(f.world, 2, () => true);
  const token = captureDemonNativePoison(f.world, 5, ability, 6)!;
  recordNightAbilityUse(ability, 2, true);
  ability.state.poison = 0;
  ability.state.poisonUsedThisNight = true;
  expect(commitDemonNativePoison(token)).not.toBeNull();
  const consumed = demonHunterAuditPlayer(f.world, 5)!;
  expect(
    (consumed.abilities as Record<string, NightAbility<"potion">>)["native:potion"]!.state.poison,
  ).toBe(0);
  expect(
    (consumed.abilities as Record<string, NightAbility<"potion">>)["native:potion"]!.uses,
  ).toBe(1);
  let reads = 0;
  Object.defineProperty(ability, "state", {
    enumerable: true,
    get() {
      reads++;
      return {};
    },
  });
  expect(demonHunterAuditPlayer(f.world, 5)).toEqual(consumed);
  expect(reads).toBe(0);
  const g = fixture(),
    before = demonHunterAuditPlayer(g.world, 5)!;
  const original = g.world.getComponent<RoleComponent>(5, COMPONENT.Role)!;
  original.privateState.abilities = new Proxy(original.privateState.abilities as object, {
    getOwnPropertyDescriptor() {
      reads++;
      return undefined;
    },
    getPrototypeOf() {
      reads++;
      return Object.prototype;
    },
  });
  expect(demonHunterAuditPlayer(g.world, 5)).toEqual(before);
  expect(reads).toBe(0);
});
test("a same-name replacement nested native inventory cannot lend identity to a hunt", () => {
  const f = fixture(),
    { scope } = turn(f);
  const witch = f.world.getComponent<RoleComponent>(5, COMPONENT.Role)!;
  const stored = witch.privateState.abilities as Record<string, NightAbility>;
  stored["native:potion"] = structuredClone(stored["native:potion"]!);
  expect(commitDemonHunt(f.world, scope, hunt(1))).toBeNull();
  (stored["native:potion"] as NightAbility<"potion">).state.poison = 0;
  const audit = demonHunterAuditPlayer(f.world, 5)!;
  expect(
    (audit.abilities as Record<string, NightAbility<"potion">>)["native:potion"]!.state.poison,
  ).toBe(1);
});

test("closing the first uncommitted turn never reopens a replacement request in that night", () => {
  const f = fixture(),
    { scope } = turn(f);
  closeDemonHunterTurn(scope);
  expect(() => openDemonHunterTurn(f.world)).toThrow("demon_hunter_turn_unavailable");
  expect(projectDemonHunter(f.world, f.role)?.history).toEqual([]);
});
test("actual domain commit caches its history before later actor identity revocation", () => {
  const f = fixture(),
    { scope } = turn(f);
  commitDemonHunt(f.world, scope, hunt(1));
  f.role.privateState.demonHunter = freshDemonHunterState();
  expect(freezeDemonHunt(f.world).damage).toBeNull();
  expect(demonHunterAuditPlayer(f.world, 6)).toEqual({
    demonHunter: { policy: "awa_netease_demon_hunter_v1", history: [{ day: 2, targetId: 1 }] },
  });
});

test("a native nested getter rejects the whole bound action without executing it", () => {
  const f = fixture(),
    { scope } = turn(f);
  const witch = f.world.getComponent<RoleComponent>(5, COMPONENT.Role)!;
  const ability = (witch.privateState.abilities as Record<string, NightAbility<"potion">>)[
    "native:potion"
  ]!;
  let reads = 0;
  Object.defineProperty(ability.state, "poison", {
    enumerable: true,
    get() {
      reads++;
      return 1;
    },
  });
  expect(authorizedDemonHunter(f.world, 6, Phase.Night, 2, scope)).toBe(false);
  expect(commitDemonHunt(f.world, scope, hunt(1))).toBeNull();
  expect(reads).toBe(0);
});
test("an already guarded request cannot leave a half-bound turn or completion", () => {
  const f = fixture();
  beginDemonHunterNight(f.world, 2, () => true);
  const scope = openDemonHunterTurn(f.world);
  const request = {
    actorId: 6,
    phase: Phase.Night,
    allowedTools: ["demon_hunt"],
    context: {
      day: 2,
      stage: "demon_hunter",
      requiresAction: true,
      allow_fallback: false,
      action_failure_policy: "error",
      turn_constraints: {
        min_valid_actions: 1,
        max_valid_actions: 1,
        required_any_tools: ["demon_hunt"],
      },
    },
  };
  bindRequestDeliveryGuard(request, () => true, {});
  bindDemonHunterRequest(f.world, request);
  expect(demonHunterRequestScope(f.world, request)).toBeUndefined();
  expect(commitDemonHunt(f.world, scope, hunt(1))).toBeNull();
});
test("a rejected already guarded clone does not change the original deadline or completion", () => {
  const f = fixture(),
    { scope, request } = turn(f, 2, () => true, Date.now() + 10000);
  const clone = { ...request, deadlineAtMs: Date.now() + 5000 };
  bindRequestDeliveryGuard(clone, () => true, {});
  inheritDemonHunterDeadlineRequest(request, clone);
  expect(demonHunterRequestScope(f.world, clone)).toBeUndefined();
  expect(demonHunterRequestScope(f.world, request)).toBe(scope);
  const receipts: boolean[] = [];
  deferRequestDelivery(request as never, (accepted) => {
    receipts.push(accepted);
  });
  commitDemonHunt(f.world, scope, hunt(1));
  expect(receipts).toEqual([true]);
});
test("a replacement life cannot refresh a native inventory audit", () => {
  const f = fixture(),
    before = demonHunterAuditPlayer(f.world, 5)!;
  f.world.addComponent(5, COMPONENT.Alive, createAliveComponent());
  const witch = f.world.getComponent<RoleComponent>(5, COMPONENT.Role)!;
  const ability = (witch.privateState.abilities as Record<string, NightAbility<"potion">>)[
    "native:potion"
  ]!;
  recordNightAbilityUse(ability, 2, true);
  ability.state.poison = 0;
  ability.state.poisonUsedThisNight = true;
  expect(demonHunterAuditPlayer(f.world, 5)).toEqual(before);
});
for (const kind of ["truncate", "append"] as const)
  test(`committed audit rejects ${kind} history corruption`, () => {
    const f = fixture(),
      { scope } = turn(f);
    commitDemonHunt(f.world, scope, hunt(1));
    const before = demonHunterAuditPlayer(f.world, 6)!;
    const history = (
      f.role.privateState.demonHunter as {
        history: Array<{ day: number; targetId: number | null }>;
      }
    ).history;
    if (kind === "truncate") history.length = 0;
    else history.push({ day: 3, targetId: null });
    expect(freezeDemonHunt(f.world).damage).toBeNull();
    expect(demonHunterAuditPlayer(f.world, 6)).toEqual(before);
  });
test("the actual committed fault boundary is unavailable once the night source is frozen", () => {
  const f = fixture(),
    { scope } = turn(f);
  commitDemonHunt(f.world, scope, hunt(1));
  expect(committedDemonFaultBoundary(f.world)).not.toBeNull();
  freezeDemonHunt(f.world);
  expect(committedDemonFaultBoundary(f.world)).toBeNull();
});

test("array-like allowedTools cannot bind a required hunt request", () => {
  const f = fixture();
  beginDemonHunterNight(f.world, 2, () => true);
  const scope = openDemonHunterTurn(f.world);
  const request = {
    actorId: 6,
    phase: Phase.Night,
    allowedTools: { 0: "demon_hunt", length: 1 },
    context: {
      day: 2,
      stage: "demon_hunter",
      requiresAction: true,
      allow_fallback: false,
      action_failure_policy: "error",
      turn_constraints: {
        min_valid_actions: 1,
        max_valid_actions: 1,
        required_any_tools: ["demon_hunt"],
      },
    },
  };
  bindDemonHunterRequest(f.world, request as never);
  expect(demonHunterRequestScope(f.world, request as never)).toBeUndefined();
  expect(commitDemonHunt(f.world, scope, hunt(1))).toBeNull();
});
test("a living second-night actor cannot silently settle without the required explicit response", () => {
  const f = fixture();
  beginDemonHunterNight(f.world, 2, () => true);
  expect(() => freezeDemonHunt(f.world)).toThrow("demon_hunter_required_choice_missing");
});
test("closed night frames strictly increase even when no first-night choice exists", () => {
  const f = fixture();
  beginDemonHunterNight(f.world, 1, () => true);
  freezeDemonHunt(f.world);
  closeDemonHunterNight(f.world);
  beginDemonHunterNight(f.world, 3, () => true);
  closeDemonHunterNight(f.world);
  expect(() => beginDemonHunterNight(f.world, 2, () => true)).toThrow(
    "demon_hunter_night_unavailable",
  );
});

for (const kind of ["replace", "revive", "descriptor"] as const)
  test(`a ${kind} actor life cannot make a required night look inactive`, () => {
    const f = fixture(),
      life = f.world.getComponent<AliveComponent>(6, COMPONENT.Alive)!;
    if (kind === "replace") f.world.addComponent(6, COMPONENT.Alive, createAliveComponent());
    if (kind === "revive") {
      life.alive = false;
      life.alive = true;
    }
    if (kind === "descriptor") Object.defineProperty(life, "alive", { value: true });
    expect(() => beginDemonHunterNight(f.world, 2, () => true)).toThrow(
      "demon_hunter_night_unavailable",
    );
  });
test("the original first death skips future hunt prompts without borrowing a new life", () => {
  const f = fixture();
  f.world.getComponent<AliveComponent>(6, COMPONENT.Alive)!.alive = false;
  beginDemonHunterNight(f.world, 2, () => true);
  expect(() => openDemonHunterTurn(f.world)).toThrow("demon_hunter_turn_unavailable");
  expect(freezeDemonHunt(f.world)).toEqual({ choice: null, damage: null, cancelled: null });
});
function poisonFixture(isCurrent = () => true) {
  const f = fixture(),
    witch = f.world.getComponent<RoleComponent>(5, COMPONENT.Role)!,
    ability = (witch.privateState.abilities as Record<string, NightAbility<"potion">>)[
      "native:potion"
    ]!;
  beginDemonHunterNight(f.world, 1, isCurrent);
  return { ...f, witch, ability };
}
function consumePoison(ability: NightAbility<"potion">, day = 1) {
  recordNightAbilityUse(ability, day, true);
  ability.state.poison--;
  ability.state.poisonUsedThisNight = true;
}
test("first-night immunity requires the actual original native Witch consumption and one pre-death qualification", () => {
  const f = poisonFixture(),
    token = captureDemonNativePoison(f.world, 5, f.ability, 6)!;
  expect(token).not.toBeNull();
  expect(commitDemonNativePoison(token)).toBeNull();
  expect(captureDemonNativePoison(f.world, 5, f.ability, 6)).toBeNull();
  consumePoison(f.ability);
  const proof = commitDemonNativePoison(token)!;
  expect(proof).not.toBeNull();
  expect(commitDemonNativePoison(token)).toBeNull();
  const fact = freezeDemonNativePoison(proof);
  expect(fact).toEqual({ policy: "awa_netease_demon_hunter_v1", actorId: 6, day: 1, witchId: 5 });
  expect(f.world.getAliveEntityIds()).toEqual([1, 2, 3, 4, 5, 6]);
  f.world.getComponent<AliveComponent>(5, COMPONENT.Alive)!.alive = false;
  expect(fact).toEqual({ policy: "awa_netease_demon_hunter_v1", actorId: 6, day: 1, witchId: 5 });
  expect(() => freezeDemonNativePoison(proof)).toThrow(
    "demon_hunter_native_poison_proof_unavailable",
  );
});
for (const kind of [
  "equal_copy",
  "wrong_target",
  "wrong_actor",
  "gift",
  "extra_source",
  "disabled",
  "spent",
  "used",
  "state_getter",
  "source_proxy",
] as const)
  test(`${kind} does not acquire a native Witch poison proof`, () => {
    const f = poisonFixture();
    let reads = 0,
      ability: object = f.ability,
      target = 6,
      actor = 5;
    if (kind === "equal_copy") ability = structuredClone(f.ability);
    if (kind === "wrong_target") target = 4;
    if (kind === "wrong_actor") actor = 4;
    if (kind === "gift") f.ability.source = { kind: "gift", actorId: 4 };
    if (kind === "extra_source") Object.assign(f.ability.source, { actorId: 4 });
    if (kind === "disabled") f.ability.disabled = true;
    if (kind === "spent") f.ability.state.poison = 0;
    if (kind === "used") f.ability.lastUsedDay = 1;
    if (kind === "state_getter")
      Object.defineProperty(f.ability.state, "poison", {
        enumerable: true,
        get() {
          reads++;
          return 1;
        },
      });
    if (kind === "source_proxy")
      f.ability.source = new Proxy(f.ability.source, {
        getPrototypeOf() {
          reads++;
          return Object.prototype;
        },
      });
    expect(captureDemonNativePoison(f.world, actor, ability, target)).toBeNull();
    expect(reads).toBe(0);
  });
for (const kind of ["uses", "day", "poison_flag", "heal", "counterfeit_state"] as const)
  test(`incorrect ${kind} consumption cannot qualify native poison`, () => {
    const f = poisonFixture(),
      token = captureDemonNativePoison(f.world, 5, f.ability, 6)!;
    consumePoison(f.ability);
    if (kind === "uses") f.ability.uses = 0;
    if (kind === "day") f.ability.lastUsedDay = 2;
    if (kind === "poison_flag") f.ability.state.poisonUsedThisNight = false;
    if (kind === "heal") f.ability.state.heal = 0;
    if (kind === "counterfeit_state") f.ability.state = structuredClone(f.ability.state);
    expect(commitDemonNativePoison(token)).toBeNull();
  });
for (const kind of [
  "witch_life",
  "demon_life",
  "phase",
  "metadata",
  "state_getter",
  "source_proxy",
] as const)
  test(`${kind} late revocation cancels poison qualification while cached native consumption stays real`, () => {
    let current = true,
      reads = 0;
    const f = poisonFixture(() => current),
      token = captureDemonNativePoison(f.world, 5, f.ability, 6)!;
    consumePoison(f.ability);
    const proof = commitDemonNativePoison(token)!;
    const consumed = demonHunterAuditPlayer(f.world, 5)!;
    if (kind === "witch_life") f.world.addComponent(5, COMPONENT.Alive, createAliveComponent());
    if (kind === "demon_life") f.world.addComponent(6, COMPONENT.Alive, createAliveComponent());
    if (kind === "phase") current = false;
    if (kind === "metadata") f.ability.sourceDisclosed = false;
    if (kind === "state_getter")
      Object.defineProperty(f.ability, "state", {
        enumerable: true,
        get() {
          reads++;
          return {};
        },
      });
    if (kind === "source_proxy")
      f.ability.source = new Proxy(f.ability.source, {
        getPrototypeOf() {
          reads++;
          return Object.prototype;
        },
      });
    expect(freezeDemonNativePoison(proof)).toBeNull();
    const audit = demonHunterAuditPlayer(f.world, 5)!;
    expect(
      (audit.abilities as Record<string, NightAbility<"potion">>)["native:potion"]!.state.poison,
    ).toBe(0);
    expect(audit).toEqual(consumed);
    expect(reads).toBe(0);
  });
test("ordinary objects and an uncommitted capture cannot manufacture immunity facts", () => {
  const f = poisonFixture(),
    token = captureDemonNativePoison(f.world, 5, f.ability, 6)!;
  expect(() => freezeDemonNativePoison(token)).toThrow();
  expect(() => freezeDemonNativePoison({})).toThrow();
  expect(commitDemonNativePoison({})).toBeNull();
});

test("first-night explicit pass keeps stock and allows a second-night original native poison", () => {
  const f = poisonFixture();
  recordNightAbilityUse(f.ability, 1, false);
  freezeDemonHunt(f.world);
  closeDemonHunterNight(f.world);
  const { scope } = turn(f);
  commitDemonHunt(f.world, scope, hunt(1));
  const token = captureDemonNativePoison(f.world, 5, f.ability, 6)!;
  expect(token).not.toBeNull();
  consumePoison(f.ability, 2);
  const proof = commitDemonNativePoison(token)!;
  const result = freezeDemonNightSources(f.world, [proof]);
  expect(result.hunt.damage).toEqual({ targetId: 1, cause: "demon_hunt" });
  expect(result.poisonImmunities).toEqual([
    { policy: "awa_netease_demon_hunter_v1", actorId: 6, day: 2, witchId: 5 },
  ]);
});
test("a later pure-data refund cannot overwrite the synchronous actual-consumption audit", () => {
  const f = poisonFixture(),
    token = captureDemonNativePoison(f.world, 5, f.ability, 6)!;
  consumePoison(f.ability);
  const proof = commitDemonNativePoison(token)!,
    consumed = demonHunterAuditPlayer(f.world, 5)!;
  f.ability.state.poison = 1;
  f.ability.state.poisonUsedThisNight = false;
  f.ability.uses = 0;
  f.ability.lastUsedDay = null;
  expect(freezeDemonNativePoison(proof)).toBeNull();
  expect(demonHunterAuditPlayer(f.world, 5)).toEqual(consumed);
});
test("incorrect hunt-first freezing cannot silently swallow an otherwise qualified native proof", () => {
  const f = poisonFixture(),
    token = captureDemonNativePoison(f.world, 5, f.ability, 6)!;
  consumePoison(f.ability);
  const proof = commitDemonNativePoison(token)!;
  freezeDemonHunt(f.world);
  expect(() => freezeDemonNativePoison(proof)).toThrow("demon_hunter_freeze_unavailable");
});
test("batch validates missing required response and all proofs before consuming any source", () => {
  const f = fixture(),
    witch = f.world.getComponent<RoleComponent>(5, COMPONENT.Role)!,
    ability = (witch.privateState.abilities as Record<string, NightAbility<"potion">>)[
      "native:potion"
    ]!;
  const { scope } = turn(f),
    token = captureDemonNativePoison(f.world, 5, ability, 6)!;
  consumePoison(ability, 2);
  const proof = commitDemonNativePoison(token)!;
  expect(() => freezeDemonNightSources(f.world, [proof])).toThrow(
    "demon_hunter_required_choice_missing",
  );
  commitDemonHunt(f.world, scope, hunt(3));
  expect(() => freezeDemonNightSources(f.world, [{}])).toThrow(
    "demon_hunter_source_proofs_invalid",
  );
  const result = freezeDemonNightSources(f.world, [proof]);
  expect(result.hunt.damage).toEqual({ targetId: 6, cause: "demon_hunt_backlash" });
  expect(result.poisonImmunities).toHaveLength(1);
  expect(f.world.getAliveEntityIds()).toEqual([1, 2, 3, 4, 5, 6]);
});

test("batch cannot omit the original committed poison source, and rejection consumes none", () => {
  const f = poisonFixture(),
    token = captureDemonNativePoison(f.world, 5, f.ability, 6)!;
  consumePoison(f.ability);
  const proof = commitDemonNativePoison(token)!;
  expect(() => freezeDemonNightSources(f.world, [])).toThrow(
    "demon_hunter_source_proofs_incomplete",
  );
  expect(freezeDemonNightSources(f.world, [proof]).poisonImmunities).toHaveLength(1);
});
test("even a revoked native source cannot be omitted from complete batch qualification", () => {
  const f = poisonFixture(),
    token = captureDemonNativePoison(f.world, 5, f.ability, 6)!;
  consumePoison(f.ability);
  const proof = commitDemonNativePoison(token)!;
  f.ability.sourceDisclosed = false;
  expect(() => freezeDemonNightSources(f.world, [])).toThrow(
    "demon_hunter_source_proofs_incomplete",
  );
  expect(freezeDemonNightSources(f.world, [proof]).poisonImmunities).toEqual([]);
});
for (const revoked of [false, true])
  test(`cross-night pure-data refund never recreates a spent native poison (${revoked ? "revoked" : "qualified"})`, () => {
    const f = poisonFixture(),
      token = captureDemonNativePoison(f.world, 5, f.ability, 6)!;
    consumePoison(f.ability);
    const proof = commitDemonNativePoison(token)!,
      consumed = demonHunterAuditPlayer(f.world, 5)!;
    if (revoked) f.ability.sourceDisclosed = false;
    freezeDemonNightSources(f.world, [proof]);
    closeDemonHunterNight(f.world);
    f.ability.sourceDisclosed = true;
    f.ability.state.poison = 1;
    f.ability.state.poisonUsedThisNight = false;
    f.ability.uses = 0;
    f.ability.lastUsedDay = null;
    const { scope } = turn(f);
    commitDemonHunt(f.world, scope, hunt(1));
    expect(captureDemonNativePoison(f.world, 5, f.ability, 6)).toBeNull();
    expect(demonHunterAuditPlayer(f.world, 5)).toEqual(consumed);
  });

test("the actual factory canonical required request binds without an invented requiresAction context field", async () => {
  // The production bootstrap is the established initialization entry for the factory's role dependencies.
  await import("../../../src/app/bootstrap");
  const { GameActionRequestFactory } =
    await import("../../../src/game/engine/action_request_factory");
  const f = fixture();
  beginDemonHunterNight(f.world, 2, () => true);
  const scope = openDemonHunterTurn(f.world);
  const request = new GameActionRequestFactory(f.world, [], 2).create({
    phase: Phase.Night,
    actorId: 6,
    allowedTools: ["demon_hunt" as ToolName],
    stage: "demon_hunter" as ActionStage,
    requiresAction: true,
    summary: { key: "request.summary.night_action" },
    context: { allow_fallback: false, action_failure_policy: "error" },
  });
  expect(Object.hasOwn(request.context, "requiresAction")).toBe(false);
  expect(request.context.turn_constraints.min_valid_actions).toBe(1);
  bindDemonHunterRequest(f.world, request);
  expect(demonHunterRequestScope(f.world, request)).toBe(scope);
  expect(commitDemonHunt(f.world, scope, hunt(null))).toEqual({ day: 2, targetId: null });
});

test("a real long canonical visible history remains authorized without relaxing state or tool data limits", async () => {
  await import("../../../src/app/bootstrap");
  const { GameActionRequestFactory } =
    await import("../../../src/game/engine/action_request_factory");
  const f = fixture();
  beginDemonHunterNight(f.world, 2, () => true);
  const scope = openDemonHunterTurn(f.world);
  const events: GameEvent[] = Array.from({ length: 300 }, (_, i) => ({
    timestamp: i,
    type: "day_speech",
    payload: { actorId: 3, text: `speech ${i}` },
  }));
  const request = new GameActionRequestFactory(f.world, events, 2).create({
    phase: Phase.Night,
    actorId: 6,
    allowedTools: ["demon_hunt" as ToolName],
    stage: "demon_hunter" as ActionStage,
    requiresAction: true,
    summary: { key: "request.summary.night_action" },
    context: { allow_fallback: false, action_failure_policy: "error" },
  });
  expect(request.context.visible_events).toHaveLength(300);
  bindDemonHunterRequest(f.world, request);
  expect(demonHunterRequestScope(f.world, request)).toBe(scope);
  expect(commitDemonHunt(f.world, scope, hunt(1))).toEqual({ day: 2, targetId: 1 });
});

async function controllerDependencies() {
  await import("../../../src/app/bootstrap");
  const [
    { ToolGateway },
    { ActionValidator },
    { ToolValidationRuleRegistry },
    { DEMON_HUNTER_TOOL_RULE },
    { executeDemonHunterTurn },
    recorder,
  ] = await Promise.all([
    import("../../../src/game/gateway/tool_gateway"),
    import("../../../src/game/gateway/action_validator"),
    import("../../../src/game/mechanisms/validation/tool_validation_rule_registry"),
    import("../../../src/game/mechanisms/roles/demon_hunter/validation_rules"),
    import("../../../src/game/mechanisms/roles/demon_hunter/controller"),
    import("../../../src/recording/session_recorder"),
  ]);
  return {
    executeDemonHunterTurn,
    recorder,
    gateway: new ToolGateway(
      new ActionValidator(
        new ToolValidationRuleRegistry({ ["demon_hunt" as ToolName]: DEMON_HUNTER_TOOL_RULE }),
      ),
    ),
  };
}
for (const target of [1, 3, null] as const)
  test(`actual controller target ${target}: canonical factory/gateway commit and receipt settle only once`, async () => {
    const f = fixture(),
      { executeDemonHunterTurn, recorder, gateway } = await controllerDependencies(),
      spy = spyOn(recorder, "safeRecordLogicOp").mockImplementation(() => {});
    beginDemonHunterNight(f.world, 2, () => true);
    const receipts: boolean[] = [];
    try {
      const fact = await executeDemonHunterTurn({
        world: f.world,
        gateway,
        events: [],
        day: 2,
        provider: {
          async getAction(request) {
            expect(request.context.turn_constraints).toMatchObject({
              min_valid_actions: 1,
              max_valid_actions: 1,
              required_any_tools: ["demon_hunt"],
            });
            expect(request.context.allow_fallback).toBe(false);
            expect(request.context.action_failure_policy).toBe("error");
            expect(Object.hasOwn(request.context, "requiresAction")).toBe(false);
            expect(
              deferRequestDelivery(request, (accepted) => {
                receipts.push(accepted);
              }),
            ).toBe(true);
            expect(receipts).toEqual([]);
            return hunt(target) as never;
          },
        },
      });
      expect(fact).toEqual({
        policy: "awa_netease_demon_hunter_v1",
        actorId: 6,
        day: 2,
        targetId: target,
      });
      expect(receipts).toEqual([true]);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0]?.[0]).toMatchObject({
        scope: "gateway",
        op: "validate_tool_call",
        actorId: 6,
        phase: Phase.Night,
        status: "ok",
        input: { tool: "demon_hunt", args: { target_id: target, abstain: target === null } },
      });
      expect(freezeDemonHunt(f.world).damage).toEqual(
        target === null
          ? null
          : target === 1
            ? { targetId: 1, cause: "demon_hunt" }
            : { targetId: 6, cause: "demon_hunt_backlash" },
      );
    } finally {
      spy.mockRestore();
    }
  });
for (const kind of ["missing", "self", "extra", "getter", "revoked", "throw"] as const)
  test(`actual controller ${kind} strictly closes without action/op/history or supplement`, async () => {
    const f = fixture(),
      { executeDemonHunterTurn, recorder, gateway } = await controllerDependencies(),
      spy = spyOn(recorder, "safeRecordLogicOp").mockImplementation(() => {});
    let current = true,
      reads = 0;
    beginDemonHunterNight(f.world, 2, () => current);
    const receipts: boolean[] = [];
    try {
      await expect(
        executeDemonHunterTurn({
          world: f.world,
          gateway,
          events: [],
          day: 2,
          provider: {
            async getAction(request) {
              deferRequestDelivery(request, (accepted) => {
                receipts.push(accepted);
              });
              if (kind === "throw") throw new Error("offline_provider_failure");
              if (kind === "missing") return null;
              if (kind === "self") return hunt(6) as never;
              if (kind === "extra")
                return {
                  name: "demon_hunt",
                  args: { target_id: 1, abstain: false, hidden: true },
                } as never;
              if (kind === "getter")
                return {
                  name: "demon_hunt",
                  get args() {
                    reads++;
                    return { target_id: 1, abstain: false };
                  },
                } as never;
              if (kind === "revoked") current = false;
              return hunt(1) as never;
            },
          },
        }),
      ).rejects.toThrow();
      expect(receipts).toEqual([false]);
      expect(spy).not.toHaveBeenCalled();
      expect(reads).toBe(0);
      expect(demonHunterAuditPlayer(f.world, 6)).toEqual({
        demonHunter: { policy: "awa_netease_demon_hunter_v1", history: [] },
      });
      expect(() => openDemonHunterTurn(f.world)).toThrow();
    } finally {
      spy.mockRestore();
    }
  });

for (const mode of ["original", "clone", "copied", "string", "extra", "getter", "proxy"] as const)
  test(`actual ActionReception ${mode}: native scope and canonical args remain strict without mutation`, async () => {
    await controllerDependencies();
    const [
      { ActionReception },
      { ToolSpecRegistry },
      { ToolValidationRuleRegistry },
      { DEMON_HUNTER_TOOL_RULE },
    ] = await Promise.all([
      import("../../../src/ai/agents/player/action_reception"),
      import("../../../src/game/mechanisms/registries/tool_spec_registry"),
      import("../../../src/game/mechanisms/validation/tool_validation_rule_registry"),
      import("../../../src/game/mechanisms/roles/demon_hunter/validation_rules"),
    ]);
    const f = fixture(),
      { request, scope } = turn(f);
    let reads = 0;
    const receive = new ActionReception(
      f.world,
      undefined,
      new ToolSpecRegistry([
        {
          name: "demon_hunt" as ToolName,
          argHint: "Candidate native hunt",
          parameters: {
            type: "object",
            properties: { target_id: { type: ["integer", "null"] }, abstain: { type: "boolean" } },
            required: ["target_id", "abstain"],
            additionalProperties: false,
          },
        },
      ]),
      new ToolValidationRuleRegistry({ ["demon_hunt" as ToolName]: DEMON_HUNTER_TOOL_RULE }),
    );
    const bound =
      mode === "clone"
        ? { ...request, deadlineAtMs: Date.now() + 10000 }
        : mode === "copied"
          ? structuredClone(request)
          : request;
    if (mode === "clone") inheritDemonHunterDeadlineRequest(request, bound);
    const args =
      mode === "string"
        ? { target_id: "1", abstain: false }
        : mode === "extra"
          ? { target_id: 1, abstain: false, hidden: true }
          : mode === "getter"
            ? {
                get target_id() {
                  reads++;
                  return 1;
                },
                abstain: false,
              }
            : mode === "proxy"
              ? new Proxy(
                  { target_id: 1, abstain: false },
                  {
                    ownKeys(t) {
                      reads++;
                      return Reflect.ownKeys(t);
                    },
                    get(t, key) {
                      reads++;
                      return Reflect.get(t, key);
                    },
                  },
                )
              : { target_id: 1, abstain: false };
    const result = receive.validate(bound as never, "demon_hunt", args);
    expect(result.ok).toBe(mode === "original" || mode === "clone");
    expect(reads).toBe(0);
    expect(demonHunterAuditPlayer(f.world, 6)).toEqual({ demonHunter: freshDemonHunterState() });
    expect(f.world.getAliveEntityIds()).toEqual([1, 2, 3, 4, 5, 6]);
    if (result.ok) {
      expect(result.action).toEqual(hunt(1) as never);
      expect(commitDemonHunt(f.world, scope, result.action)).toEqual({ day: 2, targetId: 1 });
    }
    closeDemonHunterTurn(scope);
  });
