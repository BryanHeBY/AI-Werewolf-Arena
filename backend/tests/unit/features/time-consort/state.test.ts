/**
 * Unit tests for time-consort; Isolated time-consort state contract; native in-memory owner/frame/readers, no assembled game cycle.
 * Inputs are existing in-memory fixtures, original callback controls and explicit
 * invalid mutations. Original literal expectations, identity snapshots and
 * rejection assertions supply the oracle; none are regenerated during relocation.
 * Test-owned mocks/components exercise this boundary without a model or physical
 * transport. Support files, fixture bytes, policy and state behavior are retained.
 */
import { expect, test } from "bun:test";
import { Camp, type RoleComponent } from "../../../../src/core";
import {
  createTimeConsortState,
  getTimeConsortState,
  projectTimeConsortState,
  timeConsortReflectionTarget,
  type ReflectionScope,
} from "../../../../src/game/mechanisms/roles/time_wolf_consort/state";
function fixture(scope: ReflectionScope = "whole_night") {
  const state = createTimeConsortState(scope);
  const role = {
    role: "time_wolf_consort",
    camp: Camp.Wolf,
    privateState: { timeConsort: state },
  } as unknown as RoleComponent;
  return { state, role };
}
test("Consort accepts ordered choices and forbids consecutive same targets", () => {
  const f = fixture();
  expect(getTimeConsortState(f.role)).toBe(f.state);
  f.state.history.push({ day: 1, targetId: 3 }, { day: 2, targetId: 3 });
  expect(getTimeConsortState(f.role)).toBeUndefined();
  f.state.history[1]!.targetId = null;
  f.state.history.push({ day: 3, targetId: 3 });
  expect(getTimeConsortState(f.role)).toBe(f.state);
  f.state.triggeredDay = 2;
  expect(getTimeConsortState(f.role)).toBeUndefined();
  f.state.triggeredDay = 3;
  expect(getTimeConsortState(f.role)).toBe(f.state);
  f.state.history.push({ day: 4, targetId: null });
  expect(getTimeConsortState(f.role)).toBeUndefined();
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
  expect(getTimeConsortState(f.role)).toBeUndefined();
  expect(calls).toBe(0);
  const g = fixture();
  (g.role.privateState as Record<string, unknown>).timeConsort = new Proxy(g.state, {
    ownKeys() {
      calls++;
      throw new Error("trap");
    },
  });
  expect(getTimeConsortState(g.role)).toBeUndefined();
  expect(calls).toBe(0);
  const h = fixture();
  h.state.history.push({ day: 1, targetId: 3 });
  Object.defineProperty(h.state.history[0]!, "targetId", {
    get() {
      calls++;
      return 3;
    },
  });
  expect(getTimeConsortState(h.role)).toBeUndefined();
  expect(calls).toBe(0);
});
test("Consort private projection delays exhaustion and never reveals reflecting actors", () => {
  const f = fixture();
  f.state.history.push({ day: 1, targetId: 3 });
  f.state.triggeredDay = 1;
  expect(projectTimeConsortState(f.role, 1)).toEqual({
    policy: "awa_time_consort_reflection_v1",
    reflectionScope: "whole_night",
    history: [{ day: 1, targetId: 3 }],
    exhausted: false,
  });
  expect(projectTimeConsortState(f.role, 2)?.exhausted).toBe(true);
  const p = projectTimeConsortState(f.role, 2)!;
  p.history[0]!.targetId = 5;
  expect(f.state.history[0]!.targetId).toBe(3);
});
for (const scope of ["whole_night", "first_effect"] as const)
  test("Consort reflection scope/" + scope, () => {
    const f = fixture(scope);
    f.state.history.push({ day: 1, targetId: 3 });
    for (const skill of ["check", "guard", "poison"]) {
      expect(timeConsortReflectionTarget(f.role, 1, Camp.Good, 2, 3, skill)).toBe(2);
      expect(timeConsortReflectionTarget(f.role, 1, Camp.Wolf, 2, 3, skill)).toBe(3);
      expect(timeConsortReflectionTarget(f.role, 1, Camp.Good, 2, 4, skill)).toBe(4);
    }
    for (const skill of ["heal", "kill", "shoot", "vote"])
      expect(timeConsortReflectionTarget(f.role, 1, Camp.Good, 2, 3, skill)).toBe(3);
    f.state.triggeredDay = 1;
    expect(timeConsortReflectionTarget(f.role, 1, Camp.Good, 2, 3, "poison")).toBe(
      scope === "whole_night" ? 2 : 3,
    );
    expect(timeConsortReflectionTarget(f.role, 2, Camp.Good, 2, 3, "check")).toBe(3);
  });
