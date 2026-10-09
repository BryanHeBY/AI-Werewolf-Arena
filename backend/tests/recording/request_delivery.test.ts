import { expect, test } from "bun:test";
import { RULESET } from "@ai-werewolf-arena/game-catalog";
import { bootstrapGame } from "../../src/app/bootstrap";
import { ReproductionTrace } from "../../src/recording/reproduction";
import { sixPlayerMvpConfig } from "../../src/runtime/scenarios/six_player_mvp";
import { captureCheckpoint } from "../../src/runtime/simulation/reproduction_context";
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
} from "../../src/core";
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
  // The clone has no authority guard; Ghost Bride's separate opaque scope still rejects it.
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
