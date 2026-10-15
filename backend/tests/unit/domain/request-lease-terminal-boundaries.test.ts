/**
 * 单元测试核对四个真实窗口的 F02 终态、别名隔离、最早期限与领域付款结算。
 * 输入为 canonical bootstrap 板子和手写 Provider／setter／通知故障；输出由原引用、字面状态、
 * 同一 Error、库存前缀及真实 delivery/Trace 结果核对。只写测试自有对象，不运行整局或模型；
 * 初始身份这里只执行盗贼，千面人共用窗口是源码范围，不冒称其独立场景已运行。
 */
import { expect, test, spyOn } from "bun:test";
import { RULESET } from "@ai-werewolf-arena/game-catalog";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { COMPONENT, Role, Camp, Phase, createRandom, type World, type ActionRequest, type GameEvent, type ToolCall } from "../../../src/domain";
import type { ActionRequestFactoryConstructorPort } from "../../../src/domain/actions";
import { RequestLease } from "../../../src/domain/request-lease";
import { assertRequestDelivery, deferRequestDelivery, inheritRequestAlias } from "../../../src/domain/request-delivery";
import { foxBoard } from "../../support/features/cursed-fox/builders/scenario";
import { GameActionRequestFactory } from "../../../src/engine/actions/action-request-factory";
import { ToolGateway } from "../../../src/engine/actions/tool-gateway";
import { InitialIdentitySetupWindow, initialIdentityRequestScope } from "../../../src/features/initial-identity/setup";
import { WildChildSetupWindow } from "../../../src/features/wild-child/setup";
import { wildChildRequestScope } from "../../../src/features/wild-child/lifecycle";
import { LonelyGirlSetupWindow } from "../../../src/features/lonely-girl/setup";
import { lonelyGirlRequestScope } from "../../../src/features/lonely-girl/lifecycle";
import { WallNotesWindow } from "../../../src/features/wall-notes/window";
import { wallRequestScope } from "../../../src/features/wall-notes/authority";
import { ReproductionTrace } from "../../../src/recording/reproduction/trace";
import type { ReproductionMetadata } from "../../../src/recording/reproduction/format";
import { captureCheckpoint } from "../../../src/app/simulation/reproduction-context";

type Kind = "initial" | "wild" | "lonely" | "wall";
function fixture(kind: Kind) {
  const roles = kind === "initial" ? [Role.Thief, Role.Wolf, Role.Wolf, Role.Seer, Role.Witch, Role.Hunter]
    : kind === "wild" ? [Role.WildChild, Role.Wolf, Role.Wolf, Role.Seer, Role.Witch, Role.Hunter]
    : kind === "lonely" ? [Role.LonelyGirl, Role.Wolf, Role.Wolf, Role.Seer, Role.Witch, Role.Villager]
    : [Role.Wolf, Role.Seer, Role.Witch, Role.Hunter, Role.Villager, Role.Villager];
  const fixed = kind === "initial" ? [Role.Thief, Role.Wolf, Role.Witch, Role.Hunter, Role.Villager, Role.Villager, Role.Wolf, Role.Seer] : roles;
  const config = { ...foxBoard(roles), ...(kind === "wall" ? { events: { pack: "awa_wall_notes_once_v1" as const } } : {}) };
  const game = bootstrapGame(config, { fixedRoles: fixed, random: createRandom(`f02-target-${kind}`) });
  const events: GameEvent[] = [];
  let current = true;
  const query = (request: ActionRequest, world: World = game.world) => kind === "initial" ? initialIdentityRequestScope(world, request)
    : kind === "wild" ? wildChildRequestScope(world, request)
    : kind === "lonely" ? lonelyGirlRequestScope(world, request) : wallRequestScope(world, request);
  const action: ToolCall = kind === "initial" ? { name: "choose_thief_card", args: { slot: 0 } }
    : kind === "wild" ? { name: "choose_wild_model", args: { target_id: 2 } }
    : kind === "lonely" ? { name: "choose_admired_player", args: { target_id: 2 } }
    : { name: "write_note", args: { text: "literal F02 note" } };
  async function run(getAction: (request: ActionRequest) => Promise<ToolCall | null>, constructor: ActionRequestFactoryConstructorPort = GameActionRequestFactory) {
    const construction = { get requestFactory() { return constructor; } }, gateway = new ToolGateway();
    if (kind === "initial") return new InitialIdentitySetupWindow(game.world, gateway, events, "thief", construction).execute(game.boardConfig, { getAction }, 1, () => current);
    if (kind === "wild") return new WildChildSetupWindow(game.world, gateway, events, construction).execute(game.boardConfig, { getAction }, 1, () => current);
    if (kind === "lonely") return new LonelyGirlSetupWindow(game.world, gateway, events, construction).execute(game.boardConfig, { getAction }, 1, () => current);
    return new WallNotesWindow(game.world, gateway, events).execute(game.boardConfig, new constructor(game.world, events, 1), { getAction }, 1, () => current, () => createRandom("f02-note-order"));
  }
  return { ...game, roles, events, action, query, run, changeCurrent: (value: boolean) => { current = value; } };
}

