import { describe, expect, test } from "bun:test";
import type { RoleComponent } from "../../../src/core/domain/components/role";
import { Camp } from "../../../src/core/domain/identity";
import {
  freshNightmareShadowState,
  getNightmareShadowState,
} from "../../../src/game/mechanisms/roles/nightmare_shadow/state";
function role(state: unknown): RoleComponent {
  return {
    role: "nightmare",
    camp: Camp.Wolf,
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
    expect(getNightmareShadowState(role(a))).toBe(a);
  });
  for (const fear of ["optional", "required_when_legal"] as const)
    for (const wolf of ["standard", "no_blast_no_self_knife"] as const)
      test(fear + "/" + wolf, () => {
        const state = freshNightmareShadowState(fear, wolf);
        expect(getNightmareShadowState(role(state))).toBe(state);
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
      expect(getNightmareShadowState(role(state))).toBeUndefined();
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
    expect(getNightmareShadowState(role(state))).toBeUndefined();
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
      getNightmareShadowState(role(new Proxy(freshNightmareShadowState(), handler))),
    ).toBeUndefined();
    expect(
      getNightmareShadowState(new Proxy(role(freshNightmareShadowState()), handler)),
    ).toBeUndefined();
    expect(reads).toBe(0);
  });
  test("reject wrong role or camp", () => {
    const r = role(freshNightmareShadowState());
    expect(getNightmareShadowState({ ...r, camp: Camp.Good })).toBeUndefined();
    expect(getNightmareShadowState({ ...r, role: "wolf" } as RoleComponent)).toBeUndefined();
  });
});

test("nightmare rejects revoked history and inconsistent progression", () => {
  const revoked = Proxy.revocable([], {});
  const state = freshNightmareShadowState();
  state.history = revoked.proxy;
  revoked.revoke();
  expect(() => getNightmareShadowState(role(state))).not.toThrow();
  expect(getNightmareShadowState(role(state))).toBeUndefined();
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
      getNightmareShadowState(role({ ...freshNightmareShadowState(), ...value })),
    ).toBeUndefined();
});
