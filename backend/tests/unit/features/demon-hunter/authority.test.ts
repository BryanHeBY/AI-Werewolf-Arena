/**
 * 单元测试验证 authority 的原权限和记录边界。输入为原 fixture、请求及显式故障／特权回调；原字面量、引用身份与错误／状态断言为预期。测试注入保留原请求，领域合法性与付款仍由原被测 owner 执行。
 */
import { createCampComponent, createAliveComponent } from "../../../../src/game/observation/component-presentation";
import { expect, test, spyOn } from "bun:test";
import { World, Role, Camp, Phase, COMPONENT, WinCondition, ActionWindow, WitchSelfHealRule, PotionType, StatusMark, StatusMarksComponent, createVictoryComponent, assertRequestDelivery, deferRequestDelivery, bindRequestDeliveryGuard, type BoardConfig, type ActionStage, type ToolName, type GameEvent, type RoleComponent, type AliveComponent } from "../../../../src/core";
import { createRoleComponent } from "../../../../src/game/observation/role-presentation";
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
} from "../../../../src/game/mechanisms/roles/demon_hunter/authority";
import {
  DEMON_HUNTER_ROLE,
  freshDemonHunterState,
} from "../../../../src/game/mechanisms/roles/demon_hunter/state";
import { type NightAbility } from "../../../../src/game/mechanisms/roles/abilities";
import {
  installNativeAbility,
  recordNightAbilityUse,
} from "../../../../src/game/mechanisms/roles/ability_changes";
import {
  captureDemonNativePoison,
  commitDemonNativePoison,
  freezeDemonNativePoison,
  freezeDemonNightSources,
} from "../../../../src/game/mechanisms/roles/demon_hunter/native_poison";
import { NightFaultPlan } from "../../../../src/game/engine/fault_plan";
function fixture(locale: "zh-CN" | "en" = "zh-CN") {
  const world = new World(locale),
    roles = [Role.Wolf, Role.Wolf, Role.Villager, Role.Seer, Role.Witch, DEMON_HUNTER_ROLE as Role];
  for (const kind of roles) {
    const id = world.createEntity(),
      camp = kind === Role.Wolf ? Camp.Wolf : Camp.Good,
      role = createRoleComponent(kind, camp);
    if (String(kind) === DEMON_HUNTER_ROLE)
      (role.privateState as Record<string, unknown>).demonHunter = freshDemonHunterState();
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
  return { world, config, role: world.getComponent(6, COMPONENT.Role)! };
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
      state = (f.role.privateState as { readonly demonHunter?: unknown }).demonHunter,
      { scope } = turn(f);
    expect(commitDemonHunt(f.world, scope, hunt(targetId))).toEqual({ day: 2, targetId });
    expect(f.role).toBe(nativeRole);
    expect(f.role.camp).toBe(Camp.Good);
    expect((f.role.privateState as { readonly demonHunter?: unknown }).demonHunter).toBe(state);
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
  const life = f.world.getComponent(1, COMPONENT.Alive)!;
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
    if (variant === "state")
      (f.role.privateState as Record<string, unknown>).demonHunter = freshDemonHunterState();
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
      (f.role.privateState as Record<string, unknown>).demonHunter = new Proxy(
        (f.role.privateState as { readonly demonHunter?: unknown }).demonHunter as object,
        {
          getPrototypeOf() {
            reads++;
            return Object.prototype;
          },
        },
      );
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
    witch = f.world.getComponent(5, COMPONENT.Role)!;
  const ability = (
    (witch.privateState as { readonly abilities?: unknown }).abilities as Record<
      string,
      NightAbility<"potion">
    >
  )["native:potion"]!;
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
  const original = g.world.getComponent(5, COMPONENT.Role)!;
  (original.privateState as Record<string, unknown>).abilities = new Proxy(
    (original.privateState as { readonly abilities?: unknown }).abilities as object,
    {
      getOwnPropertyDescriptor() {
        reads++;
        return undefined;
      },
      getPrototypeOf() {
        reads++;
        return Object.prototype;
      },
    },
  );
  expect(demonHunterAuditPlayer(g.world, 5)).toEqual(before);
  expect(reads).toBe(0);
});
test("a same-name replacement nested native inventory cannot lend identity to a hunt", () => {
  const f = fixture(),
    { scope } = turn(f);
  const witch = f.world.getComponent(5, COMPONENT.Role)!;
  const stored = (witch.privateState as { readonly abilities?: unknown }).abilities as Record<
    string,
    NightAbility
  >;
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
  (f.role.privateState as Record<string, unknown>).demonHunter = freshDemonHunterState();
  expect(freezeDemonHunt(f.world).damage).toBeNull();
  expect(demonHunterAuditPlayer(f.world, 6)).toEqual({
    demonHunter: { policy: "awa_netease_demon_hunter_v1", history: [{ day: 2, targetId: 1 }] },
  });
});