for (const kind of ["initial", "wild", "lonely", "wall"] as const) {
  test(`real ${kind} original stage/context/domain observation remains closed after restoration`, async () => {
    // 每种失配用新的真实窗口；不能在已关闭样本继续冒称另一种失配被独立核过。
    for (const change of ["stage", "context", "domain"] as const) {
      const game = fixture(kind), notifications: boolean[] = [];
      let original!: ActionRequest;
      const result = await game.run(async (request) => {
        if (request.actorId !== 1) return null;
        original = request;
        expect(game.query(request)).toBeDefined();
        expect(deferRequestDelivery(request, (accepted) => notifications.push(accepted))).toBe(true);
        const context = request.context, stage = context.stage;
        if (change === "stage") context.stage = "literal-invalid-stage" as typeof stage;
        else if (change === "context") request.context = { ...context };
        else game.changeCurrent(false);
        expect(game.query(request)).toBeUndefined();
        context.stage = stage;
        request.context = context;
        game.changeCurrent(true);
        expect(game.query(request)).toBeUndefined();
        expect(() => assertRequestDelivery(request)).toThrow("action_request_delivery_authority_revoked");
        return game.action;
      });
      expect(result).toBe(kind === "wall" ? undefined : false);
      expect(notifications).toEqual([false]);
      expect(game.query(original)).toBeUndefined();
      expect(game.events.some((event) => event.type === "thief_identity_chosen" || event.type === "wild_child_model_chosen" || event.type === "lonely_girl_admired_chosen" || event.type === "wall_note_changed" && event.payload.actorId === 1 && event.payload.operation === "accepted")).toBe(false);
    }
  });

  test(`real ${kind} retired alias and foreign input do not poison original payment`, async () => {
    const game = fixture(kind), foreign = fixture(kind), notifications: boolean[] = [];
    let original!: ActionRequest, alias!: ActionRequest;
    await game.run(async (request) => {
      if (request.actorId !== 1) return null;
      original = request;
      const scope = game.query(request), context = request.context;
      alias = { ...request, deadlineAtMs: Date.now() + 30_000 };
      inheritRequestAlias(request, alias);
      expect(game.query(alias)).toBe(scope);
      expect(deferRequestDelivery(alias, (accepted) => notifications.push(accepted))).toBe(true);
      alias.context = { ...context };
      // 正确记录之外先拒绝，坏 alias 自己的 context 失配也不得读取 original getter。
      const descriptor = Object.getOwnPropertyDescriptor(request, "actorId")!, failure = new Error("literal-original-getter"), bad = { ...alias };
      let reads = 0;
      try {
        Object.defineProperty(request, "actorId", { enumerable: true, configurable: true, get() { reads++; throw failure; } });
        expect(game.query(request, foreign.world)).toBeUndefined();
        expect(game.query(bad)).toBeUndefined();
        expect(game.query(alias)).toBeUndefined();
        expect(reads).toBe(0);
      } finally { Object.defineProperty(request, "actorId", descriptor); }
      alias.context = context;
      expect(game.query(alias)).toBeUndefined();
      expect(game.query(request)).toBe(scope);
      expect(() => assertRequestDelivery(request)).not.toThrow();
      return game.action;
    });
    expect(notifications).toEqual([true]);
    expect(game.query(original)).toBeUndefined();
    expect(game.query(alias)).toBeUndefined();
  });
}

