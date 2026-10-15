/**
 * 单元测试负责验证普通预言家与死亡警徽的领域事务完成点；真实 bootstrap、流水线／死亡结算、工厂和网关产生请求。
 * 九个声明内使用独立 fresh World；信封／别名／期限、字面状态、Trace 结算及同 Error 身份分别作为预期。
 * Provider 候选不代表付款；部分写入保留但通知失败，全部领域提交后即成功，晚事实或通知错误不退款。
 * 这里只使用 schema 合法的显式 Trace 哈希，不验证 strict archive build 身份，不运行整局、模型或旧 characterization。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { Camp, COMPONENT, DeathCause, Phase, Role, createRandom,
  type ActionProvider, type ActionRequest, type BoardConfig, type GameEvent, type RuntimeSnapshot, type ToolCall,
} from "../../../src/domain";
import { assertRequestDelivery, deriveBoundedRequest } from "../../../src/domain/request-delivery";
import { DamageResolutionSystem } from "../../../src/domain/systems/damage-resolution-system";
import { GameActionRequestFactory } from "../../../src/engine/actions/action-request-factory";
import { DeathResolution } from "../../../src/engine/death-resolution";
import { EventRegistry } from "../../../src/engine/events/event-registry";
import { NightPipeline } from "../../../src/engine/phases/night-pipeline";
import { ToolGateway } from "../../../src/engine/actions/tool-gateway";
import { findNightAbility } from "../../../src/features/night-abilities/abilities";
import { getSeerState } from "../../../src/features/seer/ports";
import { ownNightActions } from "../../../src/features/night-abilities/night-action-history";
import { ReproductionTrace } from "../../../src/recording/reproduction/trace";
import { captureCheckpoint } from "../../../src/app/simulation/reproduction-context";
import { sixPlayerMvpConfig } from "../../../src/rulesets/presets/six-player-mvp";
import { RULESET } from "@ai-werewolf-arena/game-catalog";

type Family = "seer" | "badge";
const revoked = "action_request_delivery_authority_revoked";
const check: ToolCall = { name: "check_identity", args: { target_id: 1 } };
const transfer: ToolCall = { name: "choose_badge_successor", args: { target_id: 6 } };

/** 临时 getter／writer 注入均恢复原 descriptor；不替换资格算法或伪造 permit。 */
function replaceField(object: object, key: PropertyKey, descriptor: PropertyDescriptor): () => void {
  const previous = Object.getOwnPropertyDescriptor(object, key);
  Object.defineProperty(object, key, { configurable: true, ...descriptor });
  return () => {
    if (previous) Object.defineProperty(object, key, previous);
    else Reflect.deleteProperty(object, key);
  };
}
async function thrownBy(operation: Promise<unknown>) {
  let threw = false, error: unknown;
  try { await operation; } catch (caught) { threw = true; error = caught; }
  return { threw, error };
}

