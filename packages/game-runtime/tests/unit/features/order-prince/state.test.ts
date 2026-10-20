/**
 * 单元测试验证定序王子原状态接受、同引用读取、脱离知识和下一选择准备；输入为原内存fixture、
 * 明确非法修改、getter／Proxy与日次，原字面预期、拒绝和可写副本是预期。
 * 仅核数据边界，不运行完整对局、模型或真实重投，不在迁移中重写fixture、政策或golden。
 */
import { expect, test } from "bun:test";
import { Camp, type RoleComponent } from "../../../../src/domain";
import {
  ORDER_PRINCE_POLICY,
  createOrderPrinceState,
  getOrderPrinceState,
  nextOrderPrinceChoice,
  projectOrderPrinceState,
} from "../../../../src/features/order-prince/state-slot";

// 测试自持当前 Camp，不经旧 Role 属性或隐藏映射提供阵营。
const fixtureCamp = { camp: Camp.Good };
const currentCamp = () => fixtureCamp;
function role(state: unknown = createOrderPrinceState()): RoleComponent {
  return {
    role: "order_prince",
    privateState: { orderPrince: state },
    renderPrompt: () => "",
  } as RoleComponent;
}
test("order prince: fresh and detached projections", () => {
  const r = role();
  const copy = projectOrderPrinceState(r, currentCamp)!;
  copy.history.push({ day: 1, activate: false });
  expect(getOrderPrinceState(r, currentCamp)?.history).toEqual([]);
  expect(copy.policy).toBe(ORDER_PRINCE_POLICY);
});
test("order prince: pass permits a later first ballot, activation consumes once", () => {
  const r = role();
  const pass = nextOrderPrinceChoice(r, 1, false, currentCamp)!;
  expect(pass.history).toEqual([{ day: 1, activate: false }]);
  expect(getOrderPrinceState(r, currentCamp)?.history).toEqual([]);
  (r.privateState as Record<string, unknown>).orderPrince = pass;
  expect(nextOrderPrinceChoice(r, 1, true, currentCamp)).toBeUndefined();
  const active = nextOrderPrinceChoice(r, 2, true, currentCamp)!;
  (r.privateState as Record<string, unknown>).orderPrince = active;
  expect(nextOrderPrinceChoice(r, 3, false, currentCamp)).toBeUndefined();
  expect(nextOrderPrinceChoice(r, 3, true, currentCamp)).toBeUndefined();
  expect(projectOrderPrinceState(r, currentCamp)?.history).toEqual([
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
      expect(
        getOrderPrinceState(role({ policy: ORDER_PRINCE_POLICY, history }), currentCamp),
      ).toBeUndefined();
    },
  );
test("order prince: reject invalid current choice without mutation", () => {
  const r = role();
  for (const day of [0, -1, 1.1, NaN, Infinity, Number.MAX_SAFE_INTEGER])
    expect(nextOrderPrinceChoice(r, day, true, currentCamp)).toBeUndefined();
  expect(nextOrderPrinceChoice(r, 1, "true" as unknown as boolean, currentCamp)).toBeUndefined();
  expect(getOrderPrinceState(r, currentCamp)?.history).toEqual([]);
});
test("order prince: validate role, camp, state policy and exact keys", () => {
  for (const [bad, source] of [
    [{ ...role(), role: "magician" }, currentCamp],
    [role(), () => ({ camp: Camp.Wolf })],
    [role({ policy: "other", history: [] }), currentCamp],
    [role({ policy: ORDER_PRINCE_POLICY, history: [], used: false }), currentCamp],
    [role({ history: [] }), currentCamp],
  ] as const)
    expect(getOrderPrinceState(bad as RoleComponent, source)).toBeUndefined();
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
    getOrderPrinceState(role({ policy: ORDER_PRINCE_POLICY, history: [getter] }), currentCamp),
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
  expect(getOrderPrinceState(proxy as RoleComponent, currentCamp)).toBeUndefined();
  expect(getOrderPrinceState(role(proxy), currentCamp)).toBeUndefined();
  expect(calls).toBe(0);
});
test("order prince: reject sparse and augmented history arrays", () => {
  const sparse = Array(1);
  expect(
    getOrderPrinceState(role({ policy: ORDER_PRINCE_POLICY, history: sparse }), currentCamp),
  ).toBeUndefined();
  const augmented = Object.assign([], { extra: true });
  expect(
    getOrderPrinceState(role({ policy: ORDER_PRINCE_POLICY, history: augmented }), currentCamp),
  ).toBeUndefined();
});

test("order prince: projected history rows are deeply detached", () => {
  const r = role({ policy: ORDER_PRINCE_POLICY, history: [{ day: 1, activate: false }] });
  const projected = projectOrderPrinceState(r, currentCamp)!;
  projected.history[0]!.day = 99;
  projected.history[0]!.activate = true;
  expect(getOrderPrinceState(r, currentCamp)?.history).toEqual([{ day: 1, activate: false }]);
});
