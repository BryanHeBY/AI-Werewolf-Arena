import { expect, test, setSystemTime } from "bun:test";
import type { ActionRequest } from "../../../src/core/domain/actions";
import { Phase } from "../../../src/core/domain/identity";
import {
  assertRequestDelivery,
  deferRequestDelivery,
} from "../../../src/core/domain/request_delivery";
import { fragrantPairOwnerFixture } from "../fragrant_pair_seer_fixture";
import {
  openFragrantPairRequest,
  fragrantPairRequestScope,
  inheritFragrantPairDeadlineRequest,
  readFragrantPairTool,
  canSubmitFragrantPairChoice,
  commitFragrantPairChoice,
  closeFragrantPairRequest,
} from "../../../src/game/mechanisms/roles/fragrant_pair_seer/requests";
import { findNightAbility } from "../../../src/game/mechanisms/roles/abilities";
function fixture(kind: "bind" | "pair" = "pair", nightHook?: () => boolean) {
  const f = fragrantPairOwnerFixture(undefined, nightHook);
  f.open();
  const name = kind === "bind" ? "bind_fragrant_pair" : "check_pair",
    request: ActionRequest = {
      actorId: kind === "bind" ? 1 : 5,
      phase: Phase.Night,
      allowedTools: [name],
      context: {
        day: 1,
        stage: kind === "bind" ? "fragrant_bind" : "pair_inspection",
        visible_events: [],
        allow_fallback: false,
        action_failure_policy: "error",
        turn_constraints: {
          min_valid_actions: 1,
          max_valid_actions: 1,
          required_any_tools: [name],
        },
        ...(kind === "bind"
          ? { fragrant_pair_candidates: Array.from({ length: 12 }, (_, i) => i + 1) }
          : {
              pair_check_candidates: Array.from({ length: 12 }, (_, i) => i + 1),
              ability_id: "native:pair_check",
            }),
      },
    };
  return { ...f, kind, request };
}
test("only engine-bound exact request commits one pair and settles delivery once after domain write", () => {
  const f = fixture(),
    scope = openFragrantPairRequest(f.world, 1, f.kind, f.request),
    receipts: boolean[] = [];
  assertRequestDelivery(f.request);
  expect(
    deferRequestDelivery(f.request, (accepted) => {
      expect(findNightAbility(f.role(5), "pair_check")!.uses).toBe(1);
      receipts.push(accepted);
    }),
  ).toBe(true);
  expect(
    canSubmitFragrantPairChoice(
      f.world,
      5,
      Phase.Night,
      1,
      {},
      { name: "check_pair", args: { target_ids: [5, 6] } },
    ),
  ).toBe(false);
  expect(
    commitFragrantPairChoice(f.world, scope, { name: "check_pair", args: { target_ids: [6, 5] } }),
  ).toEqual({
    actorId: 5,
    day: 1,
    targetIds: [5, 6],
    containsWerewolf: false,
  });
  expect(receipts).toEqual([true]);
  expect(fragrantPairRequestScope(f.world, f.request)).toBeUndefined();
  expect(() => assertRequestDelivery(f.request)).toThrow();
  expect(() =>
    commitFragrantPairChoice(f.world, scope, { name: "check_pair", args: { target_ids: [5, 6] } }),
  ).toThrow();
  closeFragrantPairRequest(scope);
  expect(receipts).toEqual([true]);
});
test("bind explicit null is legal, while pair null and malformed/extra targets are not repaired", () => {
  const f = fixture("bind"),
    scope = openFragrantPairRequest(f.world, 1, f.kind, f.request);
  expect(
    commitFragrantPairChoice(f.world, scope, {
      name: "bind_fragrant_pair",
      args: { target_ids: null },
    }),
  ).toEqual({ actorId: 1, day: 1, pairIds: null });
  expect(readFragrantPairTool({ name: "check_pair", args: { target_ids: null } })).toBeNull();
  for (const target_ids of [[5], [5, 5], [5, 6, 7], [0, 5], ["5", 6]])
    expect(readFragrantPairTool({ name: "check_pair", args: { target_ids } })).toBeNull();
  expect(
    readFragrantPairTool({ name: "check_pair", args: { target_ids: [5, 6], count: 1 } }),
  ).toBeNull();
});
test("a bounded deadline alias retains authority and a detached context has none", () => {
  const f = fixture();
  f.request.deadlineAtMs = Date.now() + 10000;
  const scope = openFragrantPairRequest(f.world, 1, f.kind, f.request),
    alias = { ...f.request, deadlineAtMs: Date.now() + 5000 },
    detached = { ...f.request, context: { ...f.request.context }, deadlineAtMs: Date.now() + 4000 };
  inheritFragrantPairDeadlineRequest(f.request, alias);
  inheritFragrantPairDeadlineRequest(f.request, detached);
  expect(fragrantPairRequestScope(f.world, alias)).toBe(scope);
  expect(fragrantPairRequestScope(f.world, detached)).toBeUndefined();
  expect(fragrantPairRequestScope(f.world, f.request)).toBe(scope);
  f.request.context.visible_events.push({ seq: 1, type: "public", payload: {} });
  expect(fragrantPairRequestScope(f.world, alias)).toBeUndefined();
  expect(fragrantPairRequestScope(f.world, f.request)).toBeUndefined();
});
test("a later deadline alias cannot enlarge an already bounded turn", () => {
  const f = fixture();
  f.request.deadlineAtMs = Date.now() + 5000;
  openFragrantPairRequest(f.world, 1, f.kind, f.request);
  const clone = { ...f.request, deadlineAtMs: f.request.deadlineAtMs + 1 };
  inheritFragrantPairDeadlineRequest(f.request, clone);
  expect(fragrantPairRequestScope(f.world, clone)).toBeUndefined();
  expect(fragrantPairRequestScope(f.world, f.request)).toBeDefined();
});
test("all aliases share the earliest deadline and expired authority cannot recover", () => {
  const f = fixture(),
    now = Date.now();
  f.request.deadlineAtMs = now + 10000;
  openFragrantPairRequest(f.world, 1, f.kind, f.request);
  const short = { ...f.request, deadlineAtMs: now + 1000 };
  inheritFragrantPairDeadlineRequest(f.request, short);
  try {
    setSystemTime(new Date(now + 1001));
    expect(fragrantPairRequestScope(f.world, f.request)).toBeUndefined();
    expect(fragrantPairRequestScope(f.world, short)).toBeUndefined();
  } finally {
    setSystemTime();
  }
  expect(fragrantPairRequestScope(f.world, f.request)).toBeUndefined();
  expect(findNightAbility(f.role(5), "pair_check")!.uses).toBe(0);
});
test("invalid original constraints do not acquire a lease, and request close settles pending rejection", () => {
  const f = fixture();
  f.request.context.allow_fallback = true;
  expect(() => openFragrantPairRequest(f.world, 1, f.kind, f.request)).toThrow();
  f.request.context.allow_fallback = false;
  const scope = openFragrantPairRequest(f.world, 1, f.kind, f.request),
    accepted: boolean[] = [];
  expect(deferRequestDelivery(f.request, (value) => accepted.push(value))).toBe(true);
  closeFragrantPairRequest(scope);
  closeFragrantPairRequest(scope);
  expect(accepted).toEqual([false]);
  expect(() =>
    commitFragrantPairChoice(f.world, scope, { name: "check_pair", args: { target_ids: [5, 6] } }),
  ).toThrow();
  expect(findNightAbility(f.role(5), "pair_check")!.uses).toBe(0);
});
for (const kind of ["bind", "pair"] as const)
  for (const atCheck of [2, 3])
    for (const changed of ["close", "context", "events", "deadline"] as const)
      test(`${kind}: domain check ${atCheck} ${changed} revocation cannot leave a paid action`, () => {
        let armed = false,
          checks = 0,
          revoke = () => {};
        const f = fixture(kind, () => {
            if (armed && ++checks === atCheck) revoke();
            return true;
          }),
          now = Date.now(),
          accepted: boolean[] = [];
        f.request.deadlineAtMs = now + 10000;
        const scope = openFragrantPairRequest(f.world, 1, kind, f.request);
        deferRequestDelivery(f.request, (value) => accepted.push(value));
        revoke = () => {
          if (changed === "close") closeFragrantPairRequest(scope);
          else if (changed === "context") f.request.context = { ...f.request.context };
          else if (changed === "events")
            f.request.context.visible_events.push({ seq: 1, type: "public", payload: {} });
          else setSystemTime(new Date(now + 10001));
        };
        armed = true;
        try {
          expect(() =>
            commitFragrantPairChoice(f.world, scope, {
              name: kind === "bind" ? "bind_fragrant_pair" : "check_pair",
              args: { target_ids: [9, 10] },
            }),
          ).toThrow();
        } finally {
          setSystemTime();
          closeFragrantPairRequest(scope);
        }
        expect(accepted).toEqual([false]);
        expect(findNightAbility(f.role(5), "pair_check")!.uses).toBe(0);
        expect(f.role(5).privateState.pairSeer).toMatchObject({ history: [] });
        expect(f.role(1).privateState.fragrant).toMatchObject({ lastChoice: null, bindings: [] });
      });
test("scope query immediately observes a controller closing the request during its own check", () => {
  let revoke = () => {};
  const f = fixture("pair", () => {
      revoke();
      return true;
    }),
    scope = openFragrantPairRequest(f.world, 1, "pair", f.request);
  revoke = () => closeFragrantPairRequest(scope);
  expect(fragrantPairRequestScope(f.world, f.request)).toBeUndefined();
  expect(findNightAbility(f.role(5), "pair_check")!.uses).toBe(0);
});