function fixture(family: Family, label: string) {
  const config = family === "badge" ? {
    ...sixPlayerMvpConfig, enableSheriff: true, initialSheriffSeat: 5,
    sheriff: { voteWeight: 2.25, badgePolicy: "awa_holder_choice_v1" as const },
  } : sixPlayerMvpConfig;
  const game = bootstrapGame(config, {
    fixedRoles: [Role.Wolf, Role.Wolf, Role.Seer, Role.Guard, Role.Villager, Role.Villager],
    random: createRandom(`q2-domain-policy-${family}-${label}`), locale: "en",
  });
  const events: GameEvent[] = [], requests: ActionRequest[] = [], changes: number[] = [];
  const snapshot: RuntimeSnapshot = {
    day: family === "seer" ? 1 : 2,
    phase: family === "seer" ? Phase.Night : Phase.Voting,
    gameOver: false, result: null,
  };
  const actor = game.world.getComponent(3, COMPONENT.Role)!;
  const ability = findNightAbility(actor, "seer_check")!;
  const seer = getSeerState(actor)!;
  let candidate: (request: ActionRequest) => Promise<ToolCall | null> = async () => family === "seer" ? check : transfer;
  let settlement: (() => void) | undefined;
  let trace!: ReproductionTrace;
  trace = new ReproductionTrace({
    engine: { id: "awa-engine", sourceHash: "a".repeat(64), lockHash: "b".repeat(64) },
    random: game.random.metadata, ruleset: RULESET,
    boardId: `q2_domain_${family}_${label.replaceAll("-", "_")}`,
    normalizedBoard: structuredClone(game.boardConfig) as BoardConfig, locale: "en", maxDays: 2, dealMode: "fixed",
    players: game.world.entityIds().map(id => ({
      id,
      name: game.world.getComponent(id, COMPONENT.Identity)!.name,
      role: game.world.getComponent(id, COMPONENT.Role)!.role,
      camp: game.world.getComponent(id, COMPONENT.Camp)!.camp,
    })),
  }, () => {
    // 只在结算计数确实变化时记录一次；测试自行提供独立字面预期，不以生产 current 生成 oracle。
    if (trace.settlementCount > (changes.at(-1) ?? 0)) {
      changes.push(trace.settlementCount);
      settlement?.();
    }
  }, () => events);
  trace.checkpoint(captureCheckpoint(game.world, snapshot, 0, true, 0), []);
  const provider: ActionProvider = {
    async getAction(request) {
      if (request.context.stage !== (family === "seer" ? "seer" : "sheriff_badge_choice")) return null;
      requests.push(request);
      expect(request.actorId).toBe(family === "seer" ? 3 : 5);
      if (family === "badge") {
        expect(game.world.getComponent(5, COMPONENT.Alive)!.alive).toBe(false);
        expect(game.world.hasDeathAction(5, "choose_badge_successor", Phase.Voting, 2, request.context.death_action_id)).toBe(true);
      }
      return trace.decide(request, { getAction: original => candidate(original) });
    },
  };
  return {
    family, game, events, requests, changes, snapshot, ability, seer, trace, provider,
    choose(handler: typeof candidate) { candidate = handler; },
    onSettlement(handler: () => void) { settlement = handler; },
    run() {
      if (family === "seer") return new NightPipeline({
        world: game.world, events, toolGateway: new ToolGateway(),
        damageResolutionSystem: new DamageResolutionSystem(), random: game.random, rulePlan: game.rulePlan,
      }).execute(game.boardConfig, provider, 1);
      return new DeathResolution(game.world, events, new ToolGateway(), new EventRegistry(), snapshot, game.boardConfig)
        .resolve([5], { 5: [DeathCause.Exile] }, provider, Phase.Voting, Phase.Voting);
    },
  };
}
type Fixture = ReturnType<typeof fixture>;
function expectOutcome(f: Fixture, kind: "action" | "error") {
  expect(f.trace.decisionCount).toBe(1);
  expect(f.trace.settlementCount).toBe(1);
  expect(f.changes).toEqual([1]);
  const decisions = f.trace.build().decisions;
  expect(decisions).toHaveLength(1);
  expect(decisions[0]!.settleOrder).toBe(1);
  expect(decisions[0]!.outcome.kind).toBe(kind);
  if (kind === "action") expect(decisions[0]!.outcome).toEqual({ kind: "action", action: f.family === "seer" ? check : transfer });
}
function expectSeerUnpaid(f: Fixture) {
  expect(f.seer.lastTarget).toBeNull();
  expect(f.seer.lastIsWerewolf).toBeNull();
  expect(f.seer.lastResult).toBeNull();
  expect(f.seer.history).toEqual([]);
  expect(f.ability.uses).toBe(0);
  expect(f.ability.lastUsedDay).toBeNull();
  expect(ownNightActions(f.game.world, 3, 1)).toEqual([]);
  expect(f.events.filter(event => event.type === "seer_checked")).toEqual([]);
}
function expectSeerPaid(f: Fixture) {
  expect(f.seer.lastTarget).toBe(1);
  expect(f.seer.lastIsWerewolf).toBe(true);
  expect(f.seer.lastResult).toEqual({ kind: "camp", camp: Camp.Wolf });
  expect(f.seer.history).toEqual([{ targetId: 1, isWerewolf: true, result: { kind: "camp", camp: Camp.Wolf } }]);
  expect(f.ability.uses).toBe(1);
  expect(f.ability.lastUsedDay).toBe(1);
  expect(ownNightActions(f.game.world, 3, 1)).toEqual([{ day: 1, kind: "check", targetId: 1, lucky: false }]);
}
function expectBadgeUnpaid(f: Fixture) {
  expect(f.game.world.getComponent(5, COMPONENT.Badge)!.isSheriff).toBe(true);
  expect(f.game.world.getComponent(5, COMPONENT.Badge)!.destroyed).toBe(false);
  expect(f.game.world.getComponent(5, COMPONENT.VotingRight)!.weight).toBe(2.25);
  expect(f.game.world.getComponent(6, COMPONENT.Badge)!.isSheriff).toBe(false);
  expect(f.game.world.getComponent(6, COMPONENT.VotingRight)!.weight).toBe(1);
  expect(f.events.filter(event => event.type === "sheriff_badge_transferred" || event.type === "sheriff_badge_destroyed")).toEqual([]);
}
function expectBadgeTransferred(f: Fixture) {
  expect(f.game.world.getComponent(5, COMPONENT.Badge)!.isSheriff).toBe(false);
  expect(f.game.world.getComponent(5, COMPONENT.Badge)!.destroyed).toBe(true);
  expect(f.game.world.getComponent(5, COMPONENT.VotingRight)!.weight).toBe(1);
  expect(f.game.world.getComponent(6, COMPONENT.Badge)!.isSheriff).toBe(true);
  expect(f.game.world.getComponent(6, COMPONENT.Badge)!.destroyed).toBe(false);
  expect(f.game.world.getComponent(6, COMPONENT.VotingRight)!.weight).toBe(2.25);
}
function expectClosed(f: Fixture) {
  expect(f.game.world.activeDeathActionCount).toBe(0);
  expect(f.requests).toHaveLength(1);
  expect(() => assertRequestDelivery(f.requests[0]!)).toThrow(revoked);
}

