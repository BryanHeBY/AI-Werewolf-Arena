/**
 * 单元测试验证 nightmare 的独立 frame.test 契约。输入为既有内存 fixture、原回调控制和明确非法
 * 修改；原字面预期、身份快照及拒绝断言是预期，不在迁移中重新生成。仅调用原生内存
 * owner／frame／reader，测试自有 mock／组件不运行完整对局、模型或真实传输，support／fixture 字节及政策状态不变。
 */
import { createAliveComponent } from "../../../../src/game/observation/component-presentation";
import { expect, test } from "bun:test";
import { COMPONENT } from "../../../../src/core/domain/components/names";

import type { RoleComponent } from "../../../../src/core/domain/components/role";
import { Camp } from "../../../../src/core/domain/identity";
import type { World } from "../../../../src/core/domain/world";
import {
  freshNightmareShadowState,
} from "../../../../src/game/mechanisms/roles/nightmare_shadow/state-slot";
import { nightmareFearTargets } from "../../../../src/game/mechanisms/roles/nightmare_shadow/targets";
import {
  installNightmareBoard,
  beginNightmareNight,
  commitNightmareFear,
  nightmareFearBlocks,
  nightmareKnifeBlocked,
  nightmarePackReady,
  assertNightmareRosterCurrent,
} from "../../../../src/game/mechanisms/roles/nightmare_shadow/night_frame";
function fixture(required = false, constructorLocation?: "own" | "inherited") {
  const state = freshNightmareShadowState(required ? "required_when_legal" : "optional");
  const roles = new Map<number, RoleComponent>([
    [
      1,
      {
        role: "nightmare",
        camp: Camp.Wolf,
        privateState: { nightmareShadow: state },
      } as unknown as RoleComponent,
    ],
    [2, { role: "wolf", camp: Camp.Wolf, privateState: {} } as RoleComponent],
    [3, { role: "seer", camp: Camp.Good, privateState: {} } as RoleComponent],
    [4, { role: "hunter", camp: Camp.Good, privateState: {} } as RoleComponent],
  ]);
  const lives = new Map([...roles.keys()].map((id) => [id, createAliveComponent()]));
  const world = {
    entityIds: () => [...roles.keys()],
    getAliveEntityIds: () => [...lives].filter(([, life]) => life.alive).map(([id]) => id),
    getComponent: (id: number, kind: unknown) =>
      kind === COMPONENT.Role
        ? roles.get(id)
        : kind === COMPONENT.Alive
          ? lives.get(id)
          : undefined,
  } as unknown as World;
  if (constructorLocation) {
    const owner =
      constructorLocation === "own" ? state.history : (Object.create(Array.prototype) as object);
    Object.defineProperty(owner, "constructor", {
      get() {
        throw new Error("nightmare_frame_constructor_getter_executed");
      },
    });
    if (constructorLocation === "inherited") Object.setPrototypeOf(state.history, owner);
  }
  installNightmareBoard(world);
  return { world, state, roles, lives };
}
test("first fear precedes pack knowledge and blocks all knife but not identity", () => {
  const { world, state } = fixture();
  expect(nightmarePackReady(world)).toBe(false);
  expect(beginNightmareNight(world, 1)).toBe(1);
  expect(nightmareFearTargets(world, 1, 1)).toEqual([2, 3, 4]);
  commitNightmareFear(world, 1, 1, 2);
  expect(nightmarePackReady(world)).toBe(true);
  expect(nightmareKnifeBlocked(world, 1)).toBe(true);
  expect(nightmareFearBlocks(world, 2, 1)).toBe(true);
  expect(nightmareFearBlocks(world, 3, 1)).toBe(false);
  expect(state.history).toEqual([{ day: 1, targetId: 2 }]);
  expect(() => commitNightmareFear(world, 1, 1, 3)).toThrow();
  expect(() => beginNightmareNight(world, 1)).toThrow();
  beginNightmareNight(world, 2);
  expect(nightmareKnifeBlocked(world, 2)).toBe(false);
  expect(nightmareFearTargets(world, 1, 2)).toEqual([3, 4]);
  expect(() => commitNightmareFear(world, 1, 2, 2)).toThrow();
});
test("explicit pass interrupts consecutive fear and missing commit does not masquerade as pass", () => {
  const { world, state } = fixture();
  beginNightmareNight(world, 1);
  commitNightmareFear(world, 1, 1, 3);
  beginNightmareNight(world, 2);
  expect(nightmareFearTargets(world, 1, 2)).toEqual([4]);
  commitNightmareFear(world, 1, 2, null);
  beginNightmareNight(world, 3);
  expect(nightmareFearTargets(world, 1, 3)).toEqual([3, 4]);
  expect(state.history).toHaveLength(2);
});
test("required fear rejects pass and self without mutation", () => {
  const { world, state } = fixture(true);
  beginNightmareNight(world, 1);
  expect(() => commitNightmareFear(world, 1, 1, null)).toThrow();
  expect(() => commitNightmareFear(world, 1, 1, 1)).toThrow();
  expect(state.history).toEqual([]);
  commitNightmareFear(world, 1, 1, 3);
});
test("normal target death keeps night gun silence; resurrection revokes it", () => {
  const { world, lives } = fixture();
  beginNightmareNight(world, 1);
  commitNightmareFear(world, 1, 1, 4);
  lives.get(4)!.alive = false;
  expect(nightmareFearBlocks(world, 4, 1, true)).toBe(true);
  expect(nightmareFearBlocks(world, 4, 2, true)).toBe(false);
  lives.get(4)!.alive = true;
  expect(() => nightmareFearBlocks(world, 4, 1, true)).toThrow();
});
test("normal caster death retains committed fear", () => {
  const { world, lives } = fixture();
  beginNightmareNight(world, 1);
  commitNightmareFear(world, 1, 1, 3);
  lives.get(1)!.alive = false;
  expect(nightmareFearBlocks(world, 3, 1)).toBe(true);
  expect(beginNightmareNight(world, 2)).toBeNull();
});
test("role replacement and forged progression revoke authority", () => {
  const a = fixture();
  a.roles.set(3, { ...a.roles.get(3)! });
  expect(() => assertNightmareRosterCurrent(a.world)).toThrow();
  const b = fixture();
  b.state.packReady = true;
  expect(() => assertNightmareRosterCurrent(b.world)).toThrow();
  const c = fixture();
  c.lives.set(3, createAliveComponent());
  expect(() => assertNightmareRosterCurrent(c.world)).toThrow();
});