test("real Wild pre-open and post-open aliases share earliest expiry without clock rollback revival", async () => {
  const game = fixture("wild"), notifications: boolean[] = [];
  let now = 1000, early!: ActionRequest, tighter!: ActionRequest;
  const clock = spyOn(Date, "now").mockImplementation(() => now);
  class PreAliasedFactory extends GameActionRequestFactory {
    override create(input: Parameters<GameActionRequestFactory["create"]>[0]) {
      const original = super.create(input);
      early = { ...original, deadlineAtMs: 5000 };
      inheritRequestAlias(original, early);
      return original;
    }
  }
  try {
    expect(await game.run(async (request) => {
      const scope = game.query(request);
      expect(game.query(early)).toBe(scope);
      expect(() => assertRequestDelivery(early)).not.toThrow();
      expect(deferRequestDelivery(early, (accepted) => notifications.push(accepted))).toBe(true);
      tighter = { ...request, deadlineAtMs: 2000 };
      inheritRequestAlias(request, tighter);
      expect(game.query(tighter)).toBe(scope);
      for (const deadlineAtMs of [NaN, Infinity, 0, 6000]) {
        const bad = { ...request, deadlineAtMs };
        inheritRequestAlias(request, bad);
        expect(game.query(bad)).toBeUndefined();
        expect(game.query(request)).toBe(scope);
      }
      now = 2000;
      expect(game.query(early)).toBeUndefined();
      now = 1000;
      expect(game.query(request)).toBeUndefined();
      expect(game.query(tighter)).toBeUndefined();
      expect(() => assertRequestDelivery(early)).toThrow("action_request_delivery_authority_revoked");
      return game.action;
    }, PreAliasedFactory)).toBe(false);
    expect(notifications).toEqual([false]);
  } finally { clock.mockRestore(); }
});

test("real Initial partial Role payment keeps prefix and original error over false notification", async () => {
  const game = fixture("initial"), failure = new Error("literal-Camp-install"), notification = new Error("literal-false-notify"), results: boolean[] = [];
  const original = game.world.addComponent;
  Object.defineProperty(game.world, "addComponent", { value: function (id: number, key: string, value: unknown) {
    if (id === 1 && key === COMPONENT.Camp) throw failure;
    return (original as Function).call(this, id, key, value);
  } });
  await expect(game.run(async (request) => {
    expect(deferRequestDelivery(request, (accepted) => { results.push(accepted); throw notification; })).toBe(true);
    return game.action;
  })).rejects.toBe(failure);
  expect(results).toEqual([false]);
  expect(game.world.getComponent(1, COMPONENT.Role)!.role).toBe(Role.Wolf);
  expect(game.world.getComponent(1, COMPONENT.Camp)!.camp).toBe(Camp.Good);
  expect(game.events.some((event) => event.type === "thief_identity_chosen")).toBe(false);
});