// S1：真实工厂请求的能力与信封是新增约束；registered alias 自己失配不会损伤原请求。
test("Seer binds its captured ability and makes observed original envelope failures terminal while isolating aliases", async () => {
  const aliasCase = fixture("seer", "alias_only");
  let alias!: ActionRequest;
  aliasCase.choose(async request => {
    alias = deriveBoundedRequest(request, Date.now() + 60_000);
    expect(alias).not.toBe(request);
    expect(alias.context).toBe(request.context);
    const context = alias.context;
    alias.context = { ...context };
    expect(() => assertRequestDelivery(alias)).toThrow(revoked);
    alias.context = context;
    expect(() => assertRequestDelivery(alias)).toThrow(revoked);
    expect(() => assertRequestDelivery(request)).not.toThrow();
    expect(aliasCase.trace.settlementCount).toBe(0);
    return check;
  });
  await aliasCase.run();
  expectSeerPaid(aliasCase);
  expectOutcome(aliasCase, "action");
  expectClosed(aliasCase);
  expect(() => assertRequestDelivery(alias)).toThrow(revoked);

  for (const field of ["context", "ability_id"] as const) {
    const f = fixture("seer", `original_${field}`);
    f.choose(async request => {
      const context = request.context;
      if (field === "context") {
        request.context = { ...context };
        expect(() => assertRequestDelivery(request)).toThrow(revoked);
        request.context = context;
      } else {
        const id = context.ability_id;
        context.ability_id = "literal_other_ability";
        expect(() => assertRequestDelivery(request)).toThrow(revoked);
        context.ability_id = id;
      }
      expect(() => assertRequestDelivery(request)).toThrow(revoked);
      return check;
    });
    await expect(f.run()).rejects.toThrow(revoked);
    expectSeerUnpaid(f);
    expectOutcome(f, "error");
    expectClosed(f);
  }

  // 工厂真实 create 返回被改能力编号的请求，也不能因为形状相同就在新 lease 中获准。
  const mismatched = fixture("seer", "initial_ability_mismatch");
  const create = GameActionRequestFactory.prototype.create;
  const restore = replaceField(GameActionRequestFactory.prototype, "create", { writable: true,
    value: function(this: GameActionRequestFactory, input: Parameters<typeof create>[0]) {
      const request = create.call(this, input);
      if (request.context.stage === "seer") request.context.ability_id = "literal_wrong_initial_id";
      return request;
    },
  });
  try { await mismatched.run(); } finally { restore(); }
  expect(mismatched.requests).toEqual([]);
  expect(mismatched.trace.decisionCount).toBe(0);
  expectSeerUnpaid(mismatched);
});

