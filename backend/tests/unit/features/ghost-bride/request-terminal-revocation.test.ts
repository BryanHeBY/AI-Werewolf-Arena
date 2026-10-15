/**
 * 验证鬼魂新娘真实婚礼窗口的新 F02 终态政策，不重复旧恢复行为探针或整夜场景。
 * 输入为合法十二人原板、实际 bootstrap／工厂／网关、信封或领域失配、期限和受控提交异常；
 * 字面库存、pair／见证票、Victory、事实与通知分别验证未付拒绝、别名隔离和已付前缀。
 * 失败 finally 原本就耗尽新娘资源；不能把这个 0 误记为选择付款或为了新拒绝退款。
 * 半付款和晚事实错误保同一 Error，第一同意的原 proof 失效不能通过新窗口重新完成婚礼。
 */
import { expect, spyOn, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  Camp, COMPONENT, Phase, World, createRandom, deferRequestDelivery,
  type ActionProvider, type ActionRequest, type GameEvent, type ToolCall,
} from "../../../../src/domain";
import type { ActionRequestConstructionInput, ActionRequestFactoryConstructorPort } from "../../../../src/domain/actions";
import { ToolGateway } from "../../../../src/game/gateway/tool_gateway";
import { GameActionRequestFactory } from "../../../../src/game/engine/action_request_factory";
import { GhostBrideSetupWindow } from "../../../../src/game/mechanisms/roles/ghost_bride/setup";
import {
  ghostBrideRequestScope, inheritGhostBrideDeadlineRequest, authorizedWeddingTurn,
  commitWeddingTool, openWeddingTurn, closeWeddingTurn,
  weddingSetup, weddingPair, weddingGroup, weddingAssignment, ghostBrideReady,
} from "../../../../src/game/mechanisms/roles/ghost_bride/authority";
import { ghostBrideBoard, ghostBrideDeck } from "../../../support/features/ghost-bride/builders/scenario";

function fixture(label: string, requestFactory: ActionRequestFactoryConstructorPort = GameActionRequestFactory) {
  const game = bootstrapGame(ghostBrideBoard(), {
    fixedRoles: ghostBrideDeck, locale: "zh-CN", random: createRandom("ghost-terminal:" + label),
  });
  const events: GameEvent[] = [];
  let current = () => true;
  const window = new GhostBrideSetupWindow(game.world, new ToolGateway(), events, {
    get requestFactory() { return requestFactory; },
  });
  return {
    ...game, events,
    setCurrent: (value: () => boolean) => { current = value; },
    execute: (provider: ActionProvider) => window.execute(game.boardConfig, provider, 1, () => current()),
  };
}
type Fixture = ReturnType<typeof fixture>;
function choice(request: ActionRequest): ToolCall {
  if (request.allowedTools.includes("choose_bridegroom"))
    return { name: "choose_bridegroom", args: { target_id: 2 } };
  if (request.allowedTools.includes("speak_to_partner"))
    return { name: "speak_to_partner", args: { text: "" } };
  if (request.allowedTools.includes("choose_wedding_witness"))
    return { name: "choose_wedding_witness", args: { target_id: 3 } };
  throw new Error("ghost_terminal_test_unexpected_tool");
}
function brideState(g: Fixture) {
  return (g.world.getComponent(1, COMPONENT.Role)!.privateState as {
    ghostBride: { policy: string; remaining: number; groomId: number | null };
  }).ghostBride;
}
function failedWithoutChoice(g: Fixture) {
  expect(weddingSetup(g.world)?.status).toBe("failed");
  expect(brideState(g)).toEqual({ policy: "awa_melbourne_ghost_bride_v1", remaining: 0, groomId: null });
  expect(weddingPair(g.world)).toBeNull();
  expect(weddingGroup(g.world)).toBeNull();
  expect(g.events).toHaveLength(0);
  expect(g.world.getComponent(2, COMPONENT.Victory)?.affiliations).toEqual([{ kind: "faction", faction: Camp.Wolf }]);
}

