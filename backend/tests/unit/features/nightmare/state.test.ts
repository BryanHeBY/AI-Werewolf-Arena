/**
 * 单元测试验证噩梦之影独立状态契约；输入是原内存角色、数据字段和明确非法修改。
 * 原字面预期与拒绝断言保留，直接调用同族状态所有者，不运行完整对局、模型或真实传输。
 * 这些测试不以数据形状授予生命／夜许可，也不在迁移中重生成预期或改变状态接受政策。
 */
import { describe, expect, test } from "bun:test";
import type { RoleComponent } from "../../../../src/domain/components/role";
import { Camp } from "../../../../src/domain/identity";
import {
  freshNightmareShadowState,
  getNightmareShadowState,
} from "../../../../src/features/nightmare/state-slot";
// 测试自持当前 Camp，不经旧 Role 属性或隐藏映射提供阵营。
const fixtureCamp = { camp: Camp.Wolf };
const currentCamp = () => fixtureCamp;
function role(state: unknown): RoleComponent {
  return {
    role: "nightmare",
    privateState: { nightmareShadow: state },
  } as unknown as RoleComponent;
}
describe("nightmare shadow private state", () => {
  test("fresh states are independent and use explicit optional/standard defaults", () => {
    const a = freshNightmareShadowState(),
      b = freshNightmareShadowState();
    expect(a.fearActionPolicy).toBe("optional");
    expect(a.wolfActionPolicy).toBe("standard");
    expect(a.packReady).toBe(false);
    expect(a.lastDay).toBeNull();
    expect(a.lastTarget).toBeNull();
    a.history.push({ day: 1, targetId: 2 });
    a.lastDay = 1;
    a.lastTarget = 2;
    a.packReady = true;
    expect(b.history).toEqual([]);
    expect(getNightmareShadowState(role(a), currentCamp)).toBe(a);
  });
  for (const fear of ["optional", "required_when_legal"] as const)
    for (const wolf of ["standard", "no_blast_no_self_knife"] as const)
      test(fear + "/" + wolf, () => {
        const state = freshNightmareShadowState(fear, wolf);
        expect(getNightmareShadowState(role(state), currentCamp)).toBe(state);
      });
  for (const [key, value] of [
    ["policy", "unknown"],
    ["fearActionPolicy", "random"],
    ["wolfActionPolicy", "random"],
    ["packReady", 1],
    ["lastDay", -1],
    ["lastDay", Number.NaN],
    ["lastDay", 1.5],
    ["lastTarget", "2"],
    ["history", {}],
  ] as const)
    test("reject invalid " + key + "/" + String(value), () => {
      const state = { ...freshNightmareShadowState(), [key]: value };
      expect(getNightmareShadowState(role(state), currentCamp)).toBeUndefined();
    });
  test("reject state getters without evaluating them", () => {
    let reads = 0;
    const state = freshNightmareShadowState();
    Object.defineProperty(state, "packReady", {
      get() {
        reads++;
        return false;
      },
    });
    expect(getNightmareShadowState(role(state), currentCamp)).toBeUndefined();
    expect(reads).toBe(0);
  });
  test("reject proxy state and proxy role without reading traps", () => {
    let reads = 0;
    const handler = {
      get() {
        reads++;
        throw new Error("must not read");
      },
    };
    expect(
      getNightmareShadowState(role(new Proxy(freshNightmareShadowState(), handler)), currentCamp),
    ).toBeUndefined();
    expect(
      getNightmareShadowState(new Proxy(role(freshNightmareShadowState()), handler), currentCamp),
    ).toBeUndefined();
    expect(reads).toBe(0);
  });
  test("reject wrong role or camp", () => {
    const r = role(freshNightmareShadowState());
    expect(getNightmareShadowState(r, () => ({ camp: Camp.Good }))).toBeUndefined();
    expect(getNightmareShadowState({ ...r, role: "wolf" } as RoleComponent, currentCamp)).toBeUndefined();
  });
});

test("nightmare rejects revoked history and inconsistent progression", () => {
  const revoked = Proxy.revocable([], {});
  const state = freshNightmareShadowState();
  state.history = revoked.proxy;
  revoked.revoke();
  expect(() => getNightmareShadowState(role(state), currentCamp)).not.toThrow();
  expect(getNightmareShadowState(role(state), currentCamp)).toBeUndefined();
  for (const value of [
    { packReady: true, lastDay: 1, lastTarget: null, history: [{ day: 1, targetId: 2 }] },
    { packReady: false, lastDay: 1, lastTarget: 2, history: [{ day: 1, targetId: 2 }] },
    { packReady: true, lastDay: null, lastTarget: null, history: [] },
    { packReady: true, lastDay: 1, lastTarget: 2, history: [] },
    {
      packReady: true,
      lastDay: 1,
      lastTarget: 2,
      history: [
        { day: 1, targetId: 2 },
        { day: 1, targetId: 2 },
      ],
    },
  ])
    expect(
      getNightmareShadowState(role({ ...freshNightmareShadowState(), ...value }), currentCamp),
    ).toBeUndefined();
});