test("a native nested getter rejects the whole bound action without executing it", () => {
  const f = fixture(),
    { scope } = turn(f);
  const witch = f.world.getComponent(5, COMPONENT.Role)!;
  const ability = (
    (witch.privateState as { readonly abilities?: unknown }).abilities as Record<
      string,
      NightAbility<"potion">
    >
  )["native:potion"]!;
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
  const witch = f.world.getComponent(5, COMPONENT.Role)!;
  const ability = (
    (witch.privateState as { readonly abilities?: unknown }).abilities as Record<
      string,
      NightAbility<"potion">
    >
  )["native:potion"]!;
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
      (f.role.privateState as { readonly demonHunter?: unknown }).demonHunter as {
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
      life = f.world.getComponent(6, COMPONENT.Alive)!;
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
  f.world.getComponent(6, COMPONENT.Alive)!.alive = false;
  beginDemonHunterNight(f.world, 2, () => true);
  expect(() => openDemonHunterTurn(f.world)).toThrow("demon_hunter_turn_unavailable");
  expect(freezeDemonHunt(f.world)).toEqual({ choice: null, damage: null, cancelled: null });
});
function poisonFixture(isCurrent = () => true) {
  const f = fixture(),
    witch = f.world.getComponent(5, COMPONENT.Role)!,
    ability = (
      (witch.privateState as { readonly abilities?: unknown }).abilities as Record<
        string,
        NightAbility<"potion">
      >
    )["native:potion"]!;
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
  f.world.getComponent(5, COMPONENT.Alive)!.alive = false;
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
    witch = f.world.getComponent(5, COMPONENT.Role)!,
    ability = (
      (witch.privateState as { readonly abilities?: unknown }).abilities as Record<
        string,
        NightAbility<"potion">
      >
    )["native:potion"]!;
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
  await import("../../../../src/app/bootstrap");
  const { GameActionRequestFactory } =
    await import("../../../../src/game/engine/action_request_factory");
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
  await import("../../../../src/app/bootstrap");
  const { GameActionRequestFactory } =
    await import("../../../../src/game/engine/action_request_factory");
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
  await import("../../../../src/app/bootstrap");
  const [
    { ToolGateway },
    { ActionValidator },
    { ToolValidationRuleRegistry },
    { DEMON_HUNTER_TOOL_RULE },
    { executeDemonHunterTurn },
    recorder,
  ] = await Promise.all([
    import("../../../../src/game/gateway/tool_gateway"),
    import("../../../../src/game/gateway/action_validator"),
    import("../../../../src/game/mechanisms/validation/tool_validation_rule_registry"),
    import("../../../../src/game/mechanisms/roles/demon_hunter/validation_rules"),
    import("../../../../src/game/mechanisms/roles/demon_hunter/controller"),
    import("../../../../src/recording/session_recorder"),
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
      import("../../../../src/game/gateway/action-reception"),
      import("../../../../src/game/mechanisms/registries/tool_spec_registry"),
      import("../../../../src/game/mechanisms/validation/tool_validation_rule_registry"),
      import("../../../../src/game/mechanisms/roles/demon_hunter/validation_rules"),
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

async function nativeControllerDependencies() {
  await controllerDependencies();
  const [{ executeDemonWitchTurn }, { ToolGateway }, requests, recorder] = await Promise.all([
    import("../../../../src/game/mechanisms/roles/demon_hunter/native_potion_controller"),
    import("../../../../src/game/gateway/tool_gateway"),
    import("../../../../src/game/mechanisms/roles/demon_hunter/native_potion_requests"),
    import("../../../../src/recording/session_recorder"),
  ]);
  return { executeDemonWitchTurn, gateway: new ToolGateway(), requests, recorder };
}
for (const [potion, targetId] of [
  ["poison", 6],
  ["poison", 1],
  ["heal", 3],
  ["none", 5],
] as const)
  test(`actual original Witch ${potion} target ${targetId}: canonical request, real stock, mark and audit commit`, async () => {
    const f = fixture(),
      { executeDemonWitchTurn, gateway, recorder } = await nativeControllerDependencies(),
      events: GameEvent[] = [],
      receipts: boolean[] = [],
      spy = spyOn(recorder, "safeRecordLogicOp").mockImplementation(() => {});
    const marks = new StatusMarksComponent();
    f.world.addComponent(targetId, COMPONENT.StatusMarks, marks);
    if (potion === "heal") marks.add(StatusMark.WolfKillMark);
    beginDemonHunterNight(f.world, 1, () => true);
    try {
      const result = await executeDemonWitchTurn({
        world: f.world,
        gateway,
        events,
        day: 1,
        wolfTarget: 3,
        provider: {
          async getAction(request) {
            expect(request.actorId).toBe(5);
            expect(request.context.stage).toBe("witch");
            expect(request.context.ability_id).toBe("native:potion");
            expect(request.context.wolf_target).toBe(3);
            expect(deferRequestDelivery(request, (accepted) => receipts.push(accepted))).toBe(true);
            expect(receipts).toEqual([]);
            return {
              name: "use_potion",
              args: { target_id: targetId, potion_type: potion as PotionType },
            };
          },
        },
      });
      expect(receipts).toEqual([true]);
      expect(spy).toHaveBeenCalledTimes(1);
      const audit = demonHunterAuditPlayer(f.world, 5)! as {
        abilities: Record<string, NightAbility<"potion">>;
      };
      expect(audit.abilities["native:potion"]!.state.heal).toBe(potion === "heal" ? 0 : 1);
      expect(audit.abilities["native:potion"]!.state.poison).toBe(potion === "poison" ? 0 : 1);
      expect(audit.abilities["native:potion"]!.uses).toBe(potion === "none" ? 0 : 1);
      expect(audit.abilities["native:potion"]!.lastUsedDay).toBe(1);
      expect(result.used).toBe(potion !== "none");
      expect(f.world.getAliveEntityIds()).toEqual([1, 2, 3, 4, 5, 6]);
      expect(events).toHaveLength(1);
      expect(events[0]!.payload).toEqual({
        actorId: 5,
        targetId,
        potionType: potion as PotionType,
      });
      if (potion === "poison") {
        expect(result.poison!.claim.source.id).toBe(5);
        expect(result.poison!.claim.target.id).toBe(targetId);
        expect(result.poison!.sealContribution()).toEqual({
          native: true,
          unknown: false,
        });
        const settlement = freezeDemonNightSources(
          f.world,
          result.poison!.proof ? [result.poison!.proof] : [],
        );
        expect(settlement.poisonImmunities).toEqual(
          targetId === 6
            ? [{ policy: "awa_netease_demon_hunter_v1", actorId: 6, day: 1, witchId: 5 }]
            : [],
        );
      }
      await expect(
        executeDemonWitchTurn({
          world: f.world,
          gateway,
          events,
          day: 1,
          wolfTarget: 3,
          provider: {
            async getAction() {
              throw new Error("must_not_request");
            },
          },
        }),
      ).rejects.toThrow("demon_hunter_native_witch_unavailable");
    } finally {
      spy.mockRestore();
    }
  });
for (const kind of [
  "string",
  "extra",
  "getter",
  "proxy",
  "stock_getter",
  "replace_life",
  "refund",
  "throw",
] as const)
  test(`actual original Witch ${kind}: zero hostile reads, false receipt, no accepted op or inventory adoption`, async () => {
    const f = fixture(),
      { executeDemonWitchTurn, gateway, recorder } = await nativeControllerDependencies(),
      events: GameEvent[] = [],
      receipts: boolean[] = [],
      spy = spyOn(recorder, "safeRecordLogicOp").mockImplementation(() => {});
    beginDemonHunterNight(f.world, 1, () => true);
    const before = demonHunterAuditPlayer(f.world, 5);
    let reads = 0;
    try {
      await expect(
        executeDemonWitchTurn({
          world: f.world,
          gateway,
          events,
          day: 1,
          wolfTarget: 3,
          provider: {
            async getAction(request) {
              deferRequestDelivery(request, (accepted) => receipts.push(accepted));
              const ability = (
                (
                  f.world.getComponent(5, COMPONENT.Role)!.privateState as {
                    readonly abilities?: unknown;
                  }
                ).abilities as Record<string, NightAbility<"potion">>
              )["native:potion"]!;
              if (kind === "throw") throw new Error("offline_failure");
              if (kind === "stock_getter")
                Object.defineProperty(ability.state, "poison", {
                  get() {
                    reads++;
                    return 1;
                  },
                  enumerable: true,
                  configurable: true,
                });
              if (kind === "replace_life")
                f.world.addComponent(5, COMPONENT.Alive, createAliveComponent());
              if (kind === "refund") ability.state.poison = 2;
              const args =
                kind === "string"
                  ? { target_id: "6", potion_type: "poison" }
                  : kind === "extra"
                    ? { target_id: 6, potion_type: "poison", hidden: true }
                    : kind === "getter"
                      ? {
                          get target_id() {
                            reads++;
                            return 6;
                          },
                          potion_type: "poison",
                        }
                      : kind === "proxy"
                        ? new Proxy(
                            { target_id: 6, potion_type: "poison" },
                            {
                              ownKeys(t) {
                                reads++;
                                return Reflect.ownKeys(t);
                              },
                              get(t, k) {
                                reads++;
                                return Reflect.get(t, k);
                              },
                            },
                          )
                        : { target_id: 6, potion_type: "poison" };
              return { name: "use_potion", args } as never;
            },
          },
        }),
      ).rejects.toThrow();
      expect(reads).toBe(0);
      expect(receipts).toEqual([false]);
      expect(spy).not.toHaveBeenCalled();
      expect(events).toEqual([]);
      expect(demonHunterAuditPlayer(f.world, 5)).toEqual(before);
    } finally {
      spy.mockRestore();
    }
  });
test("actual original Witch pass → heal → poison: exact cross-night cache and irreversible stock", async () => {
  const f = fixture(),
    { executeDemonWitchTurn, gateway } = await nativeControllerDependencies();
  for (const [day, potion, targetId] of [
    [1, "none", 5],
    [2, "heal", 3],
    [3, "poison", 6],
  ] as const) {
    beginDemonHunterNight(f.world, day, () => true);
    if (potion === "heal") {
      const marks = new StatusMarksComponent();
      marks.add(StatusMark.WolfKillMark);
      f.world.addComponent(3, COMPONENT.StatusMarks, marks);
    }
    const result = await executeDemonWitchTurn({
      world: f.world,
      gateway,
      events: [],
      day,
      wolfTarget: 3,
      provider: {
        async getAction() {
          return {
            name: "use_potion",
            args: { target_id: targetId, potion_type: potion as PotionType },
          };
        },
      },
    });
    if (day >= 2) {
      const scope = openDemonHunterTurn(f.world);
      const request: DemonHunterRequest = {
        actorId: 6,
        phase: Phase.Night,
        allowedTools: ["demon_hunt"],
        context: {
          day,
          stage: "demon_hunter",
          allow_fallback: false,
          action_failure_policy: "error",
          turn_constraints: {
            min_valid_actions: 1,
            max_valid_actions: 1,
            required_any_tools: ["demon_hunt"],
          },
        },
      };
      bindDemonHunterRequest(f.world, request);
      expect(commitDemonHunt(f.world, scope, hunt(null))).toEqual({ day, targetId: null });
    }
    if (result.poison?.proof) {
      expect(result.poison.sealContribution()).toEqual({ native: true, unknown: false });
      expect(freezeDemonNightSources(f.world, [result.poison.proof]).poisonImmunities).toHaveLength(
        1,
      );
    } else freezeDemonNightSources(f.world, []);
    closeDemonHunterNight(f.world);
  }
  const audit = demonHunterAuditPlayer(f.world, 5) as {
    abilities: Record<string, NightAbility<"potion">>;
  };
  expect(audit.abilities["native:potion"]!.uses).toBe(2);
  expect(audit.abilities["native:potion"]!.state.heal).toBe(0);
  expect(audit.abilities["native:potion"]!.state.poison).toBe(0);
  const ability = (
    (
      f.world.getComponent(5, COMPONENT.Role)!.privateState as {
        readonly abilities?: unknown;
      }
    ).abilities as Record<string, NightAbility<"potion">>
  )["native:potion"]!;
  ability.state.poison = 1;
  ability.uses = 1;
  beginDemonHunterNight(f.world, 4, () => true);
  await expect(
    executeDemonWitchTurn({
      world: f.world,
      gateway,
      events: [],
      day: 4,
      wolfTarget: null,
      provider: {
        async getAction() {
          throw new Error("must_not_request");
        },
      },
    }),
  ).rejects.toThrow("demon_hunter_native_witch_unavailable");
  expect(demonHunterAuditPlayer(f.world, 5)).toEqual(audit);
});

for (const kind of [
  "native",
  "unknown_before",
  "unknown_after",
  "removed",
  "removed_readded",
  "replaced_marks",
  "source_revoked",
  "target_revoked",
  "source_getter",
] as const)
  test(`delivered native source ${kind}: paired immunity preserves independent toxins before any Alive write`, async () => {
    const f = fixture(),
      { executeDemonWitchTurn, gateway } = await nativeControllerDependencies(),
      { sealDeliveredDemonWitchSources, freezeDeliveredDemonNightSources } =
        await import("../../../../src/game/mechanisms/roles/demon_hunter/native_potion_controller");
    const marks = new StatusMarksComponent();
    f.world.addComponent(6, COMPONENT.StatusMarks, marks);
    if (kind === "unknown_before") marks.add(StatusMark.PoisonMark);
    beginDemonHunterNight(f.world, 1, () => true);
    await executeDemonWitchTurn({
      world: f.world,
      gateway,
      events: [],
      day: 1,
      wolfTarget: null,
      provider: {
        async getAction() {
          return { name: "use_potion", args: { target_id: 6, potion_type: PotionType.Poison } };
        },
      },
    });
    if (kind === "unknown_after") marks.add(StatusMark.PoisonMark);
    if (kind === "removed" || kind === "removed_readded") marks.remove(StatusMark.PoisonMark);
    if (kind === "removed_readded") marks.add(StatusMark.PoisonMark);
    if (kind === "replaced_marks") {
      const replacement = new StatusMarksComponent();
      replacement.add(StatusMark.PoisonMark);
      f.world.addComponent(6, COMPONENT.StatusMarks, replacement);
    }
    const token = sealDeliveredDemonWitchSources(f.world, 1);
    marks.clear(); // Ordinary DamageResolution consumes marks between seal and final source freeze.
    if (kind === "source_revoked") f.world.addComponent(5, COMPONENT.Alive, createAliveComponent());
    if (kind === "target_revoked") f.world.addComponent(6, COMPONENT.Alive, createAliveComponent());
    let reads = 0;
    if (kind === "source_getter") {
      const a = (
        (
          f.world.getComponent(5, COMPONENT.Role)!.privateState as {
            readonly abilities?: unknown;
          }
        ).abilities as Record<string, NightAbility<"potion">>
      )["native:potion"]!;
      Object.defineProperty(a.state, "poison", {
        get() {
          reads++;
          return 0;
        },
        enumerable: true,
        configurable: true,
      });
    }
    const result = freezeDeliveredDemonNightSources(f.world, token);
    const immune = kind === "native" || kind === "unknown_before",
      unknown = ["unknown_before", "unknown_after", "removed_readded", "replaced_marks"].includes(
        kind,
      );
    expect(result.poisonImmunities).toEqual(
      immune ? [{ policy: "awa_netease_demon_hunter_v1", actorId: 6, day: 1, witchId: 5 }] : [],
    );
    expect(result.poisonOverrides).toEqual([{ targetId: 6, poison: unknown }]);
    expect(reads).toBe(0);
    expect(f.world.getAliveEntityIds()).toEqual([1, 2, 3, 4, 5, 6]);
    expect(
      (demonHunterAuditPlayer(f.world, 5) as { abilities: Record<string, NightAbility<"potion">> })
        .abilities["native:potion"]!.state.poison,
    ).toBe(0);
    await expect(
      Promise.resolve().then(() => freezeDeliveredDemonNightSources(f.world, token)),
    ).rejects.toThrow();
  });
test("delivered source seal cannot invent, copy, omit or cross Worlds", async () => {
  const f = fixture(),
    other = fixture(),
    { executeDemonWitchTurn, gateway } = await nativeControllerDependencies(),
    { sealDeliveredDemonWitchSources, freezeDeliveredDemonNightSources } =
      await import("../../../../src/game/mechanisms/roles/demon_hunter/native_potion_controller");
  beginDemonHunterNight(f.world, 1, () => true);
  beginDemonHunterNight(other.world, 1, () => true);
  expect(() => sealDeliveredDemonWitchSources(f.world, 1)).toThrow(
    "demon_hunter_native_sources_missing",
  );
  await executeDemonWitchTurn({
    world: f.world,
    gateway,
    events: [],
    day: 1,
    wolfTarget: null,
    provider: {
      async getAction() {
        return { name: "use_potion", args: { target_id: 6, potion_type: PotionType.Poison } };
      },
    },
  });
  const token = sealDeliveredDemonWitchSources(f.world, 1);
  expect(() => freezeDeliveredDemonNightSources(other.world, token)).toThrow(
    "demon_hunter_native_sources_invalid",
  );
  expect(() => freezeDeliveredDemonNightSources(f.world, {})).toThrow(
    "demon_hunter_native_sources_invalid",
  );
  expect(() => sealDeliveredDemonWitchSources(f.world, 1)).toThrow(
    "demon_hunter_native_sources_already_sealed",
  );
  expect(freezeDeliveredDemonNightSources(f.world, token).poisonImmunities).toHaveLength(1);
});
for (const kind of [
  "target_getter",
  "target_proxy",
  "marks_add_getter",
  "marks_has_getter",
  "stock_readonly",
  "uses_readonly",
  "day_readonly",
  "flag_readonly",
] as const)
  test(`actual Witch precommit ${kind}: preflight and controller refuse before first native write`, async () => {
    const f = fixture(),
      { executeDemonWitchTurn, gateway, recorder } = await nativeControllerDependencies(),
      { ActionReception } = await import("../../../../src/game/gateway/action-reception"),
      receipts: boolean[] = [],
      before = demonHunterAuditPlayer(f.world, 5),
      spy = spyOn(recorder, "safeRecordLogicOp").mockImplementation(() => {});
    const marks = new StatusMarksComponent();
    f.world.addComponent(6, COMPONENT.StatusMarks, marks);
    let reads = 0;
    beginDemonHunterNight(f.world, 1, () => true);
    try {
      await expect(
        executeDemonWitchTurn({
          world: f.world,
          gateway,
          events: [],
          day: 1,
          wolfTarget: null,
          provider: {
            async getAction(request) {
              deferRequestDelivery(request, (ok) => receipts.push(ok));
              const ability = (
                (
                  f.world.getComponent(5, COMPONENT.Role)!.privateState as {
                    readonly abilities?: unknown;
                  }
                ).abilities as Record<string, NightAbility<"potion">>
              )["native:potion"]!;
              if (kind === "target_getter")
                Object.defineProperty(
                  f.world.getComponent(6, COMPONENT.Alive)!,
                  "alive",
                  {
                    get() {
                      reads++;
                      return true;
                    },
                    configurable: true,
                    enumerable: true,
                  },
                );
              if (kind === "target_proxy")
                f.world.addComponent(
                  6,
                  COMPONENT.Alive,
                  new Proxy(createAliveComponent(), {
                    get(t, k) {
                      reads++;
                      return Reflect.get(t, k);
                    },
                  }),
                );
              if (kind === "marks_add_getter" || kind === "marks_has_getter")
                Object.defineProperty(marks, kind === "marks_add_getter" ? "add" : "has", {
                  get() {
                    reads++;
                    return () => {};
                  },
                  configurable: true,
                });
              if (kind === "stock_readonly")
                Object.defineProperty(ability.state, "poison", { writable: false });
              if (kind === "uses_readonly")
                Object.defineProperty(ability, "uses", { writable: false });
              if (kind === "day_readonly")
                Object.defineProperty(ability, "lastUsedDay", { writable: false });
              if (kind === "flag_readonly")
                Object.defineProperty(ability.state, "poisonUsedThisNight", { writable: false });
              expect(
                new ActionReception(f.world).validate(request, "use_potion", {
                  target_id: 6,
                  potion_type: PotionType.Poison,
                }).ok,
              ).toBe(false);
              return { name: "use_potion", args: { target_id: 6, potion_type: PotionType.Poison } };
            },
          },
        }),
      ).rejects.toThrow();
      expect(reads).toBe(0);
      expect(receipts).toEqual([false]);
      expect(spy).not.toHaveBeenCalled();
      expect(demonHunterAuditPlayer(f.world, 5)).toEqual(before);
      const ability = (
        (
          f.world.getComponent(5, COMPONENT.Role)!.privateState as {
            readonly abilities?: unknown;
          }
        ).abilities as Record<string, NightAbility<"potion">>
      )["native:potion"]!;
      expect(ability.uses).toBe(0);
      expect(ability.lastUsedDay).toBeNull();
      expect(ability.state.poison).toBe(1);
    } finally {
      spy.mockRestore();
    }
  });
for (const field of ["phase", "actorId", "allowedTools", "context", "deadlineAtMs"] as const)
  test(`actual Witch clone invalidates with original ${field} edit`, async () => {
    const f = fixture(),
      { executeDemonWitchTurn, gateway, requests } = await nativeControllerDependencies(),
      { ActionReception } = await import("../../../../src/game/gateway/action-reception"),
      receipts: boolean[] = [];
    beginDemonHunterNight(f.world, 1, () => true);
    await expect(
      executeDemonWitchTurn({
        world: f.world,
        gateway,
        events: [],
        day: 1,
        wolfTarget: null,
        provider: {
          async getAction(request) {
            const clone = { ...request, deadlineAtMs: Date.now() + 10000 };
            requests.inheritDemonWitchDeadlineRequest(request, clone);
            expect(requests.demonWitchRequestCurrent(f.world, clone)).toBe(true);
            expect(deferRequestDelivery(clone, (ok) => receipts.push(ok))).toBe(true);
            if (field === "phase") request.phase = Phase.Day;
            if (field === "actorId") request.actorId = 1;
            if (field === "allowedTools") request.allowedTools = ["check_identity"];
            if (field === "context") request.context = { ...request.context };
            if (field === "deadlineAtMs") request.deadlineAtMs = Date.now() + 20000;
            expect(requests.demonWitchRequestCurrent(f.world, clone)).toBe(false);
            expect(() => assertRequestDelivery(clone)).toThrow(
              "action_request_delivery_authority_revoked",
            );
            expect(
              new ActionReception(f.world).validate(clone, "use_potion", {
                target_id: 6,
                potion_type: PotionType.Poison,
              }).ok,
            ).toBe(false);
            return { name: "use_potion", args: { target_id: 6, potion_type: PotionType.Poison } };
          },
        },
      }),
    ).rejects.toThrow("demon_hunter_native_witch_revoked");
    expect(receipts).toEqual([false]);
  });
test("actual Witch gateway-time body replacement cannot be captured as a new authorized target", async () => {
  const f = fixture(),
    { executeDemonWitchTurn, gateway } = await nativeControllerDependencies();
  beginDemonHunterNight(f.world, 1, () => true);
  const original = gateway.validateAndSanitize.bind(gateway),
    spy = spyOn(gateway, "validateAndSanitize").mockImplementation((world, id, call, context) => {
      const checked = original(world, id, call, context);
      world.addComponent(6, COMPONENT.Alive, createAliveComponent());
      return checked;
    });
  try {
    await expect(
      executeDemonWitchTurn({
        world: f.world,
        gateway,
        events: [],
        day: 1,
        wolfTarget: null,
        provider: {
          async getAction() {
            return { name: "use_potion", args: { target_id: 6, potion_type: PotionType.Poison } };
          },
        },
      }),
    ).rejects.toThrow("demon_hunter_native_witch_invalid");
    expect(
      (demonHunterAuditPlayer(f.world, 5) as { abilities: Record<string, NightAbility<"potion">> })
        .abilities["native:potion"]!.uses,
    ).toBe(0);
  } finally {
    spy.mockRestore();
  }
});
test("delivered source life wrappers are immutable while actual factory Alive remains mutable", async () => {
  const f = fixture(),
    { executeDemonWitchTurn, gateway } = await nativeControllerDependencies(),
    { sealDeliveredDemonWitchSources, freezeDeliveredDemonNightSources } =
      await import("../../../../src/game/mechanisms/roles/demon_hunter/native_potion_controller");
  beginDemonHunterNight(f.world, 1, () => true);
  const result = await executeDemonWitchTurn({
    world: f.world,
    gateway,
    events: [],
    day: 1,
    wolfTarget: null,
    provider: {
      async getAction() {
        return { name: "use_potion", args: { target_id: 6, potion_type: PotionType.Poison } };
      },
    },
  });
  expect(Object.isFrozen(result.poison!.claim.source)).toBe(true);
  expect(Object.isFrozen(result.poison!.claim.target)).toBe(true);
  expect(() => Object.defineProperty(result.poison!.claim.target, "id", { value: 1 })).toThrow();
  const token = sealDeliveredDemonWitchSources(f.world, 1),
    sources = freezeDeliveredDemonNightSources(f.world, token);
  expect(sources.poisonOverrides).toEqual([{ targetId: 6, poison: false }]);
  result.poison!.claim.source.life.alive = false;
  expect(sources.poisonImmunities).toHaveLength(1);
});
for (const transport of ["sdk", "acp"] as const)
  for (const locale of ["zh-CN", "en"] as const)
    for (const outcome of ["valid", "invalid", "missing"] as const)
      test(`actual ${transport} provider path/${locale}/${outcome}: Witch commit owns receipt and strict failures never fallback`, async () => {
        const f = fixture(locale),
          { executeDemonWitchTurn, gateway } = await nativeControllerDependencies(),
          { LlmActionProvider } = await import("../../../../src/ai/agents/llm/llm_action_provider"),
          { AcpActionProvider } = await import("../../../../src/ai/agents/acp/acp_action_provider");
        let fallbackCalls = 0,
          submits = 0;
        const privilegedFallbackProvider = {
          async getAction() {
            fallbackCalls++;
            return null;
          },
        };
        const client: import("../../../../src/ai/integrations/llm/transport").ChatModelClient = {
          async chat() {
            throw new Error("unexpected_chat");
          },
          async runToolLoop<T>(
            _messages: import("../../../../src/ai/integrations/llm/transport").ChatMessage[],
            _tools: import("../../../../src/ai/integrations/llm/transport").ToolSchema[],
            callbacks: import("../../../../src/ai/integrations/llm/transport").ToolLoopCallbacks<T>,
          ) {
            if (outcome !== "missing")
              for (let i = 0; i < (outcome === "valid" ? 1 : 3); i++) {
                const result = await callbacks.onToolCall({
                  id: `call-${i}`,
                  name: "submit_action",
                  rawArgs: "{}",
                  args: {
                    turn_id: "t1",
                    action: "use_potion",
                    arguments: {
                      target_id: outcome === "valid" ? 6 : "6",
                      potion_type: PotionType.Poison,
                    },
                  },
                });
                submits++;
                if (result.finalAction)
                  return { finalAction: result.finalAction, assistantText: "Done" };
              }
            return { finalAction: null, assistantText: "Done" };
          },
        };
        const provider =
          transport === "sdk"
            ? new LlmActionProvider(f.world, client, {
                boardConfig: f.config,
                privilegedFallbackProvider,
                maxConcurrentRequests: 1,
                printLlmIo: false,
                printThinking: false,
                trace: false,
                llmTimeoutMs: 1000,
              })
            : new AcpActionProvider(f.world, {
                boardConfig: f.config,
                privilegedFallbackProvider,
                maxConcurrentRequests: 1,
                turnTimeoutMs: 1000,
                printLlmIo: false,
                printThinking: false,
                trace: false,
                sessionFactory: {
                  async createSession(input) {
                    return {
                      sessionId: "demon-witch-stub",
                      async prompt() {
                        if (outcome !== "missing")
                          for (let i = 0; i < (outcome === "valid" ? 1 : 3); i++) {
                            input.registry.submitAction("demon-witch-stub", {
                              turn_id: "t1",
                              action: "use_potion",
                              arguments: {
                                target_id: outcome === "valid" ? 6 : "6",
                                potion_type: PotionType.Poison,
                              },
                            });
                            submits++;
                          }
                      },
                      async cancel() {},
                      async close() {},
                    };
                  },
                },
              });
        beginDemonHunterNight(f.world, 1, () => true);
        try {
          const result = executeDemonWitchTurn({
            world: f.world,
            gateway,
            events: [],
            provider,
            day: 1,
            wolfTarget: null,
          });
          if (outcome === "valid") expect((await result).used).toBe(true);
          else await expect(result).rejects.toThrow();
          expect(fallbackCalls).toBe(0);
          expect(submits).toBe(outcome === "valid" ? 1 : outcome === "invalid" ? 3 : 0);
          const audit = demonHunterAuditPlayer(f.world, 5) as {
            abilities: Record<string, NightAbility<"potion">>;
          };
          expect(audit.abilities["native:potion"]!.state.poison).toBe(outcome === "valid" ? 0 : 1);
          expect(audit.abilities["native:potion"]!.uses).toBe(outcome === "valid" ? 1 : 0);
        } finally {
          await provider.close();
        }
      });
test("delivered immunity keeps a new toxin written after ordinary marks consumption", async () => {
  const f = fixture(),
    { executeDemonWitchTurn, gateway } = await nativeControllerDependencies(),
    { sealDeliveredDemonWitchSources, freezeDeliveredDemonNightSources } =
      await import("../../../../src/game/mechanisms/roles/demon_hunter/native_potion_controller");
  beginDemonHunterNight(f.world, 1, () => true);
  await executeDemonWitchTurn({
    world: f.world,
    gateway,
    events: [],
    day: 1,
    wolfTarget: null,
    provider: {
      async getAction() {
        return { name: "use_potion", args: { target_id: 6, potion_type: PotionType.Poison } };
      },
    },
  });
  const token = sealDeliveredDemonWitchSources(f.world, 1),
    marks = f.world.getComponent(6, COMPONENT.StatusMarks)!;
  marks.clear();
  marks.add(StatusMark.PoisonMark);
  const result = freezeDeliveredDemonNightSources(f.world, token);
  expect(result.poisonImmunities).toHaveLength(1);
  expect(result.poisonOverrides).toEqual([{ targetId: 6, poison: true }]);
});