test("original stage/context/body observed invalid cannot resume the real groom turn after restoration", async () => {
  for (const kind of ["stage", "context", "body"] as const) {
    const g = fixture(kind), notifications: boolean[] = [];
    let calls = 0;
    await expect(g.execute({ getAction: async request => {
      calls++;
      const scope = ghostBrideRequestScope(g.world, request)!;
      expect(scope).toBeDefined();
      expect(deferRequestDelivery(request, yes => notifications.push(yes))).toBe(true);
      const mutable = request as unknown as { context: Record<string, unknown>; allowedTools: unknown[] };
      const context = mutable.context, stage = context.stage, tools = mutable.allowedTools;
      if (kind === "stage") context.stage = "ghost_terminal_wrong_stage";
      else if (kind === "context") mutable.context = { ...context };
      else mutable.allowedTools = ["speak"];
      expect(ghostBrideRequestScope(g.world, request)).toBeUndefined();
      mutable.context = context;
      context.stage = stage;
      mutable.allowedTools = tools;
      expect(ghostBrideRequestScope(g.world, request)).toBeUndefined();
      expect(authorizedWeddingTurn(g.world, 1, Phase.Night, 1, scope)).toBe(false);
      // 这里尚未付款；外层 finally 的原资源耗尽另行断言。
      expect(brideState(g).remaining).toBe(1);
      expect(brideState(g).groomId).toBeNull();
      return choice(request);
    } })).rejects.toThrow("ghost_bride_turn_revoked");
    expect(calls).toBe(1);
    expect(notifications).toEqual([false]);
    failedWithoutChoice(g);
  }
});

test("shared domain observation is permanent and a thrown current retains the original error", async () => {
  for (const throws of [false, true]) {
    const g = fixture("domain:" + throws), notifications: boolean[] = [], error = new Error("ghost_domain_literal");
    let invalid = false;
    g.setCurrent(() => { if (invalid && throws) throw error; return !invalid; });
    const execution = g.execute({ getAction: async request => {
      expect(deferRequestDelivery(request, yes => notifications.push(yes))).toBe(true);
      invalid = true;
      if (throws) {
        try { ghostBrideRequestScope(g.world, request); }
        finally { invalid = false; }
      } else {
        expect(ghostBrideRequestScope(g.world, request)).toBeUndefined();
        invalid = false;
        expect(ghostBrideRequestScope(g.world, request)).toBeUndefined();
      }
      return choice(request);
    } });
    if (throws) await expect(execution).rejects.toBe(error);
    else await expect(execution).rejects.toThrow("ghost_bride_turn_revoked");
    expect(notifications).toEqual([false]);
    failedWithoutChoice(g);
  }
});

test("observed earliest alias expiry does not revive the original or alias after clock rollback", async () => {
  const g = fixture("expiry"), notifications: boolean[] = [];
  await expect(g.execute({ getAction: async request => {
    const scope = ghostBrideRequestScope(g.world, request)!;
    expect(deferRequestDelivery(request, yes => notifications.push(yes))).toBe(true);
    const now = Date.now(), timed = { ...request, deadlineAtMs: now + 5_000 };
    inheritGhostBrideDeadlineRequest(request, timed);
    expect(ghostBrideRequestScope(g.world, timed)).toBe(scope);
    const clock = spyOn(Date, "now").mockReturnValue(now + 5_001);
    try {
      expect(ghostBrideRequestScope(g.world, request)).toBeUndefined();
      clock.mockReturnValue(now);
      expect(ghostBrideRequestScope(g.world, request)).toBeUndefined();
      expect(ghostBrideRequestScope(g.world, timed)).toBeUndefined();
    } finally { clock.mockRestore(); }
    expect(request.deadlineAtMs).toBeUndefined();
    expect(brideState(g).remaining).toBe(1);
    return choice(request);
  } })).rejects.toThrow("ghost_bride_turn_revoked");
  expect(notifications).toEqual([false]);
  failedWithoutChoice(g);
});

