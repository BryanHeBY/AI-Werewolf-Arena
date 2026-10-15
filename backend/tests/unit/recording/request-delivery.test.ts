/**
 * 负责 provider 等待后的请求交付与结算所有权单元测试；输入为受控决定、撤销权限和默认未绑定请求。
 * 输出由原决定／错误身份与字面或不可变 fixture 断言核对，不调用模型或完整对局驱动。
 */
import { expect, test } from "bun:test";
import { RULESET } from "@ai-werewolf-arena/game-catalog";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { ReproductionTrace } from "../../../src/recording/reproduction/trace";
import { parseReproductionRecord } from "../../../src/recording/reproduction/format";
import { sixPlayerMvpConfig } from "../../../src/rulesets/presets/six-player-mvp";
import { captureCheckpoint } from "../../../src/app/simulation/reproduction-context";
import {
  bindRequestDeliveryGuard,
  settleRequestDelivery,
  assertRequestDelivery,
  Role,
  Phase,
  Camp,
  createRandom,
  type ActionRequest,
  type ToolCall,
} from "../../../src/domain";
function fixture() {
  const deck = sixPlayerMvpConfig.roleSetups.flatMap(({ role, count }) =>
      Array<Role>(count).fill(role),
    ),
    game = bootstrapGame(sixPlayerMvpConfig, {
      fixedRoles: deck,
      random: createRandom("delivery-boundary"),
    }),
    trace = new ReproductionTrace(
      {
        engine: { id: "awa-engine", sourceHash: "a".repeat(64), lockHash: "b".repeat(64) },
        random: game.random.metadata,
        ruleset: RULESET,
        boardId: "delivery_boundary",
        normalizedBoard: sixPlayerMvpConfig,
        locale: "zh-CN",
        maxDays: 1,
        dealMode: "fixed",
        players: deck.map((role, i) => ({
          id: i + 1,
          name: `Player ${i + 1}`,
          role,
          camp: role === Role.Wolf ? Camp.Wolf : Camp.Good,
        })),
      },
      () => {},
    );
  trace.checkpoint(captureCheckpoint(game.world, game.phaseManager.getSnapshot(), 0, true, 0), []);
  const request: ActionRequest = {
    actorId: 1,
    phase: Phase.Night,
    allowedTools: ["kill_vote"],
    context: {
      day: 1,
      stage: "wolf_vote",
      visible_events: [],
      turn_constraints: {
        min_valid_actions: 1,
        max_valid_actions: 1,
        required_any_tools: ["kill_vote"],
      },
    },
  };
  return { trace, request };
}
const action: ToolCall = { name: "kill_vote", args: { target_id: 3, abstain: false } };
test("default unbound delivery retains existing decision behavior", async () => {
  const { trace, request } = fixture();
  expect(() => assertRequestDelivery(request)).not.toThrow();
  expect(await trace.decide(request, { getAction: async () => action })).toEqual(action);
  expect(trace.build().decisions[0]!.outcome).toEqual({ kind: "action", action });
});
test("authority revoked during provider await is settled as an error rather than an accepted action", async () => {
  const { trace, request } = fixture();
  let current = true;
  bindRequestDeliveryGuard(request, () => current);
  expect(() => bindRequestDeliveryGuard(request, () => true)).toThrow();
  await expect(
    trace.decide(request, {
      getAction: async () => {
        current = false;
        return action;
      },
    }),
  ).rejects.toThrow("action_request_delivery_authority_revoked");
  expect(trace.build().decisions[0]!.outcome).toEqual({
    kind: "error",
    code: "decision_failed",
    name: "Error",
  });
  expect(trace.build().decisions[0]!.settleOrder).toBe(1);
});
test("a pending authority guard is tied to the original object, with no metadata-based registration", () => {
  const { request } = fixture();
  bindRequestDeliveryGuard(request, () => false);
  expect(() => assertRequestDelivery(request)).toThrow();
  expect(() => assertRequestDelivery(structuredClone(request))).not.toThrow();
  // 副本没有交付权限绑定；鬼新娘的独立不透明 scope 仍会拒绝它。
});
test("provider failures remain their original recorded error even with a revoked delivery guard", async () => {
  const { trace, request } = fixture();
  bindRequestDeliveryGuard(request, () => false);
  const original = new TypeError("private provider error");
  await expect(
    trace.decide(request, {
      getAction: async () => {
        throw original;
      },
    }),
  ).rejects.toBe(original);
  expect(trace.build().decisions[0]!.outcome).toEqual({
    kind: "error",
    code: "decision_failed",
    name: "TypeError",
  });
});