// S2：真实 deferred 响应跨越最早期限；额外 fresh 输入核对 provider getter 在调用前撤权。
test("Seer shares the earliest alias budget without clock rollback revival and guards the prepared provider", async () => {
  const f = fixture("seer", "delayed_deadline");
  const now = Object.getOwnPropertyDescriptor(Date, "now")!;
  let clock = 10_000, entered!: () => void, respond!: (action: ToolCall | null) => void;
  const requested = new Promise<void>(resolve => { entered = resolve; });
  const response = new Promise<ToolCall | null>(resolve => { respond = resolve; });
  let original!: ActionRequest, earlier!: ActionRequest;
  Object.defineProperty(Date, "now", { configurable: true, writable: true, value: () => clock });
  try {
    f.choose(request => {
      original = request;
      const bounded = deriveBoundedRequest(request, 10_020);
      earlier = deriveBoundedRequest(bounded, 10_010);
      expect(() => assertRequestDelivery(earlier)).not.toThrow();
      expect(f.trace.settlementCount).toBe(0);
      entered();
      return response;
    });
    const running = f.run();
    await requested;
    clock = 10_010;
    expect(() => assertRequestDelivery(original)).toThrow(revoked);
    clock = 9_999;
    expect(() => assertRequestDelivery(earlier)).toThrow(revoked);
    respond(check);
    await expect(running).rejects.toThrow(revoked);
    expectSeerUnpaid(f);
    expectOutcome(f, "error");
    expectClosed(f);
  } finally { Object.defineProperty(Date, "now", now); }

  const late = fixture("seer", "provider_getter");
  const create = GameActionRequestFactory.prototype.create, getAction = late.provider.getAction;
  let created = false, observed = false, reads = 0, seerInvocations = 0;
  const restoreCreate = replaceField(GameActionRequestFactory.prototype, "create", { writable: true,
    value: function(this: GameActionRequestFactory, input: Parameters<typeof create>[0]) {
      const request = create.call(this, input);
      if (request.context.stage === "seer") created = true;
      return request;
    },
  });
  const restoreProvider = replaceField(late.provider, "getAction", {
    get() {
      if (created && !observed) {
        observed = true;
        reads++;
        Object.defineProperty(late.ability, "disabled", { configurable: true, writable: true, value: true });
      }
      return function(this: ActionProvider, request: ActionRequest) {
        if (request.context.stage === "seer") seerInvocations++;
        return getAction.call(this, request);
      };
    },
  });
  try { await late.run(); } finally { restoreProvider(); restoreCreate(); }
  expect(reads).toBe(1);
  expect(seerInvocations).toBe(0);
  expect(late.trace.decisionCount).toBe(0);
  expectSeerUnpaid(late);
});

// S3：同 Error 发生在实际第一写或历史 append；false 不承诺之前没有物理写入。
test("Seer keeps literal partial state prefixes and settles failure only after an actual writer error", async () => {
  for (const point of ["first", "history"] as const) {
    const f = fixture("seer", `writer_${point}`), failure = new Error(`literal_seer_${point}`);
    let restore = () => {}, attempts = 0;
    f.choose(async () => {
      if (point === "first") {
        restore = replaceField(f.seer, "lastTarget", {
          enumerable: true, get: () => null,
          set(value: number) { attempts++; expect(value).toBe(1); expect(f.trace.settlementCount).toBe(0); throw failure; },
        });
      } else {
        restore = replaceField(f.seer.history, "push", { writable: true,
          value(...rows: unknown[]) {
            attempts++;
            expect(rows).toEqual([{ targetId: 1, isWerewolf: true, result: { kind: "camp", camp: Camp.Wolf } }]);
            expect(f.trace.settlementCount).toBe(0);
            throw failure;
          },
        });
      }
      return check;
    });
    try { await expect(f.run()).rejects.toBe(failure); } finally { restore(); }
    expect(attempts).toBe(1);
    if (point === "first") expectSeerUnpaid(f);
    else {
      expect(f.seer.lastTarget).toBe(1);
      expect(f.seer.lastIsWerewolf).toBe(true);
      expect(f.seer.lastResult).toEqual({ kind: "camp", camp: Camp.Wolf });
      expect(f.seer.history).toEqual([]);
      expect(f.ability.uses).toBe(0);
      expect(f.ability.lastUsedDay).toBeNull();
      expect(ownNightActions(f.game.world, 3, 1)).toEqual([]);
      expect(f.events.filter(event => event.type === "seer_checked")).toEqual([]);
    }
    expectOutcome(f, "error");
    expectClosed(f);
  }
});