test("registered alias own invalidity is permanent only for that alias and foreign inputs do not poison the wedding", async () => {
  for (const kind of ["context", "body", "deadline"] as const) {
    const g = fixture("alias:" + kind), notifications: boolean[] = [];
    let groom: ActionRequest | undefined, scope: object | undefined;
    expect(await g.execute({ getAction: async request => {
      if (request.context.stage === "ghost_bride_groom") {
        groom = request;
        scope = ghostBrideRequestScope(g.world, request)!;
        expect(deferRequestDelivery(request, yes => notifications.push(yes))).toBe(true);
        const alias = { ...request, deadlineAtMs: Date.now() + 60_000 };
        inheritGhostBrideDeadlineRequest(request, alias);
        expect(ghostBrideRequestScope(g.world, alias)).toBe(scope);
        const mutable = alias as unknown as { context: Record<string, unknown>; allowedTools: unknown[]; deadlineAtMs: number };
        const context = mutable.context, tools = mutable.allowedTools, deadline = mutable.deadlineAtMs;
        if (kind === "context") mutable.context = { ...context };
        else if (kind === "body") mutable.allowedTools = ["speak"];
        else mutable.deadlineAtMs = deadline + 1;
        // 别名自检必须先拒，不进入原领域回调；这里故意让该回调抛错来辨别读取顺序。
        const unexpected = new Error("alias_must_not_query_original_domain");
        g.setCurrent(() => { throw unexpected; });
        try { expect(ghostBrideRequestScope(g.world, alias)).toBeUndefined(); }
        finally { g.setCurrent(() => true); }
        mutable.context = context; mutable.allowedTools = tools; mutable.deadlineAtMs = deadline;
        expect(ghostBrideRequestScope(g.world, alias)).toBeUndefined();
        expect(ghostBrideRequestScope(g.world, request)).toBe(scope);
        const unknown = { ...request, context: { ...request.context } };
        expect(ghostBrideRequestScope(g.world, unknown)).toBeUndefined();
        expect(ghostBrideRequestScope(new World(), request)).toBeUndefined();
        expect(authorizedWeddingTurn(g.world, 2, Phase.Night, 1, scope)).toBe(false);
        expect(ghostBrideRequestScope(g.world, request)).toBe(scope);
      }
      return choice(request);
    } })).toBe(true);
    expect(notifications).toEqual([true]);
    expect(weddingGroup(g.world)).toEqual({ policy: "awa_melbourne_ghost_bride_v1", groupId: "ghost-bride:1:1", brideId: 1, groomId: 2, witnessId: 3, day: 1 });
    expect(brideState(g).remaining).toBe(0);
    expect(ghostBrideRequestScope(g.world, groom!)).toBeUndefined();
  }
});

test("invalid first witness proof prevents the second consent even after restoration and a newly opened request", async () => {
  const g = fixture("consent"), notifications: boolean[] = [];
  let first: ActionRequest | undefined, probed = false;
  await expect(g.execute({ getAction: async request => {
    if (request.context.stage === "ghost_bride_witness") {
      if (!first) first = request;
      else {
        probed = true;
        const second = ghostBrideRequestScope(g.world, request)!;
        expect(deferRequestDelivery(request, yes => notifications.push(yes))).toBe(true);
        const oldDay = first.context.day;
        first.context.day = 2;
        expect(ghostBrideRequestScope(g.world, request)).toBeUndefined();
        expect(commitWeddingTool(second, { name: "choose_wedding_witness", args: { target_id: 3 } })).toBe(false);
        expect(weddingSetup(g.world)?.witnessVotes).toEqual([{ actorId: 1, targetId: 3 }]);
        first.context.day = oldDay;
        expect(ghostBrideRequestScope(g.world, request)).toBeUndefined();
        expect(commitWeddingTool(second, { name: "choose_wedding_witness", args: { target_id: 3 } })).toBe(false);
        // 明确的特权驱动再开新第二turn也不能复用已失效的第一同意，不伪装成玩家能造scope。
        closeWeddingTurn(second);
        const replacement = openWeddingTurn(g.world, "witness", 2, 1, () => true);
        try {
          const fresh = new GameActionRequestFactory(g.world, g.events, 1).create({
            actorId: 2, phase: Phase.Night, allowedTools: ["choose_wedding_witness"], stage: "ghost_bride_witness", requiresAction: true,
            summary: { key: "request.summary.night_action" },
            context: { allow_fallback: false, action_failure_policy: "error", proposedWitnessId: 3 },
          });
          expect(ghostBrideRequestScope(g.world, fresh)).toBeUndefined();
          expect(authorizedWeddingTurn(g.world, 2, Phase.Night, 1, replacement)).toBe(false);
        } finally { closeWeddingTurn(replacement); }
      }
    }
    return choice(request);
  } })).rejects.toThrow("ghost_bride_turn_revoked");
  expect(probed).toBe(true);
  expect(notifications).toEqual([false]);
  expect(weddingSetup(g.world)?.status).toBe("failed");
  expect(weddingSetup(g.world)?.witnessVotes).toEqual([{ actorId: 1, targetId: 3 }]);
  expect(weddingPair(g.world)?.groomId).toBe(2);
  expect(weddingGroup(g.world)).toBeNull();
  expect(brideState(g).groomId).toBe(2);
  expect(g.world.getComponent(3, COMPONENT.Victory)?.affiliations).toEqual([{ kind: "faction", faction: Camp.Wolf }]);
  expect(g.events.filter(e => e.type === "ghost_bride_witness_vote")).toHaveLength(1);
  expect(g.events.some(e => e.type === "ghost_bride_group_chosen")).toBe(false);
});

