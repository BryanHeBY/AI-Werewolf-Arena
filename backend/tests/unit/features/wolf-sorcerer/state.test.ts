/**
 * Unit tests for wolf-sorcerer; Isolated wolf-sorcerer state contract; native in-memory owner/frame/readers, no assembled game cycle.
 * Inputs are existing in-memory fixtures, original callback controls and explicit
 * invalid mutations. Original literal expectations, identity snapshots and
 * rejection assertions supply the oracle; none are regenerated during relocation.
 * Test-owned mocks/components exercise this boundary without a model or physical
 * transport. Support files, fixture bytes, policy and state behavior are retained.
 */
import { expect, test } from "bun:test";
import { Camp, type RoleComponent } from "../../../../src/core";
import {
  createWolfSorcererState,
  getWolfSorcererState,
  projectWolfSorcererState,
} from "../../../../src/game/mechanisms/roles/wolf_sorcerer/state";
function make(firstNight: 1 | 2 = 2) {
  const state = createWolfSorcererState(firstNight);
  const role = {
    role: "wolf_sorcerer",
    camp: Camp.Wolf,
    privateState: { wolfSorcerer: state },
  } as unknown as RoleComponent;
  return { state, role };
}
test("Wolf Sorcerer state preserves first-night policy and returns detached history", () => {
  const { state, role } = make();
  state.history.push({ day: 2, pair: [1, 3] }, { day: 3, pair: null }, { day: 4, pair: [2, 4] });
  expect(getWolfSorcererState(role)).toBe(state);
  const projection = projectWolfSorcererState(role)!;
  expect(projection).toEqual(state);
  projection.history[0]!.pair![0] = 99;
  projection.history.push({ day: 5, pair: null });
  expect(state.history).toEqual([
    { day: 2, pair: [1, 3] },
    { day: 3, pair: null },
    { day: 4, pair: [2, 4] },
  ]);
});
for (const history of [
  [{ day: 1, pair: [1, 2] }],
  [{ day: 2, pair: [2, 1] }],
  [{ day: 2, pair: [1, 1] }],
  [
    { day: 2, pair: [1, 2] },
    { day: 3, pair: [2, 3] },
  ],
  [
    { day: 2, pair: null },
    { day: 2, pair: null },
  ],
  [
    { day: 3, pair: null },
    { day: 2, pair: null },
  ],
  [{ day: 2, pair: [0, 2] }],
])
  test("Wolf Sorcerer rejects invalid immutable number history " + JSON.stringify(history), () => {
    const { state, role } = make();
    Object.assign(state, { history });
    expect(getWolfSorcererState(role)).toBeUndefined();
    expect(projectWolfSorcererState(role)).toBeUndefined();
  });
test("Wolf Sorcerer explicit first-night variant allows night one", () => {
  const { state, role } = make(1);
  state.history.push({ day: 1, pair: [1, 2] });
  expect(getWolfSorcererState(role)).toBe(state);
});
test("Wolf Sorcerer rejects foreign role, camp, policy and extra fields", () => {
  for (const mutation of [
    (r: ReturnType<typeof make>) => Object.assign(r.role, { role: "wolf_witch" }),
    (r: ReturnType<typeof make>) => Object.assign(r.role, { camp: Camp.Good }),
    (r: ReturnType<typeof make>) => Object.assign(r.state, { policy: "other" }),
    (r: ReturnType<typeof make>) => Object.assign(r.state, { extra: true }),
    (r: ReturnType<typeof make>) => Object.assign(r.state, { firstNight: 3 }),
  ]) {
    const r = make();
    mutation(r);
    expect(getWolfSorcererState(r.role)).toBeUndefined();
  }
});
test("Wolf Sorcerer parser does not invoke supplied accessors or proxy traps", () => {
  let calls = 0;
  const a = make();
  Object.defineProperty(a.state, "history", {
    get() {
      calls++;
      return [];
    },
  });
  expect(getWolfSorcererState(a.role)).toBeUndefined();
  expect(calls).toBe(0);
  const b = make();
  b.role.privateState.wolfSorcerer = new Proxy(b.state, {
    get() {
      calls++;
      throw new Error("read");
    },
  });
  expect(getWolfSorcererState(b.role)).toBeUndefined();
  expect(calls).toBe(0);
});
