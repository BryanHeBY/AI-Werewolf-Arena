/**
 * 单元测试验证诡术师状态／选择与放逐映射纯契约。输入为原内存角色、显式非法变更及号码；
 * 原字面预期、身份和拒绝断言保持，不组装整局或模型，不把测试自有对象变更当生产授权。
 */
import { expect, test } from "bun:test";
import { Camp, type RoleComponent } from "../../../../src/domain";
import {
  createTricksterState,
  getTricksterState,
  projectTricksterState,
  nextTricksterChoice,
  TRICKSTER_POLICY,
} from "../../../../src/features/trickster/state-slot";
import {
  matchingExchangePairs,
  mapTricksterExileTarget,
} from "../../../../src/features/trickster/exile-mapping";
// 测试自持当前 Camp，不经旧 Role 属性或隐藏映射提供阵营。
const fixtureCamp = { camp: Camp.Wolf };
const currentCamp = () => fixtureCamp;
function role(state: unknown = createTricksterState()): RoleComponent {
  return {
    role: "trickster",
    privateState: { trickster: state },
  } as unknown as RoleComponent;
}
test("trickster immutable choice consumes distinct numbers and canonicalizes pair", () => {
  const r = role(),
    before = projectTricksterState(r, currentCamp)!;
  const next = nextTricksterChoice(r, 1, [4, 2], [1, 2, 3, 4], currentCamp);
  expect(next.history).toEqual([{ day: 1, pair: [2, 4] }]);
  expect(projectTricksterState(r, currentCamp)).toEqual(before);
  expect(() => nextTricksterChoice(role(next), 2, [2, 3], [1, 2, 3, 4], currentCamp)).toThrow(
    "trickster_target_invalid",
  );
  expect(nextTricksterChoice(role(next), 2, null, [1, 3], currentCamp).history).toHaveLength(2);
});
test("trickster cannot voluntarily pass consecutive nights", () => {
  const one = nextTricksterChoice(role(), 1, null, [1, 2], currentCamp);
  expect(() => nextTricksterChoice(role(one), 2, null, [1, 2], currentCamp)).toThrow(
    "trickster_consecutive_pass",
  );
  const two = nextTricksterChoice(role(one), 2, [1, 2], [1, 2], currentCamp);
  expect(nextTricksterChoice(role(two), 3, null, [3, 4], currentCamp).history).toHaveLength(3);
});
test("trickster projection is deeply detached", () => {
  const r = role({ policy: TRICKSTER_POLICY, history: [{ day: 1, pair: [1, 2] }] });
  const projected = projectTricksterState(r, currentCamp)!;
  projected.history[0]!.pair![0] = 8;
  expect(getTricksterState(r, currentCamp)!.history[0]!.pair).toEqual([1, 2]);
});
for (const history of [
  [{ day: 1, pair: [1, 1] }],
  [{ day: 1, pair: [2, 1] }],
  [{ day: 0, pair: null }],
  [
    { day: 1, pair: [1, 2] },
    { day: 2, pair: [2, 3] },
  ],
  [
    { day: 1, pair: null },
    { day: 2, pair: null },
  ],
  [
    { day: 2, pair: [1, 2] },
    { day: 1, pair: [3, 4] },
  ],
  [{ day: 1, pair: [1, Number.MAX_SAFE_INTEGER] }],
])
  test("trickster rejects invalid history " + JSON.stringify(history), () => {
    expect(
      getTricksterState(role({ policy: TRICKSTER_POLICY, history }), currentCamp),
    ).toBeUndefined();
  });
test("trickster rejects accessors and proxies without invoking user code", () => {
  let calls = 0;
  const raw = {
    policy: TRICKSTER_POLICY,
    get history() {
      calls++;
      return [];
    },
  };
  expect(getTricksterState(role(raw), currentCamp)).toBeUndefined();
  const proxy = new Proxy(createTricksterState(), {
    get() {
      calls++;
      throw new Error("accessed");
    },
  });
  expect(getTricksterState(role(proxy), currentCamp)).toBeUndefined();
  const pair = [1, 2];
  Object.defineProperty(pair, "0", {
    get() {
      calls++;
      return 1;
    },
  });
  expect(() =>
    nextTricksterChoice(role(), 1, pair as [number, number], [1, 2], currentCamp),
  ).toThrow();
  expect(calls).toBe(0);
});
test("trickster rejects foreign camp, policy and target", () => {
  const r = role();
  const wrongCamp = { camp: Camp.Good };
  expect(getTricksterState(r, () => wrongCamp)).toBeUndefined();
  expect(getTricksterState(role({ policy: "unknown", history: [] }), currentCamp)).toBeUndefined();
  expect(() => nextTricksterChoice(role(), 1, [1, 3], [1, 2], currentCamp)).toThrow();
  expect(() => nextTricksterChoice(role(), 0, [1, 2], [1, 2], currentCamp)).toThrow();
});
test("trickster maps only final output once and preserves passed input", () => {
  const pair: [number, number] = [2, 6];
  expect(mapTricksterExileTarget(2, pair)).toBe(6);
  expect(mapTricksterExileTarget(6, pair)).toBe(2);
  expect(mapTricksterExileTarget(3, pair)).toBe(3);
  expect(mapTricksterExileTarget(null, pair)).toBeNull();
  expect(pair).toEqual([2, 6]);
});
test("identical unordered pairs cancel effects without mutating spent history", () => {
  const state = nextTricksterChoice(role(), 1, [2, 6], [2, 6], currentCamp);
  expect(matchingExchangePairs([2, 6], [6, 2])).toBe(true);
  expect(mapTricksterExileTarget(2, state.history[0]!.pair, [6, 2])).toBe(2);
  expect(state.history).toEqual([{ day: 1, pair: [2, 6] }]);
  expect(matchingExchangePairs(null, null)).toBe(false);
  expect(mapTricksterExileTarget(2, [2, 6], [2, 4])).toBe(6);
});
test("trickster mapping rejects malformed pairs", () => {
  expect(() => mapTricksterExileTarget(1, [1, 1])).toThrow();
  expect(() => mapTricksterExileTarget(0, [1, 2])).toThrow();
  let calls = 0;
  const pair = new Proxy([1, 2], {
    get() {
      calls++;
      throw new Error("accessed");
    },
  });
  expect(() => mapTricksterExileTarget(1, pair as [number, number])).toThrow();
  expect(calls).toBe(0);
});
