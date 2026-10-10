import { expect, test } from "bun:test";
import { Camp, type Role, type RoleComponent } from "../../../src/core";
import {
  createMagicianState,
  getMagicianState,
  projectMagicianState,
} from "../../../src/game/mechanisms/roles/magician/state";
function fixture(firstNight: 1 | 2 = 1) {
  const state = createMagicianState(firstNight);
  const role = {
    role: "magician" as Role,
    camp: Camp.Good,
    privateState: { magician: state },
    renderPrompt: () => "",
  } as RoleComponent;
  return { state, role };
}
for (const firstNight of [1, 2] as const)
  test("Magician state owns one-use seats and detached history/" + firstNight, () => {
    const f = fixture(firstNight);
    expect(getMagicianState(f.role)).toBe(f.state);
    f.state.history.push(
      { day: firstNight, pair: [1, 2] },
      { day: firstNight + 1, pair: null },
      { day: firstNight + 2, pair: [3, 4] },
    );
    const view = projectMagicianState(f.role)!;
    expect(view).toEqual(f.state);
    expect(view).not.toBe(f.state);
    view.history[0]!.pair![0] = 99;
    expect(f.state.history[0]!.pair).toEqual([1, 2]);
  });
test("Magician state rejects reused seats, duplicate days, wrong camp and pre-activation choices", () => {
  const f = fixture(2);
  f.state.history.push({ day: 1, pair: null });
  expect(getMagicianState(f.role)).toBeUndefined();
  f.state.history = [
    { day: 2, pair: [1, 2] },
    { day: 3, pair: [2, 3] },
  ];
  expect(getMagicianState(f.role)).toBeUndefined();
  f.state.history = [
    { day: 2, pair: null },
    { day: 2, pair: [3, 4] },
  ];
  expect(getMagicianState(f.role)).toBeUndefined();
  f.state.history = [{ day: 2, pair: [2, 1] }];
  expect(getMagicianState(f.role)).toBeUndefined();
  f.state.history = [];
  f.role.camp = Camp.Wolf;
  expect(getMagicianState(f.role)).toBeUndefined();
});
test("Magician state refuses getters and proxies without invoking them", () => {
  const f = fixture();
  let reads = 0;
  Object.defineProperty(f.state, "firstNight", {
    get() {
      reads++;
      throw new Error("must_not_read");
    },
  });
  expect(getMagicianState(f.role)).toBeUndefined();
  expect(reads).toBe(0);
  const g = fixture();
  g.role.privateState.magician = new Proxy(g.state, {
    ownKeys() {
      reads++;
      throw new Error("must_not_trap");
    },
  });
  expect(getMagicianState(g.role)).toBeUndefined();
  expect(reads).toBe(0);
  const h = fixture();
  Object.defineProperty(h.state.history, "0", {
    get() {
      reads++;
      throw new Error("must_not_read");
    },
  });
  expect(getMagicianState(h.role)).toBeUndefined();
  expect(reads).toBe(0);
});

test("Magician projection avoids inherited constructor and revoked proxies", () => {
  const f = fixture();
  f.state.history.push({ day: 1, pair: [1, 2] });
  let reads = 0;
  const prototype = Object.create(Array.prototype);
  Object.defineProperty(prototype, "constructor", {
    get() {
      reads++;
      throw new Error("must_not_read_species");
    },
  });
  Object.setPrototypeOf(f.state.history, prototype);
  expect(projectMagicianState(f.role)?.history).toEqual([{ day: 1, pair: [1, 2] }]);
  expect(reads).toBe(0);
  const p = Proxy.revocable([], {});
  p.revoke();
  Object.defineProperty(f.state, "history", { value: p.proxy });
  expect(() => getMagicianState(f.role)).not.toThrow();
  expect(getMagicianState(f.role)).toBeUndefined();
});

for (const policy of ["original", "exchanged"] as const)
  test("Magician state retains explicit death shot mapping policy/" + policy, () => {
    const f = fixture();
    f.state.deathShotTargetPolicy = policy;
    expect(projectMagicianState(f.role)?.deathShotTargetPolicy).toBe(policy);
    Object.defineProperty(f.state, "deathShotTargetPolicy", { value: "implicit" });
    expect(getMagicianState(f.role)).toBeUndefined();
  });
test("Magician reader rejects own constructor accessors without executing them", () => {
  const f = fixture();
  let reads = 0;
  Object.defineProperty(f.state.history, "constructor", {
    get() {
      reads++;
      throw new Error("must_not_execute");
    },
  });
  expect(getMagicianState(f.role)).toBeUndefined();
  expect(reads).toBe(0);
});