test("real Lonely Trace remains pending through await and true after late completion notification failure", async () => {
  const game = fixture("lonely"), failure = new Error("literal-true-notify");
  let trace!: ReproductionTrace;
  trace = new ReproductionTrace({
    engine: { id: "awa-engine", sourceHash: "a".repeat(64), lockHash: "b".repeat(64) },
    random: game.random.metadata, ruleset: RULESET, boardId: "f02_terminal", normalizedBoard: structuredClone(game.boardConfig) as ReproductionMetadata["normalizedBoard"],
    locale: "zh-CN", maxDays: 1, dealMode: "fixed", players: game.roles.map((role, index) => ({ id: index + 1, name: `Player ${index + 1}`, role, camp: role === Role.Wolf ? Camp.Wolf : Camp.Good })),
  }, () => { if (trace.settlementCount > 0) throw failure; });
  trace.checkpoint(captureCheckpoint(game.world, game.phaseManager.getSnapshot(), 0, true, 0), []);
  await expect(game.run(async (request) => {
    const call = await trace.decide(request, { getAction: async () => game.action });
    expect(trace.build().decisions[0]!.outcome.kind).toBe("pending");
    return call;
  })).rejects.toBe(failure);
  expect(trace.settlementCount).toBe(1);
  expect(trace.build().decisions[0]!.outcome).toEqual({ kind: "action", action: game.action });
  expect(game.world.getComponent(1, COMPONENT.Camp)!.camp).toBe(Camp.Good);
  expect(game.world.getComponent(1, COMPONENT.Victory)!.affiliations).toEqual([{ kind: "faction", faction: Camp.Wolf }]);
  expect(game.events.some((event) => event.type === "lonely_girl_admired_chosen")).toBe(false);
});

test("real Wall partial second write closes each author and cleanup error outranks new false notifications", async () => {
  const game = fixture("wall"), payment = new Error("literal-second-note-write"), cleanup = new Error("literal-expired-fact"), notification = new Error("literal-false-note-notify"), results: Array<[number, boolean]> = [];
  const push = game.events.push;
  game.events.push = function (...events) {
    if (events.some((event) => event.type === "wall_note_changed" && event.payload.operation === "expired")) throw cleanup;
    return push.apply(this, events);
  };
  await expect(game.run(async (request) => {
    expect(deferRequestDelivery(request, (accepted) => { results.push([request.actorId, accepted]); if (!accepted) throw notification; })).toBe(true);
    if (request.actorId === 2) {
      const author = wallRequestScope(game.world, request)!.authors.get(2)!;
      let remaining = 1;
      Object.defineProperty(author, "remaining", { get: () => remaining, set: (value: number) => {
        remaining = value;
        Object.defineProperty(author.note, "remaining", { configurable: true, enumerable: true, get: () => 1, set: () => { throw payment; } });
      } });
    }
    return request.actorId <= 2 ? game.action : null;
  })).rejects.toBe(cleanup);
  expect(results).toEqual([[1, true], [2, false], [3, false], [4, false], [5, false], [6, false]]);
  expect(game.world.getComponent(1, COMPONENT.WallNote)!.remaining).toBe(0);
  expect(game.world.getComponent(2, COMPONENT.WallNote)!.remaining).toBe(1);
  expect(game.events.filter((event) => event.type === "wall_note_changed" && event.payload.operation === "accepted").map((event) => (event.payload as { actorId: number }).actorId)).toEqual([1]);
});


// 这是首12之外的独立输入：Root静态指出旧 === 与 F02 Object.is 的接受面差异，不能先缩预算再退 alias。
test("illegal signed-zero alias never shrinks a valid original budget", () => {
  let now = 1000;
  const clock = spyOn(Date, "now").mockImplementation(() => now), owner = {}, scope = {};
  const lease = RequestLease.actorPhaseDayStage({ active: (_owner: object) => scope, owner: (_scope: object) => owner,
    actorId: (_scope: object) => 1, phase: () => Phase.Night, stage: (_scope: object) => "thief" as const, current: () => true }, 20);
  const original = { actorId: 1, phase: Phase.Night, allowedTools: [], context: { day: 1, stage: "thief" }, deadlineAtMs: 5000, extra: 0 } as unknown as ActionRequest;
  try {
    lease.bind(owner, original);
    const alias = { ...original, extra: -0, deadlineAtMs: 2000 } as ActionRequest;
    inheritRequestAlias(original, alias);
    expect(lease.scope(owner, alias)).toBeUndefined();
    now = 2500;
    expect(lease.scope(owner, original)).toBe(scope);
    expect(original.deadlineAtMs).toBe(5000);
  } finally { clock.mockRestore(); }
});
