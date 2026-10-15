/**
 * 单元测试验证蚀时狼妃原状态接受、同引用读取、反射目标与知识延迟；输入为原内存 fixture、
 * 明确非法修改和范围参数，原字面预期与拒绝是预期，不生成新 golden 或运行完整对局。
 * 测试自有 getter／Proxy 样本只核读取边界，不调用模型、传输或实际效果付款。
 */
import type { ReflectionScope } from "@ai-werewolf-arena/game-contract";
import { expect, test } from "bun:test";
import { Camp, type RoleComponent } from "../../../../src/domain";
import {
  createTimeConsortState,
  getTimeConsortState,
  projectTimeConsortState,
  timeConsortReflectionTarget,
} from "../../../../src/game/mechanisms/roles/time_wolf_consort/state-slot";
function fixture(scope: ReflectionScope = "whole_night") {
  const state = createTimeConsortState(scope);
  const role = {
    role: "time_wolf_consort",
    privateState: { timeConsort: state },
  } as unknown as RoleComponent;
  const camp = { camp: Camp.Wolf };
  return { state, role, camp, currentCamp: () => camp };
}
test("Consort accepts ordered choices and forbids consecutive same targets", () => {
  const f = fixture();
  expect(getTimeConsortState(f.role, f.currentCamp)).toBe(f.state);
  f.state.history.push({ day: 1, targetId: 3 }, { day: 2, targetId: 3 });
  expect(getTimeConsortState(f.role, f.currentCamp)).toBeUndefined();
  f.state.history[1]!.targetId = null;
  f.state.history.push({ day: 3, targetId: 3 });
  expect(getTimeConsortState(f.role, f.currentCamp)).toBe(f.state);
  f.state.triggeredDay = 2;
  expect(getTimeConsortState(f.role, f.currentCamp)).toBeUndefined();
  f.state.triggeredDay = 3;
  expect(getTimeConsortState(f.role, f.currentCamp)).toBe(f.state);
  f.state.history.push({ day: 4, targetId: null });
  expect(getTimeConsortState(f.role, f.currentCamp)).toBeUndefined();
});
test("Consort refuses malformed state without invoking accessors or proxy traps", () => {
  const f = fixture();
  let calls = 0;
  Object.defineProperty(f.state, "history", {
    get() {
      calls++;
      return [];
    },
  });
  expect(getTimeConsortState(f.role, f.currentCamp)).toBeUndefined();
  expect(calls).toBe(0);
  const g = fixture();
  (g.role.privateState as Record<string, unknown>).timeConsort = new Proxy(g.state, {
    ownKeys() {
      calls++;
      throw new Error("trap");
    },
  });
  expect(getTimeConsortState(g.role, g.currentCamp)).toBeUndefined();
  expect(calls).toBe(0);
  const h = fixture();
  h.state.history.push({ day: 1, targetId: 3 });
  Object.defineProperty(h.state.history[0]!, "targetId", {
    get() {
      calls++;
      return 3;
    },
  });
  expect(getTimeConsortState(h.role, h.currentCamp)).toBeUndefined();
  expect(calls).toBe(0);
});
test("Consort private projection delays exhaustion and never reveals reflecting actors", () => {
  const f = fixture();
  f.state.history.push({ day: 1, targetId: 3 });
  f.state.triggeredDay = 1;
  expect(projectTimeConsortState(f.role, 1, f.currentCamp)).toEqual({
    policy: "awa_time_consort_reflection_v1",
    reflectionScope: "whole_night",
    history: [{ day: 1, targetId: 3 }],
    exhausted: false,
  });
  expect(projectTimeConsortState(f.role, 2, f.currentCamp)?.exhausted).toBe(true);
  const p = projectTimeConsortState(f.role, 2, f.currentCamp)!;
  p.history[0]!.targetId = 5;
  expect(f.state.history[0]!.targetId).toBe(3);
});
for (const scope of ["whole_night", "first_effect"] as const)
  test("Consort reflection scope/" + scope, () => {
    const f = fixture(scope);
    f.state.history.push({ day: 1, targetId: 3 });
    for (const skill of ["check", "guard", "poison"]) {
      expect(timeConsortReflectionTarget(f.role, 1, Camp.Good, 2, 3, skill, f.currentCamp)).toBe(2);
      expect(timeConsortReflectionTarget(f.role, 1, Camp.Wolf, 2, 3, skill, f.currentCamp)).toBe(3);
      expect(timeConsortReflectionTarget(f.role, 1, Camp.Good, 2, 4, skill, f.currentCamp)).toBe(4);
    }
    for (const skill of ["heal", "kill", "shoot", "vote"])
      expect(timeConsortReflectionTarget(f.role, 1, Camp.Good, 2, 3, skill, f.currentCamp)).toBe(3);
    f.state.triggeredDay = 1;
    expect(timeConsortReflectionTarget(f.role, 1, Camp.Good, 2, 3, "poison", f.currentCamp)).toBe(
      scope === "whole_night" ? 2 : 3,
    );
    expect(timeConsortReflectionTarget(f.role, 2, Camp.Good, 2, 3, "check", f.currentCamp)).toBe(3);
  });