test("partial payment error and paid late publication retain their original prefixes and settlement", async () => {
  const partial = fixture("partial"), partialNotifications: boolean[] = [], partialError = new Error("ghost_partial_victory_literal");
  let groom: ActionRequest | undefined;
  const originalAdd = partial.world.addComponent;
  partial.world.addComponent = function (this: World, ...args: Parameters<typeof originalAdd>) {
    if (args[0] === 2 && args[1] === COMPONENT.Victory) {
      // 首库存/新郎字段和pair已写；观察到中间状态不能在首写后新增退款或截断原错误。
      expect(brideState(partial).remaining).toBe(0);
      expect(brideState(partial).groomId).toBe(2);
      expect(ghostBrideRequestScope(partial.world, groom!)).toBeUndefined();
      throw partialError;
    }
    return Reflect.apply(originalAdd, this, args);
  } as typeof originalAdd;
  await expect(partial.execute({ getAction: async request => {
    groom = request;
    expect(deferRequestDelivery(request, yes => partialNotifications.push(yes))).toBe(true);
    return choice(request);
  } })).rejects.toBe(partialError);
  expect(partialNotifications).toEqual([false]);
  expect(weddingPair(partial.world)?.groomId).toBe(2);
  expect(weddingGroup(partial.world)).toBeNull();
  expect(brideState(partial).groomId).toBe(2);
  expect(partial.world.getComponent(2, COMPONENT.Victory)?.affiliations).toEqual([{ kind: "faction", faction: Camp.Wolf }]);
  expect(partial.events).toHaveLength(0);

  const paid = fixture("paid"), paidNotifications: boolean[] = [], lateError = new Error("ghost_late_fact_literal");
  let last: ActionRequest | undefined;
  const push = paid.events.push;
  paid.events.push = function (...events: GameEvent[]) {
    const length = Reflect.apply(push, this, events);
    if (events.some(e => e.type === "ghost_bride_group_chosen")) {
      const prior = last!.context.stage;
      (last!.context as unknown as { stage: string }).stage = "ghost_paid_old_request_invalid";
      expect(ghostBrideRequestScope(paid.world, last!)).toBeUndefined();
      (last!.context as unknown as { stage: string }).stage = prior;
      throw lateError;
    }
    return length;
  };
  await expect(paid.execute({ getAction: async request => {
    last = request;
    expect(deferRequestDelivery(request, yes => paidNotifications.push(yes))).toBe(true);
    return choice(request);
  } })).rejects.toBe(lateError);
  expect(paidNotifications).toEqual([true, true, true, true, true]);
  expect(ghostBrideReady(paid.world)).toBe(true);
  expect(weddingGroup(paid.world)?.witnessId).toBe(3);
  expect(weddingAssignment(paid.world)?.find(([id]) => id === 3)?.[1]).toBe(Camp.ThirdParty);
  expect(paid.events.filter(e => e.type === "ghost_bride_partner_chat")).toHaveLength(2);
  expect(paid.events.filter(e => e.type === "ghost_bride_group_chosen")).toHaveLength(1);
});

test("provider getter observation cannot invoke its returned method after revoking the prepared request", async () => {
  let captured: ActionRequest | undefined;
  class CapturingFactory extends GameActionRequestFactory {
    override create(input: ActionRequestConstructionInput) {
      return captured = super.create(input);
    }
  }
  const g = fixture("provider-getter", CapturingFactory);
  let getterCalls = 0, methodCalls = 0;
  await expect(g.execute({ get getAction() {
    getterCalls++;
    const request = captured!, stage = request.context.stage;
    (request.context as unknown as { stage: string }).stage = "ghost_getter_invalid";
    expect(ghostBrideRequestScope(g.world, request)).toBeUndefined();
    (request.context as unknown as { stage: string }).stage = stage;
    return async (actual: ActionRequest) => { methodCalls++; return choice(actual); };
  } })).rejects.toThrow("ghost_bride_turn_revoked");
  expect(getterCalls).toBe(1);
  expect(methodCalls).toBe(0);
  failedWithoutChoice(g);
});