// S4：完整知识／use／自身历史是完成点；晚事实和 true 通知错误不二次结算，也不重查已付资格。
test("Seer completes after every domain write before fact publication and retains true when publication or notification fails", async () => {
  const sink = fixture("seer", "late_fact"), factError = new Error("literal_seer_late_fact");
  let attempts = 0;
  const push = sink.events.push;
  sink.events.push = function(...events: GameEvent[]) {
    if (events.some(event => event.type === "seer_checked")) {
      attempts++;
      expectSeerPaid(sink);
      expectOutcome(sink, "action");
      throw factError;
    }
    return push.apply(this, events);
  };
  await expect(sink.run()).rejects.toBe(factError);
  expect(attempts).toBe(1);
  expectSeerPaid(sink);
  expectOutcome(sink, "action");
  expect(sink.events.filter(event => event.type === "seer_checked")).toEqual([]);
  expectClosed(sink);

  const notice = fixture("seer", "true_notice"), noticeError = new Error("literal_seer_true_notification");
  notice.onSettlement(() => { expectSeerPaid(notice); throw noticeError; });
  await expect(notice.run()).rejects.toBe(noticeError);
  expectSeerPaid(notice);
  expectOutcome(notice, "action");
  expect(notice.events.filter(event => event.type === "seer_checked")).toEqual([]);
  expectClosed(notice);
});

// B1：真实死亡与 permit 开启后才取得请求；原来源坏是共同终态，别名 context 坏只退自身。
test("Badge preserves its real death permit while isolating bad aliases and permanently closing corrupted original sources", async () => {
  const aliasCase = fixture("badge", "alias_only");
  let alias!: ActionRequest;
  aliasCase.choose(async request => {
    alias = deriveBoundedRequest(request, Date.now() + 60_000);
    const context = alias.context;
    alias.context = { ...context };
    expect(() => assertRequestDelivery(alias)).toThrow(revoked);
    alias.context = context;
    expect(() => assertRequestDelivery(alias)).toThrow(revoked);
    expect(() => assertRequestDelivery(request)).not.toThrow();
    expect(aliasCase.trace.settlementCount).toBe(0);
    return transfer;
  });
  await aliasCase.run();
  expectBadgeTransferred(aliasCase);
  expectOutcome(aliasCase, "action");
  expectClosed(aliasCase);
  expect(() => assertRequestDelivery(alias)).toThrow(revoked);

  for (const field of ["context", "trigger", "death_action_id", "badge_candidates", "allow_fallback"] as const) {
    const f = fixture("badge", `source_${field}`);
    f.choose(async request => {
      const context = request.context;
      if (field === "context") {
        request.context = { ...context };
        expect(() => assertRequestDelivery(request)).toThrow(revoked);
        request.context = context;
      } else {
        const value = context[field];
        Reflect.set(context, field, field === "badge_candidates" ? [...context.badge_candidates!] : "literal_bad_source");
        expect(() => assertRequestDelivery(request)).toThrow(revoked);
        Reflect.set(context, field, value);
      }
      expect(() => assertRequestDelivery(request)).toThrow(revoked);
      return transfer;
    });
    await expect(f.run()).rejects.toThrow(revoked);
    expectBadgeUnpaid(f);
    expectOutcome(f, "error");
    expectClosed(f);
  }
});

