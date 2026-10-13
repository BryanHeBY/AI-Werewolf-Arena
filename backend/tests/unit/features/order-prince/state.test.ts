/**
 * Unit tests for order-prince; Isolated order-prince state contract; native in-memory owner/frame/readers, no assembled game cycle.
 * Inputs are existing in-memory fixtures, original callback controls and explicit
 * invalid mutations. Original literal expectations, identity snapshots and
 * rejection assertions supply the oracle; none are regenerated during relocation.
 * Test-owned mocks/components exercise this boundary without a model or physical
 * transport. Support files, fixture bytes, policy and state behavior are retained.
 */
import { expect, test } from "bun:test";
import { Camp, type RoleComponent } from "../../../../src/core";
import {
  ORDER_PRINCE_POLICY,
  createOrderPrinceState,
  getOrderPrinceState,
  nextOrderPrinceChoice,
  projectOrderPrinceState,
} from "../../../../src/game/mechanisms/roles/order_prince/state";

function role(state: unknown = createOrderPrinceState()): RoleComponent {
  return {
    role: "order_prince",
    camp: Camp.Good,
    privateState: { orderPrince: state },
    renderPrompt: () => "",
  } as RoleComponent;
}
test("order prince: fresh and detached projections", () => {
  const r = role();
  const copy = projectOrderPrinceState(r)!;
  copy.history.push({ day: 1, activate: false });
  expect(getOrderPrinceState(r)?.history).toEqual([]);
  expect(copy.policy).toBe(ORDER_PRINCE_POLICY);
});
test("order prince: pass permits a later first ballot, activation consumes once", () => {
  const r = role();
  const pass = nextOrderPrinceChoice(r, 1, false)!;
  expect(pass.history).toEqual([{ day: 1, activate: false }]);
  expect(getOrderPrinceState(r)?.history).toEqual([]);
  (r.privateState as Record<string, unknown>).orderPrince = pass;
  expect(nextOrderPrinceChoice(r, 1, true)).toBeUndefined();
  const active = nextOrderPrinceChoice(r, 2, true)!;
  (r.privateState as Record<string, unknown>).orderPrince = active;
  expect(nextOrderPrinceChoice(r, 3, false)).toBeUndefined();
  expect(nextOrderPrinceChoice(r, 3, true)).toBeUndefined();
  expect(projectOrderPrinceState(r)?.history).toEqual([
    { day: 1, activate: false },
    { day: 2, activate: true },
  ]);
});
for (const history of [
  [{ day: 0, activate: false }],
  [{ day: 1.5, activate: false }],
  [{ day: Number.MAX_SAFE_INTEGER, activate: false }],
  [
    { day: 2, activate: false },
    { day: 1, activate: false },
  ],
  [
    { day: 1, activate: false },
    { day: 1, activate: false },
  ],
  [
    { day: 1, activate: true },
    { day: 2, activate: false },
  ],
  [
    { day: 1, activate: true },
    { day: 2, activate: true },
  ],
  [{ day: 1, activate: "false" }],
  [{ day: 1, activate: false, used: false }],
])
  test(
    "order prince: reject malformed or post-consumption history " + JSON.stringify(history),
    () => {
      expect(getOrderPrinceState(role({ policy: ORDER_PRINCE_POLICY, history }))).toBeUndefined();
    },
  );
test("order prince: reject invalid current choice without mutation", () => {
  const r = role();
  for (const day of [0, -1, 1.1, NaN, Infinity, Number.MAX_SAFE_INTEGER])
    expect(nextOrderPrinceChoice(r, day, true)).toBeUndefined();
  expect(nextOrderPrinceChoice(r, 1, "true" as unknown as boolean)).toBeUndefined();
  expect(getOrderPrinceState(r)?.history).toEqual([]);
});
test("order prince: validate role, camp, state policy and exact keys", () => {
  for (const bad of [
    { ...role(), role: "magician" },
    { ...role(), camp: Camp.Wolf },
    role({ policy: "other", history: [] }),
    role({ policy: ORDER_PRINCE_POLICY, history: [], used: false }),
    role({ history: [] }),
  ])
    expect(getOrderPrinceState(bad as RoleComponent)).toBeUndefined();
});
test("order prince: reject accessors and proxies without executing them", () => {
  let calls = 0;
  const getter = {
    get day() {
      calls++;
      return 1;
    },
    activate: false,
  };
  expect(
    getOrderPrinceState(role({ policy: ORDER_PRINCE_POLICY, history: [getter] })),
  ).toBeUndefined();
  const proxy = new Proxy(
    {},
    {
      get() {
        calls++;
        throw Error("unexpected trap");
      },
    },
  );
  expect(getOrderPrinceState(proxy as RoleComponent)).toBeUndefined();
  expect(getOrderPrinceState(role(proxy))).toBeUndefined();
  expect(calls).toBe(0);
});
test("order prince: reject sparse and augmented history arrays", () => {
  const sparse = Array(1);
  expect(
    getOrderPrinceState(role({ policy: ORDER_PRINCE_POLICY, history: sparse })),
  ).toBeUndefined();
  const augmented = Object.assign([], { extra: true });
  expect(
    getOrderPrinceState(role({ policy: ORDER_PRINCE_POLICY, history: augmented })),
  ).toBeUndefined();
});

test("order prince: projected history rows are deeply detached", () => {
  const r = role({ policy: ORDER_PRINCE_POLICY, history: [{ day: 1, activate: false }] });
  const projected = projectOrderPrinceState(r)!;
  projected.history[0]!.day = 99;
  projected.history[0]!.activate = true;
  expect(getOrderPrinceState(r)?.history).toEqual([{ day: 1, activate: false }]);
});