test("an uncommitted required night cannot be skipped or converted to pass", () => {
  const { world, state } = fixture(true);
  expect(() => beginNightmareNight(world, 2)).toThrow();
  beginNightmareNight(world, 1);
  expect(() => beginNightmareNight(world, 2)).toThrow();
  expect(() => commitNightmareFear(world, 1, 2, null)).toThrow();
  expect(state.history).toEqual([]);
  expect(state.packReady).toBe(false);
  commitNightmareFear(world, 1, 1, 3);
  beginNightmareNight(world, 2);
  commitNightmareFear(world, 1, 2, 4);
  expect(state.history).toEqual([
    { day: 1, targetId: 3 },
    { day: 2, targetId: 4 },
  ]);
});
test("uncommitted actor death does not turn a missing response into a finished night", () => {
  const { world, lives } = fixture();
  beginNightmareNight(world, 1);
  lives.get(1)!.alive = false;
  expect(() => beginNightmareNight(world, 2)).toThrow();
});
test("state toJSON is not invoked by authority checks", () => {
  const { world, state } = fixture();
  let calls = 0;
  Object.defineProperty(state, "toJSON", {
    value() {
      calls++;
      throw new Error("must not call");
    },
  });
  expect(() => assertNightmareRosterCurrent(world)).not.toThrow();
  beginNightmareNight(world, 1);
  commitNightmareFear(world, 1, 1, 3);
  expect(calls).toBe(0);
});

for (const location of ["own", "inherited"] as const)
  test(`nightmare frame ignores ${location} history constructor accessors`, () => {
    const { world, state } = fixture(false, location);
    expect(beginNightmareNight(world, 1)).toBe(1);
    commitNightmareFear(world, 1, 1, 2);
    expect(state.history.length).toBe(1);
    expect(state.history[0]).toEqual({ day: 1, targetId: 2 });
    expect(() => assertNightmareRosterCurrent(world)).not.toThrow();
    expect(beginNightmareNight(world, 2)).toBe(1);
    commitNightmareFear(world, 1, 2, 3);
    expect(state.history.length).toBe(2);
    expect(() => assertNightmareRosterCurrent(world)).not.toThrow();
  });