test("transactional recording remains pending until synchronous domain completion and settles once", async () => {
  const { trace, request } = fixture();
  const scope = Object.freeze({});
  bindRequestDeliveryGuard(request, () => true, scope);
  expect(await trace.decide(request, { getAction: async () => action })).toEqual(action);
  expect(trace.build().decisions[0]!.outcome).toEqual({ kind: "pending" });
  settleRequestDelivery(scope, true);
  settleRequestDelivery(scope, false);
  expect(trace.build().decisions[0]!.outcome).toEqual({ kind: "action", action });
  expect(trace.build().decisions[0]!.settleOrder).toBe(1);
});
test("revocation after provider return but before domain commit records an error", async () => {
  const { trace, request } = fixture();
  let current = true;
  const scope = Object.freeze({});
  bindRequestDeliveryGuard(request, () => current, scope);
  await trace.decide(request, { getAction: async () => action });
  current = false;
  settleRequestDelivery(scope, current);
  expect(trace.build().decisions[0]!.outcome).toEqual({
    kind: "error",
    code: "decision_failed",
    name: "Error",
  });
});
test("action copying rejects accessors without executing their side effects", async () => {
  const { trace, request } = fixture();
  let calls = 0;
  const exotic = {
    name: "kill_vote",
    args: {
      get target_id() {
        calls++;
        return 3;
      },
      abstain: false,
    },
  } as ToolCall;
  await expect(trace.decide(request, { getAction: async () => exotic })).rejects.toThrow(
    "reproduction_action_accessor",
  );
  expect(calls).toBe(0);
  expect(trace.build().decisions[0]!.outcome).toEqual({
    kind: "error",
    code: "decision_failed",
    name: "Error",
  });
});

test("death-action candidate IDs survive strict request serialization", async () => {
  const { trace, request } = fixture();
  request.allowedTools = ["shoot"];
  request.context.stage = "hunter_shot";
  // 严格归档需要字面死亡尝试关联编号；本例只验证候选序列化，不模拟运行时开枪许可。
  request.context.death_action_id = 1;
  request.context.turn_constraints.required_any_tools = ["shoot"];
  request.context.shoot_candidates = [2, 3];
  await trace.decide(request, {
    getAction: async () => ({ name: "shoot", args: { target_id: 2 } }),
  });
  expect(trace.build().decisions[0]!.request.context.shoot_candidates).toEqual([2, 3]);
});
for (const invalid of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])
  test(`strict request serialization rejects invalid death-action candidate ${invalid}`, async () => {
    const { trace, request } = fixture();
    request.context.shoot_candidates = [invalid];
    await trace.decide(request, { getAction: async () => action });
    expect(() => trace.build()).toThrow("reproduction_record_invalid");
  });

test("returned candidate: false completion preserves copied action or explicit null without accepting either", async () => {
  for (const isNull of [true, false]) {
    const { trace, request } = fixture(),
      scope = {};
    const supplied: ToolCall | null = isNull
      ? null
      : { name: "kill_vote", args: { target_id: 3, abstain: false } };
    bindRequestDeliveryGuard(request, () => true, scope);
    await trace.decide(request, { getAction: async () => supplied });
    if (supplied) supplied.args.target_id = 6;
    settleRequestDelivery(scope, false);
    settleRequestDelivery(scope, false);
    const recorded = trace.build().decisions[0]!;
    expect(Object.hasOwn(recorded, "returnedCandidate")).toBe(true);
    expect(recorded.returnedCandidate).toEqual(
      isNull ? null : { name: "kill_vote", args: { target_id: 3, abstain: false } },
    );
    expect(recorded.outcome).toEqual({ kind: "error", code: "decision_failed", name: "Error" });
    expect(trace.settlementCount).toBe(1);
    if (recorded.returnedCandidate?.name === "kill_vote")
      recorded.returnedCandidate.args.target_id = 5;
    expect(trace.build().decisions[0]!.returnedCandidate).toEqual(
      isNull ? null : { name: "kill_vote", args: { target_id: 3, abstain: false } },
    );
  }
});