// B2：null 和真实网关拒绝的目标保留原销毁政策，不能被事务 false 改成回退接任。
test("Badge treats null and invalid choices as completed destruction after the old badge and vote weight writes", async () => {
  for (const choice of ["null", "invalid"] as const) {
    const f = fixture("badge", `destroy_${choice}`);
    f.choose(async () => choice === "null" ? null : { name: "choose_badge_successor", args: { target_id: 5 } });
    const push = f.events.push;
    let facts = 0;
    f.events.push = function(...events: GameEvent[]) {
      if (events.some(event => event.type === "sheriff_badge_destroyed")) {
        facts++;
        expect(f.trace.settlementCount).toBe(1);
        expect(f.game.world.getComponent(5, COMPONENT.Badge)!.destroyed).toBe(true);
        expect(f.game.world.getComponent(5, COMPONENT.VotingRight)!.weight).toBe(1);
        expect(f.game.world.getComponent(6, COMPONENT.Badge)!.isSheriff).toBe(false);
      }
      return push.apply(this, events);
    };
    await f.run();
    expect(facts).toBe(1);
    expect(f.game.world.getComponent(5, COMPONENT.Badge)!.isSheriff).toBe(false);
    expect(f.game.world.getComponent(5, COMPONENT.Badge)!.destroyed).toBe(true);
    expect(f.game.world.getComponent(6, COMPONENT.Badge)!.isSheriff).toBe(false);
    expect(f.game.world.getComponent(6, COMPONENT.VotingRight)!.weight).toBe(1);
    expect(f.events.filter(event => event.type === "sheriff_badge_transferred")).toEqual([]);
    expect(f.trace.settlementCount).toBe(1);
    expect(f.changes).toEqual([1]);
    const decision = f.trace.build().decisions[0]!;
    expect(decision.outcome).toEqual({ kind: "action", action: choice === "null" ? null : { name: "choose_badge_successor", args: { target_id: 5 } } });
    expect(decision.settleOrder).toBe(1);
    expectClosed(f);
  }
});

// B3：真实组件 setter 失败分别发生在首写和新票重；不在普通板伪造特殊 frame。
test("Badge leaves its exact partial component prefix when an original badge or successor vote writer fails", async () => {
  for (const point of ["first", "successor_vote"] as const) {
    const f = fixture("badge", `writer_${point}`), failure = new Error(`literal_badge_${point}`);
    let restore = () => {}, attempts = 0;
    f.choose(async () => {
      if (point === "first") {
        restore = replaceField(f.game.world.getComponent(5, COMPONENT.Badge)!, "isSheriff", {
          enumerable: true, get: () => true,
          set(value: boolean) { attempts++; expect(value).toBe(false); expect(f.trace.settlementCount).toBe(0); throw failure; },
        });
      } else {
        restore = replaceField(f.game.world.getComponent(6, COMPONENT.VotingRight)!, "weight", {
          enumerable: true, get: () => 1,
          set(value: number) { attempts++; expect(value).toBe(2.25); expect(f.trace.settlementCount).toBe(0); throw failure; },
        });
      }
      return transfer;
    });
    try { await expect(f.run()).rejects.toBe(failure); } finally { restore(); }
    expect(attempts).toBe(1);
    if (point === "first") expectBadgeUnpaid(f);
    else {
      expect(f.game.world.getComponent(5, COMPONENT.Badge)!.isSheriff).toBe(false);
      expect(f.game.world.getComponent(5, COMPONENT.Badge)!.destroyed).toBe(true);
      expect(f.game.world.getComponent(5, COMPONENT.VotingRight)!.weight).toBe(1);
      expect(f.game.world.getComponent(6, COMPONENT.Badge)!.isSheriff).toBe(true);
      expect(f.game.world.getComponent(6, COMPONENT.Badge)!.destroyed).toBe(false);
      expect(f.game.world.getComponent(6, COMPONENT.Badge)!.voteWeight).toBe(2.25);
      expect(f.game.world.getComponent(6, COMPONENT.VotingRight)!.weight).toBe(1);
      expect(f.events.filter(event => event.type === "sheriff_badge_transferred" || event.type === "sheriff_badge_destroyed")).toEqual([]);
    }
    expectOutcome(f, "error");
    expectClosed(f);
  }
});

