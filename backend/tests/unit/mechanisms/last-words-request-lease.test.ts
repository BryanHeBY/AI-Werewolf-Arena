/**
 * 单元测试验证遗言真实交付窗口的动态日次、终态撤销、期限别名和发表后通知。
 * 输入为真实 bootstrap World、工厂、网关与死亡许可；手写轨迹／事件／错误身份为独立预期。
 * 不运行整局或模型，不用伪 scope 或请求 JSON 替代 World 许可，也不重跑原窗口两项绿例。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { COMPONENT } from "../../../src/core/domain/components/names";
import { DeathCause, Phase, Role, type ActionRequest, type GameEvent, type RuntimeSnapshot, type ToolCall } from "../../../src/core/domain/model";
import { assertRequestDelivery, deferRequestDelivery, deriveBoundedRequest } from "../../../src/core/domain/request_delivery";
import { GameActionRequestFactory } from "../../../src/game/engine/action_request_factory";
import { ToolGateway } from "../../../src/game/gateway/tool_gateway";
import { getDefaultLastWordsMechanism } from "../../../src/game/mechanisms/last_words/last_words_mechanism";
import { LastWordsWindow } from "../../../src/game/mechanisms/last_words/window";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";

function fixture(trace: string[] = [], close?: () => void) {
  const game = bootstrapGame(sixPlayerMvpConfig, {
    fixedRoles: [Role.Wolf, Role.Wolf, Role.Seer, Role.Guard, Role.Villager, Role.Villager],
  });
  game.world.getComponent(5, COMPONENT.Alive)!.alive = false;
  game.world.getComponent(6, COMPONENT.Alive)!.alive = false;
  const state: RuntimeSnapshot = { day: 2, phase: Phase.Day, gameOver: false, result: null };
  const events: GameEvent[] = [];
  const open = game.world.openDeathAction;
  game.world.openDeathAction = function(...args: Parameters<typeof open>) {
    trace.push("open");
    const permit = open.apply(this, args);
    return {
      id: permit.id,
      close() { trace.push("close"); permit.close(); close?.(); },
    };
  };
  const window = new LastWordsWindow({
    requestFactory: GameActionRequestFactory, world: game.world, events, state,
    toolGateway: new ToolGateway(), lastWordsMechanism: getDefaultLastWordsMechanism(),
  });
  return { game, state, events, window };
}
const speak = (text: string): ToolCall => ({ name: "speak", args: { text } });

// 第2日投票死亡按既有政策取得遗言；不以固定首夜协议掩盖动态日次。
test("last words settle only after real publication and isolate a registered alias on a later day", async () => {
  const trace: string[] = [], f = fixture(trace), notices: boolean[] = [];
  let captured!: ActionRequest, alias!: ActionRequest;
  const push = f.events.push;
  f.events.push = function(...events: GameEvent[]) {
    expect(notices).toEqual([]);
    trace.push("publish");
    return push.apply(this, events);
  };
  await f.window.collect([5], Phase.Day, Phase.Voting, { 5: [DeathCause.Exile] }, {
    async getAction(request) {
      trace.push("provider");
      captured = request;
      expect(request.context.day).toBe(2);
      expect(deferRequestDelivery(request, accepted => {
        notices.push(accepted); trace.push(`settle:${accepted}`);
        expect(f.events).toHaveLength(1);
        expect(f.game.world.activeDeathActionCount).toBe(1);
      })).toBe(true);
      alias = deriveBoundedRequest(request, Date.now() + 60_000);
      expect(alias).not.toBe(request);
      expect(alias.context).toBe(request.context);
      expect(() => assertRequestDelivery(alias)).not.toThrow();
      alias.context = { ...alias.context };
      expect(() => assertRequestDelivery(alias)).toThrow("action_request_delivery_authority_revoked");
      alias.context = request.context;
      expect(() => assertRequestDelivery(alias)).toThrow("action_request_delivery_authority_revoked");
      expect(() => assertRequestDelivery(request)).not.toThrow();
      trace.push("return");
      return speak(" literal-day-two ");
    },
  }, {});
  expect(trace).toEqual(["open", "provider", "return", "publish", "settle:true", "close"]);
  expect(notices).toEqual([true]);
  const event = f.events[0];
  expect(event.type).toBe("last_words_spoken");
  if (event.type !== "last_words_spoken") throw new Error("literal_missing_words");
  expect(event.payload).toEqual({ playerId: 5, phase: Phase.Day, day: 2, text: "literal-day-two" });
  expect(f.game.world.activeDeathActionCount).toBe(0);
  expect(() => assertRequestDelivery(captured)).toThrow("action_request_delivery_authority_revoked");
  expect(() => assertRequestDelivery(alias)).toThrow("action_request_delivery_authority_revoked");

  const skipped = fixture(), skippedActors: number[] = [], skippedNotices: boolean[] = [];
  await skipped.window.collect([5, 6], Phase.Day, Phase.Voting, { 5: [DeathCause.Exile], 6: [DeathCause.Exile] }, {
    async getAction(request) {
      skippedActors.push(request.actorId);
      expect(deferRequestDelivery(request, accepted => skippedNotices.push(accepted))).toBe(true);
      return null;
    },
  }, {});
  expect(skippedActors).toEqual([5, 6]);
  expect(skippedNotices).toEqual([false, false]);
  expect(skipped.events).toEqual([]);
  expect(skipped.game.world.activeDeathActionCount).toBe(0);
});

test("last words original source fields and context corruption stay terminal after restoration", async () => {
  for (const field of ["trigger", "death_phase", "death_action_id", "stage", "context"] as const) {
    const f = fixture(), notices: boolean[] = [], actors: number[] = [];
    await f.window.collect([5, 6], Phase.Day, Phase.Voting, { 5: [DeathCause.Exile], 6: [DeathCause.Exile] }, {
      async getAction(request) {
        actors.push(request.actorId);
        expect(deferRequestDelivery(request, accepted => notices.push(accepted))).toBe(true);
        const context = request.context;
        if (field === "context") {
          request.context = { ...context };
          expect(() => assertRequestDelivery(request)).toThrow("action_request_delivery_authority_revoked");
          request.context = context;
        } else {
          const value = context[field];
          Reflect.set(context, field, "literal_changed_source");
          expect(() => assertRequestDelivery(request)).toThrow("action_request_delivery_authority_revoked");
          Reflect.set(context, field, value);
        }
        expect(() => assertRequestDelivery(request)).toThrow("action_request_delivery_authority_revoked");
        return speak("literal-late-original");
      },
    }, {});
    expect(actors).toEqual([5]);
    expect(notices).toEqual([false]);
    expect(f.events).toEqual([]);
    expect(f.game.world.activeDeathActionCount).toBe(0);
  }
});

test("last words earliest alias deadline remains expired after clock rollback and a real delayed reply", async () => {
  const f = fixture(), notices: boolean[] = [];
  let requested!: () => void, respond!: (action: ToolCall | null) => void;
  const entered = new Promise<void>(resolve => { requested = resolve; });
  const response = new Promise<ToolCall | null>(resolve => { respond = resolve; });
  let original!: ActionRequest, earlier!: ActionRequest;
  const originalNow = Object.getOwnPropertyDescriptor(Date, "now")!;
  let clock = 10_000;
  Object.defineProperty(Date, "now", { configurable: true, writable: true, value: () => clock });
  try {
    const collecting = f.window.collect([5], Phase.Day, Phase.Voting, { 5: [DeathCause.Exile] }, {
      getAction(request) {
        original = request;
        expect(deferRequestDelivery(request, accepted => notices.push(accepted))).toBe(true);
        const bounded = deriveBoundedRequest(request, 10_020);
        earlier = deriveBoundedRequest(bounded, 10_010);
        expect(() => assertRequestDelivery(earlier)).not.toThrow();
        requested();
        return response;
      },
    }, {});
    await entered;
    expect(f.game.world.activeDeathActionCount).toBe(1);
    clock = 10_010;
    expect(() => assertRequestDelivery(original)).toThrow("action_request_delivery_authority_revoked");
    clock = 9_999;
    expect(() => assertRequestDelivery(earlier)).toThrow("action_request_delivery_authority_revoked");
    expect(() => assertRequestDelivery(original)).toThrow("action_request_delivery_authority_revoked");
    respond(speak("literal-clock-rollback"));
    await collecting;
    expect(notices).toEqual([false]);
    expect(f.events).toEqual([]);
    expect(f.game.world.activeDeathActionCount).toBe(0);
  } finally {
    Object.defineProperty(Date, "now", originalNow);
  }
});

test("last words guard the prepared publication and retain old errors before false notification failures", async () => {
  const falseFailure = new Error("literal_false_notification_failure");
  const noWrite = fixture(), rejected: boolean[] = [];
  const applyDescriptor = Object.getOwnPropertyDescriptor(Reflect, "apply")!;
  let applyReads = 0;
  try {
    await expect(noWrite.window.collect([5], Phase.Day, Phase.Voting, { 5: [DeathCause.Exile] }, {
      async getAction(request) {
        expect(deferRequestDelivery(request, accepted => { rejected.push(accepted); throw falseFailure; })).toBe(true);
        // 新 Reflect callee 的 getter 仍可执行；返回原函数的同时使域失效，不能越过最后守卫发表。
        Object.defineProperty(Reflect, "apply", {
          configurable: true,
          get() { applyReads++; noWrite.state.phase = Phase.Night; return applyDescriptor.value; },
        });
        return speak("literal-no-publication");
      },
    }, {})).rejects.toBe(falseFailure);
  } finally {
    Object.defineProperty(Reflect, "apply", applyDescriptor);
  }
  expect(applyReads).toBe(1);
  expect(rejected).toEqual([false]);
  expect(noWrite.events).toEqual([]);
  expect(noWrite.game.world.activeDeathActionCount).toBe(0);

  const bodyFailure = new Error("literal_sink_after_append_failure");
  const closeFailure = new Error("literal_permit_close_failure");
  const trace: string[] = [], failed = fixture(trace, () => { throw closeFailure; }), failedNotices: boolean[] = [];
  const push = failed.events.push;
  failed.events.push = function(...events: GameEvent[]) {
    trace.push("append"); push.apply(this, events); throw bodyFailure;
  };
  await expect(failed.window.collect([5], Phase.Day, Phase.Voting, { 5: [DeathCause.Exile] }, {
    async getAction(request) {
      expect(deferRequestDelivery(request, accepted => { failedNotices.push(accepted); trace.push("false"); throw falseFailure; })).toBe(true);
      return speak("literal-kept-publication-prefix");
    },
  }, {})).rejects.toBe(closeFailure);
  expect(trace).toEqual(["open", "append", "close", "false"]);
  expect(failedNotices).toEqual([false]);
  expect(failed.events).toHaveLength(1);
  expect(failed.game.world.activeDeathActionCount).toBe(0);

  const undefinedBody = fixture(), undefinedNotices: boolean[] = [];
  let caught = false, error: unknown = "literal_not_thrown";
  try {
    await undefinedBody.window.collect([5], Phase.Day, Phase.Voting, { 5: [DeathCause.Exile] }, {
      async getAction(request) {
        expect(deferRequestDelivery(request, accepted => { undefinedNotices.push(accepted); throw falseFailure; })).toBe(true);
        throw undefined;
      },
    }, {});
  } catch (failure) { caught = true; error = failure; }
  expect(caught).toBe(true);
  expect(error).toBeUndefined();
  expect(undefinedNotices).toEqual([false]);
  expect(undefinedBody.events).toEqual([]);
  expect(undefinedBody.game.world.activeDeathActionCount).toBe(0);

  const trueFailure = new Error("literal_true_notification_failure"), completed = fixture(), completedNotices: boolean[] = [];
  await expect(completed.window.collect([5], Phase.Day, Phase.Voting, { 5: [DeathCause.Exile] }, {
    async getAction(request) {
      expect(deferRequestDelivery(request, accepted => { completedNotices.push(accepted); throw trueFailure; })).toBe(true);
      return speak("literal-true-prefix");
    },
  }, {})).rejects.toBe(trueFailure);
  expect(completedNotices).toEqual([true]);
  expect(completed.events).toHaveLength(1);
  expect(completed.game.world.activeDeathActionCount).toBe(0);
});