test("returned candidate: true completion, real provider throw and early delivery refusal keep the field absent", async () => {
  const accepted = fixture(),
    scope = {};
  bindRequestDeliveryGuard(accepted.request, () => true, scope);
  await accepted.trace.decide(accepted.request, { getAction: async () => action });
  settleRequestDelivery(scope, true);
  expect(Object.hasOwn(accepted.trace.build().decisions[0]!, "returnedCandidate")).toBe(false);
  expect(accepted.trace.build().decisions[0]!.outcome).toEqual({ kind: "action", action });
  const thrown = fixture(),
    original = new TypeError("literal provider failure");
  await expect(
    thrown.trace.decide(thrown.request, {
      getAction: async () => {
        throw original;
      },
    }),
  ).rejects.toBe(original);
  expect(Object.hasOwn(thrown.trace.build().decisions[0]!, "returnedCandidate")).toBe(false);
  expect(thrown.trace.build().decisions[0]!.outcome).toEqual({
    kind: "error",
    code: "decision_failed",
    name: "TypeError",
  });
  const refused = fixture();
  bindRequestDeliveryGuard(refused.request, () => false, {});
  await expect(
    refused.trace.decide(refused.request, { getAction: async () => action }),
  ).rejects.toThrow("action_request_delivery_authority_revoked");
  expect(Object.hasOwn(refused.trace.build().decisions[0]!, "returnedCandidate")).toBe(false);
});

test("returned candidate: Tape3 owns the optional fact while Tape2 and malformed presence remain strict", async () => {
  const { trace, request } = fixture();
  await trace.decide(request, { getAction: async () => null });
  const current = trace.build();
  expect(current.schemaVersion).toBe(3);
  const legacy = structuredClone(current);
  legacy.schemaVersion = 2;
  expect(parseReproductionRecord(legacy).schemaVersion).toBe(2);
  const rejected = structuredClone(current);
  rejected.decisions[0]!.outcome = { kind: "error", code: "decision_failed", name: "Error" };
  rejected.decisions[0]!.returnedCandidate = null;
  expect(parseReproductionRecord(rejected).decisions[0]!.returnedCandidate).toBeNull();
  const known = structuredClone(rejected);
  known.decisions[0]!.returnedCandidate = {
    name: "kill_vote",
    args: { target_id: 3, abstain: false },
  };
  expect(parseReproductionRecord(known).decisions[0]!.returnedCandidate).toEqual({
    name: "kill_vote",
    args: { target_id: 3, abstain: false },
  });
  const oldWithNew = structuredClone(rejected);
  oldWithNew.schemaVersion = 2;
  expect(() => parseReproductionRecord(oldWithNew)).toThrow("reproduction_record_invalid");
  for (const outcome of [
    { kind: "pending" },
    { kind: "action", action: null },
    { kind: "error", code: "decision_failed", name: "TypeError" },
  ] as const) {
    const bad = structuredClone(rejected);
    bad.decisions[0]!.outcome = outcome;
    expect(() => parseReproductionRecord(bad)).toThrow("reproduction_record_invalid");
  }
  for (const value of [
    undefined,
    { name: "unknown_tool", args: {} },
    { name: "kill_vote", args: { target_id: () => 3 } },
  ]) {
    const bad = structuredClone(rejected);
    Object.defineProperty(bad.decisions[0]!, "returnedCandidate", {
      value,
      enumerable: true,
      configurable: true,
    });
    expect(() => parseReproductionRecord(bad)).toThrow("reproduction_record_invalid");
  }
  const inherited = structuredClone(rejected);
  delete inherited.decisions[0]!.returnedCandidate;
  Object.setPrototypeOf(inherited.decisions[0]!, { returnedCandidate: null });
  expect(() => parseReproductionRecord(inherited)).toThrow("reproduction_record_invalid");
  const accessor = structuredClone(rejected);
  let calls = 0;
  Object.defineProperty(accessor.decisions[0]!, "returnedCandidate", {
    enumerable: true,
    get() {
      calls++;
      return null;
    },
  });
  expect(() => parseReproductionRecord(accessor)).toThrow("reproduction_record_invalid");
  expect(calls).toBe(0);
  const future = structuredClone(rejected) as unknown as { schemaVersion: number };
  future.schemaVersion = 4;
  expect(() => parseReproductionRecord(future)).toThrow("reproduction_schema_not_supported");
});

test("returned candidate: legacy Tape2 keeps one version precheck read and the original schema read", async () => {
  const { trace, request } = fixture();
  await trace.decide(request, { getAction: async () => null });
  const legacy = trace.build();
  legacy.schemaVersion = 2;
  let reads = 0;
  Object.defineProperty(legacy, "schemaVersion", {
    enumerable: true,
    configurable: true,
    get() {
      reads++;
      return 2;
    },
  });
  expect(parseReproductionRecord(legacy).schemaVersion).toBe(2);
  expect(reads).toBe(2);
  const changesVersion = trace.build();
  reads = 0;
  Object.defineProperty(changesVersion, "schemaVersion", {
    enumerable: true,
    get() {
      return ++reads === 1 ? 2 : 3;
    },
  });
  expect(() => parseReproductionRecord(changesVersion)).toThrow("reproduction_record_invalid");
  expect(reads).toBe(2);
});