// B4：事实晚错保 true；原 permit.close 盖正文，新 false 错误不能掩盖旧错（含 throw undefined）。
test("Badge retains completed transfers across late fact failures and preserves permit close before false notification error priority", async () => {
  const late = fixture("badge", "late_fact"), factError = new Error("literal_badge_late_fact");
  const push = late.events.push;
  let attempts = 0;
  late.events.push = function(...events: GameEvent[]) {
    if (events.some(event => event.type === "sheriff_badge_transferred")) {
      attempts++;
      expectBadgeTransferred(late);
      expectOutcome(late, "action");
      throw factError;
    }
    return push.apply(this, events);
  };
  await expect(late.run()).rejects.toBe(factError);
  expect(attempts).toBe(1);
  expectBadgeTransferred(late);
  expectOutcome(late, "action");
  expectClosed(late);

  const originalError = new Error("literal_badge_body");
  const closeError = new Error("literal_badge_close");
  const falseError = new Error("literal_badge_false_notification");
  const priority = fixture("badge", "close_priority"), order: string[] = [];
  const open = priority.game.world.openDeathAction;
  priority.game.world.openDeathAction = function(...args: Parameters<typeof open>) {
    const permit = open.apply(this, args);
    if (args[1] !== "choose_badge_successor") return permit;
    return { id: permit.id, close() { order.push("close"); permit.close(); throw closeError; } };
  };
  let restore = () => {};
  priority.onSettlement(() => { order.push("false"); throw falseError; });
  priority.choose(async () => {
    restore = replaceField(priority.game.world.getComponent(5, COMPONENT.Badge)!, "isSheriff", {
      enumerable: true, get: () => true,
      set() { order.push("body"); throw originalError; },
    });
    return transfer;
  });
  try { await expect(priority.run()).rejects.toBe(closeError); } finally { restore(); }
  expect(order).toEqual(["body", "close", "false"]);
  expectBadgeUnpaid(priority);
  expectOutcome(priority, "error");
  expectClosed(priority);

  const undefinedBody = fixture("badge", "undefined_body");
  let restoreUndefined = () => {};
  undefinedBody.onSettlement(() => { throw falseError; });
  undefinedBody.choose(async () => {
    restoreUndefined = replaceField(undefinedBody.game.world.getComponent(5, COMPONENT.Badge)!, "isSheriff", {
      enumerable: true, get: () => true, set() { throw undefined; },
    });
    return transfer;
  });
  let failure: Awaited<ReturnType<typeof thrownBy>> = { threw: false, error: undefined };
  try { failure = await thrownBy(undefinedBody.run()); } finally { restoreUndefined(); }
  expect(failure.threw).toBe(true);
  expect(failure.error).toBeUndefined();
  expectBadgeUnpaid(undefinedBody);
  expectOutcome(undefinedBody, "error");
  expectClosed(undefinedBody);
});


// B5：原外部守卫不够替代 committer 内部的实际 getter；这里保原返回值，只终结真实请求后恢复字段。
test("Badge checks the same captured delivery after internal target getters before its first domain write", async () => {
  for (const point of ["badge_destroyed", "vote_can_vote"] as const) {
    const f = fixture("badge", `internal_${point}`);
    const applyDescriptor = Object.getOwnPropertyDescriptor(Reflect, "apply")!;
    let restoreField = () => {}, installed = false, reads = 0, observations = 0;
    f.choose(async request => {
      // 安装时点是本窗口新增的 commit callee 准备；外部目标复验已结束，末交付 current 只查询持徽原体。
      Object.defineProperty(Reflect, "apply", { configurable: true, get() {
        if (!installed) {
          installed = true;
          const object = point === "badge_destroyed"
            ? f.game.world.getComponent(6, COMPONENT.Badge)!
            : f.game.world.getComponent(6, COMPONENT.VotingRight)!;
          const key = point === "badge_destroyed" ? "destroyed" : "canVote";
          restoreField = replaceField(object, key, { enumerable: true, get() {
            reads++;
            if (observations === 0) {
              observations++;
              const trigger = request.context.trigger;
              request.context.trigger = "literal_internal_trigger_mismatch";
              expect(() => assertRequestDelivery(request)).toThrow(revoked);
              request.context.trigger = trigger;
              expect(() => assertRequestDelivery(request)).toThrow(revoked);
              expect(f.trace.settlementCount).toBe(0);
            }
            return point === "badge_destroyed" ? false : true;
          } });
        }
        return applyDescriptor.value;
      } });
      return transfer;
    });
    try { await f.run(); }
    finally { Object.defineProperty(Reflect, "apply", applyDescriptor); restoreField(); }
    expect(installed).toBe(true);
    expect(observations).toBe(1);
    expect(reads).toBe(point === "badge_destroyed" ? 1 : 2);
    expectBadgeUnpaid(f);
    expectOutcome(f, "error");
    expectClosed(f);
  }
});