test("retained consent rejects shared early false and late current Error but isolates the second envelope", async () => {
  for (const fault of ["shared-window-false", "shared-consent-error", "second-envelope"] as const) {
    const g = fixture("retained:" + fault), error = new Error("ghost_retained_shared_literal"), notifications: boolean[] = [];
    let seenFirst = false, observed = false;
    await expect(g.execute({ getAction: async request => {
      if (request.context.stage === "ghost_bride_witness") {
        if (!seenFirst) seenFirst = true;
        else {
          observed = true;
          const second = ghostBrideRequestScope(g.world, request)!;
          expect(deferRequestDelivery(request, yes => notifications.push(yes))).toBe(true);
          if (fault === "shared-window-false") {
            g.setCurrent(() => false);
            try { expect(ghostBrideRequestScope(g.world, request)).toBeUndefined(); }
            finally { g.setCurrent(() => true); }
          } else if (fault === "shared-consent-error") {
            // validWindow 先读两次 current；第三次是原 validConsent 再读的 setupCurrent，不能被前两次真值掩盖。
            let reads = 0;
            g.setCurrent(() => { if (++reads === 3) throw error; return true; });
            let caught: unknown;
            try { ghostBrideRequestScope(g.world, request); }
            catch (actual) { caught = actual; }
            finally { g.setCurrent(() => true); }
            expect(caught).toBe(error);
            expect(reads).toBe(3);
          } else {
            const context = request.context;
            request.context = { ...context };
            expect(ghostBrideRequestScope(g.world, request)).toBeUndefined();
            request.context = context;
          }
          expect(ghostBrideRequestScope(g.world, request)).toBeUndefined();
          expect(commitWeddingTool(second, { name: "choose_wedding_witness", args: { target_id: 3 } })).toBe(false);
          expect(weddingSetup(g.world)?.witnessVotes).toEqual([{ actorId: 1, targetId: 3 }]);
          // 仅测试驱动可显式 close/open；新第二 scope 的 query 会真实复验同一份 retained first consent。
          closeWeddingTurn(second);
          const replacement = openWeddingTurn(g.world, "witness", 2, 1, () => true);
          try {
            const fresh = new GameActionRequestFactory(g.world, g.events, 1).create({
              actorId: 2, phase: Phase.Night, allowedTools: ["choose_wedding_witness"], stage: "ghost_bride_witness", requiresAction: true,
              summary: { key: "request.summary.night_action" },
              context: { allow_fallback: false, action_failure_policy: "error", proposedWitnessId: 3 },
            });
            if (fault === "second-envelope") {
              expect(ghostBrideRequestScope(g.world, fresh)).toBe(replacement);
              expect(authorizedWeddingTurn(g.world, 2, Phase.Night, 1, replacement)).toBe(true);
            } else {
              expect(ghostBrideRequestScope(g.world, fresh)).toBeUndefined();
              expect(authorizedWeddingTurn(g.world, 2, Phase.Night, 1, replacement)).toBe(false);
            }
          } finally { closeWeddingTurn(replacement); }
        }
      }
      return choice(request);
    } })).rejects.toThrow("ghost_bride_turn_revoked");
    expect(observed).toBe(true);
    expect(notifications).toEqual([false]);
    expect(weddingSetup(g.world)?.status).toBe("failed");
    expect(weddingSetup(g.world)?.witnessVotes).toEqual([{ actorId: 1, targetId: 3 }]);
    expect(weddingPair(g.world)?.groomId).toBe(2);
    expect(weddingGroup(g.world)).toBeNull();
    expect(g.events.filter(event => event.type === "ghost_bride_witness_vote")).toHaveLength(1);
    expect(g.world.getComponent(3, COMPONENT.Victory)?.affiliations).toEqual([{ kind: "faction", faction: Camp.Wolf }]);
  }
});
