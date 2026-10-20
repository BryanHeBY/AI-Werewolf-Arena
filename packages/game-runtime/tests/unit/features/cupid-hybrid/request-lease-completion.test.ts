/**
 * 负责丘比特／混血儿真实请求窗口的新 F02 租约和完成通知测试。
 * 输入为合法六人板、原工厂／网关、请求失配、受控时钟及实例提交／事件异常；输出由字面库存、关系、归属与通知轨迹核对。
 * 原窗口基线另存，本文是独立新政策，不调用生产资格算法生成预期；不运行整局、模型或归档终结。
 * 事件晚错与部分付款都保留现场前缀，但只有全部领域付款正常返回才能 true；通知错误不得盖原错误。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  Camp,
  COMPONENT,
  Phase,
  Role,
  WinCondition,
  type ActionRequest,
  type BoardConfig,
  type GameEvent,
  type ToolCall,
} from "../../../../src/domain";
import { RequestLease } from "../../../../src/domain/request-lease";
import { RULESET } from "@ai-werewolf-arena/game-catalog";
import { ReproductionTrace } from "../../../../src/recording/reproduction/trace";
import { captureCheckpoint } from "../../../../src/app/simulation/reproduction-context";
import {
  assertRequestDelivery,
  deferRequestDelivery,
  deriveBoundedRequest,
} from "../../../../src/domain/request-delivery";
import { CUPID_STAGE } from "../../../../src/features/cupid/night-stage";
import { HYBRID_STAGE, hasHybridNightCommit } from "../../../../src/features/hybrid/night-stage";
import { getCupidState } from "../../../../src/features/cupid/ports";
import { getHybridState } from "../../../../src/features/hybrid/ports";
import { loversRecord } from "../../../../src/features/cupid/relation";
import { GameActionRequestFactory } from "../../../../src/engine/actions/action-request-factory";
import { sixPlayerMvpConfig } from "../../../../src/rulesets/presets/six-player-mvp";
import {
  nightStageContext,
  executeNightStage,
} from "../../../support/builders/night-stage-context";

type Family = "cupid" | "hybrid";
function fixture(family: Family) {
  const roles =
    family === "cupid"
      ? [Role.Cupid, Role.Hunter, Role.Wolf, Role.Villager, Role.Wolf, Role.Villager]
      : [Role.Hybrid, Role.Wolf, Role.HiddenWolf, Role.Seer, Role.Witch, Role.Villager];
  const config = {
    ...sixPlayerMvpConfig,
    boardSize: 6,
    roleSetups: [...new Set(roles)].map((role) => ({
      role,
      count: roles.filter((value) => value === role).length,
    })),
    winConditions: [WinCondition.SlaughterCity],
    enableSheriff: false,
    selfDestruct: { enabledWindows: [] },
    ...(family === "cupid"
      ? { cupid: { policy: "netease_2017_cupid_follows_lovers_v1" as const } }
      : {}),
  };
  const game = bootstrapGame(config, { fixedRoles: roles });
  const events: GameEvent[] = [],
    notifications: boolean[] = [],
    requests: ActionRequest[] = [];
  const actor = game.world.getComponent(1, COMPONENT.Role)!;
  const state = family === "cupid" ? getCupidState(actor)! : getHybridState(actor)!;
  const originalVictory = game.world.getComponent(1, COMPONENT.Victory)!;
  const factory = new GameActionRequestFactory(game.world, events, 1);
  const action: ToolCall =
    family === "cupid"
      ? { name: "choose_lovers", args: { first_id: 1, second_id: 3 } }
      : { name: "choose_exemplar", args: { target_id: 2 } };
  let current = true;
  const context = (
    provider: (request: ActionRequest) => Promise<ToolCall | null>,
    notify?: (accepted: boolean) => void,
  ) =>
    nightStageContext({
      world: game.world,
      events,
      isCurrent: () => current,
      getAliveByRole: (value) =>
        game.world
          .getAliveEntityIds()
          .filter((id) => game.world.getComponent(id, COMPONENT.Role)!.role === value),
      makeRequest: (actorId, allowedTools, extra) =>
        factory.create({
          actorId,
          allowedTools,
          phase: Phase.Night,
          stage: extra.stage,
          requiresAction: extra.requiresAction ?? true,
          summary: "Offline",
          context: extra,
        }),
      actionProvider: {
        getAction: async (request) => {
          requests.push(request);
          expect(
            deferRequestDelivery(request, (accepted) => {
              notifications.push(accepted);
              notify?.(accepted);
            }),
          ).toBe(true);
          return provider(request);
        },
      },
    });
  return {
    family,
    game,
    events,
    state,
    originalVictory,
    notifications,
    requests,
    action,
    context,
    invalidate() {
      current = false;
    },
    restore() {
      current = true;
    },
    execute(ctx: ReturnType<typeof context>) {
      return executeNightStage(family === "cupid" ? CUPID_STAGE : HYBRID_STAGE)(ctx);
    },
  };
}
function expectUnpaid(f: ReturnType<typeof fixture>) {
  expect(f.state.remaining).toBe(1);
  expect(f.state.choice).toBeNull();
  expect(f.game.world.getComponent(1, COMPONENT.Victory)).toBe(f.originalVictory);
  expect(loversRecord(f.game.world)).toBeNull();
  expect(f.events).toEqual([]);
}
function expectPaid(f: ReturnType<typeof fixture>) {
  expect(f.state.remaining).toBe(0);
  expect(f.state.choice).toEqual(
    f.family === "cupid" ? { day: 1, pairIds: [1, 3] } : { day: 1, targetId: 2 },
  );
  expect(f.game.world.getComponent(1, COMPONENT.Victory)!.affiliations).toEqual(
    f.family === "cupid"
      ? [{ kind: "relationship", groupId: "cupid_lovers" }]
      : [{ kind: "faction", faction: Camp.Wolf }],
  );
  expect(
    f.family === "cupid"
      ? loversRecord(f.game.world)?.pairIds
      : hasHybridNightCommit(f.game.world, 1),
  ).toEqual(f.family === "cupid" ? [1, 3] : true);
}

for (const family of ["cupid", "hybrid"] as const)
  test(`${family}: observed original envelope failure cannot recover into payment`, async () => {
    const f = fixture(family);
    await expect(
      f.execute(
        f.context(async (request) => {
          const context = request.context;
          request.context = { ...context };
          expect(() => assertRequestDelivery(request)).toThrow(
            "action_request_delivery_authority_revoked",
          );
          request.context = context;
          expect(() => assertRequestDelivery(request)).toThrow(
            "action_request_delivery_authority_revoked",
          );
          return f.action;
        }),
      ),
    ).rejects.toThrow(`${family}_valid_action_missing`);
    expect(f.notifications).toEqual([false]);
    expectUnpaid(f);
  });

test("Hybrid: observed domain cancellation remains closed after restoration", async () => {
  const f = fixture("hybrid");
  await expect(
    f.execute(
      f.context(async (request) => {
        f.invalidate();
        expect(() => assertRequestDelivery(request)).toThrow(
          "action_request_delivery_authority_revoked",
        );
        f.restore();
        expect(() => assertRequestDelivery(request)).toThrow(
          "action_request_delivery_authority_revoked",
        );
        return f.action;
      }),
    ),
  ).rejects.toThrow("hybrid_valid_action_missing");
  expect(f.notifications).toEqual([false]);
  expectUnpaid(f);
});

test("both windows isolate an alias context and observe the shared earliest deadline before rollback", async () => {
  const now = Date.now;
  try {
    for (const family of ["cupid", "hybrid"] as const) {
      const f = fixture(family);
      let clock = 5_000;
      Date.now = () => clock;
      await expect(
        f.execute(
          f.context(async (request) => {
            const alias = deriveBoundedRequest(request, 8_000);
            assertRequestDelivery(alias);
            alias.context = { ...alias.context };
            expect(() => assertRequestDelivery(alias)).toThrow(
              "action_request_delivery_authority_revoked",
            );
            assertRequestDelivery(request);
            const unknown = deriveBoundedRequest(request, 9_000);
            expect(
              deferRequestDelivery(unknown, () => {
                throw new Error("unregistered_alias_notification");
              }),
            ).toBe(false);
            assertRequestDelivery(request);
            const shorter = deriveBoundedRequest(request, 6_000);
            assertRequestDelivery(shorter);
            clock = 6_001;
            expect(() => assertRequestDelivery(request)).toThrow(
              "action_request_delivery_authority_revoked",
            );
            clock = 5_000;
            expect(() => assertRequestDelivery(request)).toThrow(
              "action_request_delivery_authority_revoked",
            );
            return f.action;
          }),
        ),
      ).rejects.toThrow(`${family}_valid_action_missing`);
      expect(f.notifications).toEqual([false]);
      expectUnpaid(f);
      Date.now = now;
    }
  } finally {
    Date.now = now;
  }
});

for (const family of ["cupid", "hybrid"] as const) {
  test(`${family}: partial payment keeps the original error and prefix when false notification also throws`, async () => {
    const f = fixture(family),
      error = new Error("original_membership_install_failure"),
      notifyError = new Error("later_false_notice_failure");
    const add = f.game.world.addComponent;
    f.game.world.addComponent = function (id, component, value) {
      if (id === 1 && component === COMPONENT.Victory) throw error;
      return add.call(this, id, component, value);
    };
    try {
      await expect(
        f.execute(
          f.context(
            async () => f.action,
            () => {
              throw notifyError;
            },
          ),
        ),
      ).rejects.toBe(error);
    } finally {
      f.game.world.addComponent = add;
    }
    expect(f.notifications).toEqual([false]);
    expect(f.state.remaining).toBe(0);
    expect(f.state.choice).toEqual(
      family === "cupid" ? { day: 1, pairIds: [1, 3] } : { day: 1, targetId: 2 },
    );
    expect(f.game.world.getComponent(1, COMPONENT.Victory)).toBe(f.originalVictory);
    expect(
      family === "cupid"
        ? loversRecord(f.game.world)?.pairIds
        : hasHybridNightCommit(f.game.world, 1),
    ).toEqual(family === "cupid" ? [1, 3] : false);
    expect(f.events).toEqual([]);
    expect(() => assertRequestDelivery(f.requests[0]!)).toThrow(
      "action_request_delivery_authority_revoked",
    );
  });

  test(`${family}: late fact failure preserves one true completion and the complete payment`, async () => {
    const f = fixture(family),
      error = new Error("late_chosen_fact_failure");
    Object.defineProperty(f.events, "push", {
      configurable: true,
      value: () => {
        throw error;
      },
    });
    try {
      await expect(f.execute(f.context(async () => f.action))).rejects.toBe(error);
    } finally {
      delete (f.events as unknown as { push?: unknown }).push;
    }
    expectPaid(f);
    expect(f.notifications).toEqual([true]);
    expect(f.events).toEqual([]);
    expect(() => assertRequestDelivery(f.requests[0]!)).toThrow(
      "action_request_delivery_authority_revoked",
    );
  });
}

test("Hybrid: true notification failure occurs after full payment and cannot produce a second false", async () => {
  const f = fixture("hybrid"),
    error = new Error("true_notice_failure");
  await expect(
    f.execute(
      f.context(
        async () => f.action,
        () => {
          throw error;
        },
      ),
    ),
  ).rejects.toBe(error);
  expectPaid(f);
  expect(f.notifications).toEqual([true]);
  expect(f.events).toEqual([]);
});

test("both windows false-close provider cancellation or failure without spending", async () => {
  for (const family of ["cupid", "hybrid"] as const)
    for (const mode of ["cancel", "throw"] as const) {
      const f = fixture(family),
        error = new Error("provider_failure");
      const operation = f.execute(
        f.context(async () => {
          if (mode === "throw") throw error;
          f.invalidate();
          return f.action;
        }),
      );
      if (mode === "throw") await expect(operation).rejects.toBe(error);
      else await operation;
      expect(f.notifications).toEqual([false]);
      expectUnpaid(f);
    }
});

test("Cupid: invalid attempt closes false and a fresh request alone completes true before facts", async () => {
  const f = fixture("cupid");
  let calls = 0;
  await f.execute(
    f.context(
      async () => (++calls === 1 ? null : f.action),
      (accepted) => {
        if (accepted) {
          expect(f.events).toEqual([]);
          expect(f.state.remaining).toBe(0);
        }
      },
    ),
  );
  expect(calls).toBe(2);
  expect(f.requests[0]).not.toBe(f.requests[1]);
  expect(f.notifications).toEqual([false, true]);
  expectPaid(f);
  expect(f.events.map((event) => event.type)).toEqual([
    "cupid_lovers_chosen",
    "lover_recognized",
    "lover_recognized",
    "cupid_relation_resolved",
  ]);
});

interface DynamicScope {
  actor: number;
  day: number;
  current: boolean;
}
function dynamicLease(keys: readonly string[] = []) {
  return RequestLease.window<DynamicScope>(
    {
      actorId: (scope) => scope.actor,
      day: (scope) => scope.day,
      phase: () => Phase.Day,
      stage: () => "last_words",
      current: (scope) => scope.current,
    },
    130,
    keys,
  );
}
function dynamicRequest(): ActionRequest {
  return {
    actorId: 4,
    phase: Phase.Day,
    allowedTools: ["speak"],
    context: {
      day: 7,
      stage: "last_words",
      trigger: "last_words",
      death_phase: Phase.Night,
      death_action_id: 7,
      visible_events: [],
      turn_constraints: {
        min_valid_actions: 1,
        max_valid_actions: 1,
        required_any_tools: ["speak"],
      },
    },
  };
}

test("dynamic protocol owns non-first-day pins, aliases before and after open, and foreign-scope isolation", () => {
  const lease = dynamicLease(["trigger", "death_phase", "death_action_id"]),
    scope = { actor: 4, day: 7, current: true };
  const request = dynamicRequest();
  lease.bind(scope, request);
  const alias = deriveBoundedRequest(request, Date.now() + 60_000);
  expect(lease.scope({ ...scope }, request)).toBeUndefined();
  expect(lease.scope(scope, request)).toBe(scope);
  const turn = lease.openDelivery(scope, request)!;
  assertRequestDelivery(alias);
  const next = deriveBoundedRequest(alias, Date.now() + 30_000);
  expect(lease.scope(scope, next)).toBe(scope);
  assertRequestDelivery(next);
  const notices: boolean[] = [];
  expect(deferRequestDelivery(next, (accepted) => notices.push(accepted))).toBe(true);
  request.context.death_action_id = 8;
  expect(lease.scope(scope, request)).toBeUndefined();
  request.context.death_action_id = 7;
  expect(lease.scope(scope, request)).toBeUndefined();
  turn.close();
  turn.complete();
  expect(notices).toEqual([false]);
});

test("dynamic context getters remain executable input and capture failure leaves an unrebindable closed request", () => {
  const error = new Error("declared_context_getter_failure"),
    lease = dynamicLease(["death_action_id"]);
  const scope = { actor: 4, day: 7, current: true },
    request = dynamicRequest();
  Object.defineProperty(request.context, "death_action_id", {
    configurable: true,
    enumerable: true,
    get() {
      throw error;
    },
  });
  expect(() => lease.bind(scope, request)).toThrow(error);
  Object.defineProperty(request.context, "death_action_id", {
    configurable: true,
    enumerable: true,
    value: 7,
  });
  lease.bind(scope, request);
  expect(lease.scope(scope, request)).toBeUndefined();
  expect(lease.openDelivery(scope, request)).toBeUndefined();
});

// 真实 Trace 接线独立验证“返回了 action 但领域失败”的归档事实，不用 verifier 计算预期。
test("real Trace records one deferred error while both windows retain partial membership payment", async () => {
  for (const family of ["cupid", "hybrid"] as const) {
    const f = fixture(family),
      error = new Error("trace_partial_membership_failure");
    let notices = 0;
    const ids = f.game.world.entityIds();
    const trace = new ReproductionTrace(
      {
        engine: { id: "awa-engine", sourceHash: "a".repeat(64), lockHash: "b".repeat(64) },
        random: f.game.random.metadata,
        ruleset: RULESET,
        boardId: "lease_" + family,
        // 原 bootstrap 规范化配置是同一实际输入；类型别名不添加字段或改变录制格式。
        normalizedBoard: f.game.boardConfig as unknown as BoardConfig,
        locale: "zh-CN",
        maxDays: 1,
        dealMode: "fixed",
        players: ids.map((id) => ({
          id,
          name: "P" + id,
          role: f.game.world.getComponent(id, COMPONENT.Role)!.role,
          camp: f.game.world.getComponent(id, COMPONENT.Camp)!.camp,
        })),
      },
      () => {
        notices++;
      },
    );
    const snapshot = { ...f.game.phaseManager.getSnapshot(), day: 1, phase: Phase.Night };
    trace.checkpoint(captureCheckpoint(f.game.world, snapshot, 0, true, 0), []);
    notices = 0;
    const ctx = f.context(async () => f.action);
    const requests = new GameActionRequestFactory(f.game.world, f.events, 1);
    // 与真实 NightPipeline 相同：构造选项不是 context 字段；只把其余机制数据交给工厂复制。
    // 旧13个声明的局部输入保持，只有此归档用例改为实际生产请求形状，不放宽严格 schema。
    ctx.makeRequest = (actorId, allowedTools, extra) => {
      const { stage, requiresAction = true, ...context } = extra;
      return requests.create({
        actorId,
        allowedTools,
        phase: Phase.Night,
        stage,
        requiresAction,
        summary: "Offline",
        context,
      });
    };
    // 此输入只让真实 Trace 登记 completion；不叠加前面局部通知 oracle 的另一 pending 回调。
    ctx.actionProvider = {
      getAction: (request) => trace.decide(request, { getAction: async () => f.action }),
    };
    const add = f.game.world.addComponent;
    f.game.world.addComponent = function (id, component, value) {
      if (id === 1 && component === COMPONENT.Victory) throw error;
      return add.call(this, id, component, value);
    };
    try {
      await expect(f.execute(ctx)).rejects.toBe(error);
    } finally {
      f.game.world.addComponent = add;
    }
    expect(notices).toBe(2);
    expect(trace.decisionCount).toBe(1);
    expect(trace.settlementCount).toBe(1);
    expect(f.state.remaining).toBe(0);
    expect(f.state.choice).toEqual(
      family === "cupid" ? { day: 1, pairIds: [1, 3] } : { day: 1, targetId: 2 },
    );
    expect(f.game.world.getComponent(1, COMPONENT.Victory)).toBe(f.originalVictory);
    expect(f.events).toEqual([]);
    trace.checkpoint(captureCheckpoint(f.game.world, snapshot, 1, false, 0, error), []);
    const record = trace.build();
    expect(record.decisions).toHaveLength(1);
    expect(record.decisions[0]).toMatchObject({
      openedAfterSettlement: 0,
      settleOrder: 1,
      outcome: { kind: "error", code: "decision_failed", name: "Error" },
    });
    expect(record.checkpoints[1]!.complete).toBe(false);
    expect(
      record.checkpoints[1]!.players.find((player) => player.id === 1)!.privateState[family],
    ).toMatchObject({
      remaining: 0,
      choice: family === "cupid" ? { day: 1, pairIds: [1, 3] } : { day: 1, targetId: 2 },
    });
  }
});
