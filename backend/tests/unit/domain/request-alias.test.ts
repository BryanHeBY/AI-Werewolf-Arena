/**
 * Unit tests for request-local alias routing and delivery completion ownership.
 * Handwritten callback traces, literal errors and original reference comparisons
 * are independent oracles. A real Noble owner verifies accepted alias chains,
 * foreign-context rejection and closure; no transport or archived input changes.
 */
import { expect, test } from "bun:test";
import { Phase, type ActionRequest } from "../../../src/core";
import {
  assertRequestDelivery,
  bindRequestDeliveryGuard,
  deferRequestDelivery,
  deriveBoundedRequest,
  inheritRequestAlias,
  registerRequestAliasPropagation,
  settleRequestDelivery,
} from "../../../src/core/domain/request_delivery";
import { nobleBodyAuthorityFixture } from "../../support/features/noble-secret-body/drivers/authority";
import {
  beginNobleBodyNight,
  nobleBodyChoiceTargets,
} from "../../../src/game/mechanisms/roles/noble_secret_body/authority";
import {
  closeNobleBodyRequest,
  nobleBodyRequestScope,
  openNobleBodyRequest,
} from "../../../src/game/mechanisms/roles/noble_secret_body/requests";

function request(): ActionRequest {
  return {
    actorId: 1,
    phase: Phase.Day,
    allowedTools: ["speak"],
    context: {
      day: 1,
      stage: "day_speech",
      visible_events: [],
      turn_constraints: {
        min_valid_actions: 0,
        max_valid_actions: 1,
        required_any_tools: ["speak"],
      },
    },
  };
}

test("routing metadata alone grants no guard or completion and leaves JSON untouched", () => {
  const original = request(),
    before = JSON.stringify(original),
    calls: number[] = [];
  registerRequestAliasPropagation(original, 10, () => calls.push(10));
  expect(JSON.stringify(original)).toBe(before);
  expect(() => assertRequestDelivery(original)).not.toThrow();
  expect(deferRequestDelivery(original, () => calls.push(99))).toBe(false);
  const alias = deriveBoundedRequest(original, 12345);
  expect(alias).not.toBe(original);
  expect(alias.context).toBe(original.context);
  expect(alias.allowedTools).toBe(original.allowedTools);
  expect(alias.deadlineAtMs).toBe(12345);
  expect(calls).toEqual([10]);
  let current = true;
  bindRequestDeliveryGuard(original, () => current);
  expect(() => bindRequestDeliveryGuard(original, () => true)).toThrow(
    "action_request_delivery_guard_already_bound",
  );
  current = false;
  expect(() => assertRequestDelivery(original)).toThrow(
    "action_request_delivery_authority_revoked",
  );
  expect(() => assertRequestDelivery(alias)).not.toThrow();
});

test("callbacks run in explicit order, deduplicate identity and stop at the original throw", () => {
  const original = request(),
    trace: number[] = [],
    failure = new TypeError("owner failed");
  const late = () => {
    trace.push(30);
  };
  registerRequestAliasPropagation(original, 30, late);
  registerRequestAliasPropagation(original, 10, () => {
    trace.push(10);
  });
  registerRequestAliasPropagation(original, 20, () => {
    trace.push(20);
    throw failure;
  });
  registerRequestAliasPropagation(original, 30, late);
  let actual: unknown;
  try {
    deriveBoundedRequest(original, 100);
  } catch (error) {
    actual = error;
  }
  expect(actual).toBe(failure);
  expect(trace).toEqual([10, 20]);
});

test("only a successful owner binding routes an alias of an alias and shares completion", () => {
  const original = request(),
    completion = {},
    accepted: boolean[] = [];
  let current = true;
  const bindAlias = (source: ActionRequest, alias: ActionRequest) => {
    expect(alias.context).toBe(source.context);
    bindRequestDeliveryGuard(alias, () => current, completion);
    registerRequestAliasPropagation(alias, 20, bindAlias);
  };
  bindRequestDeliveryGuard(original, () => current, completion);
  registerRequestAliasPropagation(original, 20, bindAlias);
  const first = deriveBoundedRequest(original, 100),
    second = deriveBoundedRequest(first, 90);
  expect(deferRequestDelivery(second, (result) => accepted.push(result))).toBe(true);
  expect(() => deferRequestDelivery(original, () => {})).toThrow(
    "action_request_delivery_already_pending",
  );
  settleRequestDelivery(completion, true);
  settleRequestDelivery(completion, false);
  expect(accepted).toEqual([true]);
  current = false;
  for (const alias of [original, first, second])
    expect(() => assertRequestDelivery(alias)).toThrow();
});

test("settlement removes its receipt before a throwing callback and permits later registration", () => {
  const original = request(),
    completion = {},
    failure = new Error("settlement failed");
  bindRequestDeliveryGuard(original, () => true, completion);
  expect(
    deferRequestDelivery(original, () => {
      throw failure;
    }),
  ).toBe(true);
  let actual: unknown;
  try {
    settleRequestDelivery(completion, false);
  } catch (error) {
    actual = error;
  }
  expect(actual).toBe(failure);
  const accepted: boolean[] = [];
  expect(deferRequestDelivery(original, (result) => accepted.push(result))).toBe(true);
  settleRequestDelivery(completion, true);
  expect(accepted).toEqual([true]);
});

test("registered callbacks cannot authorize a foreign context or change real Noble closure", () => {
  const fixture = nobleBodyAuthorityFixture();
  beginNobleBodyNight(fixture.world, 1, () => true);
  const original: ActionRequest = {
    actorId: 2,
    phase: Phase.Night,
    allowedTools: ["protect_secret_body"],
    context: {
      day: 1,
      stage: "secret_body",
      visible_events: [],
      allow_fallback: false,
      action_failure_policy: "error",
      secret_body_candidates: [...nobleBodyChoiceTargets(fixture.world, 1, "body")],
      turn_constraints: {
        min_valid_actions: 1,
        max_valid_actions: 1,
        required_any_tools: ["protect_secret_body"],
      },
    },
  };
  const scope = openNobleBodyRequest(fixture.world, 1, "body", original);
  try {
    const deadline = Date.now() + 60000,
      first = deriveBoundedRequest(original, deadline),
      second = deriveBoundedRequest(first, deadline - 1),
      foreign = { ...original, context: { ...original.context }, deadlineAtMs: deadline - 2 };
    inheritRequestAlias(original, foreign);
    expect(nobleBodyRequestScope(fixture.world, foreign)).toBeUndefined();
    for (const alias of [original, first, second]) {
      expect(nobleBodyRequestScope(fixture.world, alias)).toBe(scope);
      expect(() => assertRequestDelivery(alias)).not.toThrow();
    }
    closeNobleBodyRequest(scope);
    for (const alias of [original, first, second]) {
      expect(nobleBodyRequestScope(fixture.world, alias)).toBeUndefined();
      expect(() => assertRequestDelivery(alias)).toThrow();
    }
  } finally {
    closeNobleBodyRequest(scope);
  }
});
