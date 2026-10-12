/**
 * Unit tests: Fault plans use literal replacement requests and hostile input shapes;
 * original life identity, exact boundary mutation and zero foreign-code assertions check
 * independent fault input ownership. Inputs and expected outcomes remain the original
 * literal or immutable-fixture oracle; these module assertions invoke no model or
 * complete-game driver.
 */
import { expect, test } from "bun:test";
import { World, COMPONENT, createAliveComponent, type AliveComponent } from "../../../src/core";
import { NightFaultPlan, readFaultPlan, type AppliedFault } from "../../../src/game/engine/fault_plan";
const plan = () => ({
  version: "awa_fault_plan_v1",
  steps: [
    {
      id: "f1",
      at: {
        day: 2,
        point: "before_night_source_freeze",
        afterDecision: { actorId: 6, stage: "demon_hunter", turn: 1 },
      },
      mutation: { kind: "replace_alive_component", playerId: 6, alive: true },
    },
  ],
});
const world = () => {
  const w = new World();
  for (let i = 0; i < 6; i++)
    w.addComponent(w.createEntity(), COMPONENT.Alive, createAliveComponent());
  return w;
};
const boundary = { day: 2, actorId: 6, targetId: 1, stage: "demon_hunter", turn: 1 } as const;

test("fault input is independent immutable data and actually replaces the original life at one boundary", () => {
  const w = world(),
    input = plan(),
    runtime = new NightFaultPlan(w, input),
    before = w.getComponent(6, COMPONENT.Alive),
    applied: AppliedFault[] = [];
  input.steps[0]!.mutation.playerId = 1;
  expect(
    runtime.applyBeforeNightSourceFreeze(1, null, (f) => {
      applied.push(f);
    }),
  ).toEqual([]);
  expect(
    runtime.applyBeforeNightSourceFreeze(2, boundary, (f) => {
      applied.push(f);
    }),
  ).toEqual(["f1"]);
  expect(w.getComponent(6, COMPONENT.Alive)).not.toBe(before);
  expect(w.getComponent<AliveComponent>(6, COMPONENT.Alive)!.alive).toBe(true);
  expect(applied).toEqual([
    { step: readFaultPlan(plan()).steps[0], originalVersion: 0, replacementVersion: 0 },
  ]);
  expect(Object.isFrozen(runtime.plan.steps[0]!.mutation)).toBe(true);
  runtime.assertConsumed();
  expect(() => runtime.applyBeforeNightSourceFreeze(2, boundary, () => {})).toThrow(
    "fault_plan_boundary_repeated",
  );
});

for (const patch of [
  (p: any) => (p.steps[0].at.point = "after_night_source_freeze"),
  (p: any) => (p.steps[0].at.day = 1),
  (p: any) => (p.steps[0].at.afterDecision.stage = "seer"),
  (p: any) => (p.steps[0].at.afterDecision.turn = 2),
  (p: any) => (p.steps[0].mutation.kind = "run_script"),
  (p: any) => (p.steps[0].mutation.alive = false),
  (p: any) => (p.steps[0].mutation.path = "role.privateState"),
  (p: any) => p.steps.push(structuredClone(p.steps[0])),
  (p: any) => (p.steps = []),
])
  test("unsupported fault variants are rejected before mutation", () => {
    const p = plan();
    patch(p);
    expect(() => readFaultPlan(p)).toThrow();
  });

for (const mutation of ["getter", "proxy", "nested_proxy", "cycle"] as const)
  test(`${mutation}: input rejection executes zero foreign code`, () => {
    const p: any = plan();
    let reads = 0;
    if (mutation === "getter")
      Object.defineProperty(p.steps[0].mutation, "playerId", {
        enumerable: true,
        get() {
          reads++;
          return 6;
        },
      });
    if (mutation === "proxy") {
      expect(() =>
        readFaultPlan(
          new Proxy(p, {
            ownKeys() {
              reads++;
              return [];
            },
          }),
        ),
      ).toThrow();
    } else {
      if (mutation === "nested_proxy")
        p.steps[0].mutation = new Proxy(p.steps[0].mutation, {
          getPrototypeOf() {
            reads++;
            return Object.prototype;
          },
        });
      if (mutation === "cycle") p.steps = p;
      expect(() => readFaultPlan(p)).toThrow();
    }
    expect(reads).toBe(0);
  });

for (const variant of [
  "unconsumed",
  "missed",
  "wrong_actor",
  "wrong_target",
  "no_choice",
  "unknown_player",
  "dead",
] as const)
  test(`${variant}: strict boundary rejection does not fabricate a successful fault`, () => {
    const w = world(),
      p = plan();
    if (variant === "unknown_player") p.steps[0]!.mutation.playerId = 99;
    if (variant === "unknown_player") {
      expect(() => new NightFaultPlan(w, p)).toThrow("fault_plan_player_unknown");
      return;
    }
    const r = new NightFaultPlan(w, p),
      original = w.getComponent<AliveComponent>(6, COMPONENT.Alive)!;
    let calls = 0;
    if (variant === "unconsumed") expect(() => r.assertConsumed()).toThrow("fault_plan_unconsumed");
    else if (variant === "missed")
      expect(() => r.applyBeforeNightSourceFreeze(3, boundary, () => calls++)).toThrow(
        "fault_plan_boundary_missed",
      );
    else {
      if (variant === "dead") original.alive = false;
      const b =
        variant === "wrong_actor"
          ? { ...boundary, actorId: 5 }
          : variant === "wrong_target"
            ? { ...boundary, actorId: 6, targetId: 1 }
            : variant === "no_choice"
              ? null
              : boundary;
      if (variant === "wrong_target") {
        const other = plan();
        other.steps[0]!.mutation.playerId = 3;
        const o = new NightFaultPlan(w, other);
        expect(() => o.applyBeforeNightSourceFreeze(2, b, () => calls++)).toThrow(
          "fault_plan_decision_boundary_invalid",
        );
      } else expect(() => r.applyBeforeNightSourceFreeze(2, b, () => calls++)).toThrow();
    }
    expect(calls).toBe(0);
    expect(w.getComponent<AliveComponent>(6, COMPONENT.Alive)).toBe(original);
  });

test("tampered factory Alive getter is rejected without executing it", () => {
  const w = world(),
    r = new NightFaultPlan(w, plan()),
    life = w.getComponent<AliveComponent>(6, COMPONENT.Alive)!;
  let reads = 0;
  Object.defineProperty(life, "alive", {
    enumerable: true,
    configurable: true,
    get() {
      reads++;
      return true;
    },
  });
  expect(() => r.applyBeforeNightSourceFreeze(2, boundary, () => {})).toThrow(
    "fault_plan_original_life_invalid",
  );
  expect(reads).toBe(0);
});

for (const targetId of [null, 0, -1, 99, "1", 6])
  test(`bad target ${String(targetId)} cannot authorize an actor fault and closes the instance`, () => {
    const w = world(),
      r = new NightFaultPlan(w, plan()),
      original = w.getComponent<AliveComponent>(6, COMPONENT.Alive);
    expect(() =>
      r.applyBeforeNightSourceFreeze(2, { ...boundary, targetId } as any, () => {}),
    ).toThrow();
    expect(w.getComponent<AliveComponent>(6, COMPONENT.Alive)).toBe(original);
    expect(() => r.applyBeforeNightSourceFreeze(2, boundary, () => {})).toThrow(
      "fault_plan_failed",
    );
    expect(() => r.assertConsumed()).toThrow("fault_plan_failed");
  });

test("recording failure preserves the actual mutation but permanently rejects completion or retry", () => {
  const w = world(),
    r = new NightFaultPlan(w, plan()),
    original = w.getComponent<AliveComponent>(6, COMPONENT.Alive);
  const error = new Error("synthetic_record_failure");
  expect(() =>
    r.applyBeforeNightSourceFreeze(2, boundary, () => {
      throw error;
    }),
  ).toThrow(error);
  expect(w.getComponent<AliveComponent>(6, COMPONENT.Alive)).not.toBe(original);
  expect(() => r.assertConsumed()).toThrow("fault_plan_failed");
  expect(() => r.applyBeforeNightSourceFreeze(3, boundary, () => {})).toThrow("fault_plan_failed");
});

test("foreign decision getter is rejected with zero reads before a mutation", () => {
  const w = world(),
    r = new NightFaultPlan(w, plan());
  let reads = 0;
  const b = { ...boundary };
  Object.defineProperty(b, "targetId", {
    enumerable: true,
    get() {
      reads++;
      return 1;
    },
  });
  expect(() => r.applyBeforeNightSourceFreeze(2, b, () => {})).toThrow();
  expect(reads).toBe(0);
  expect(() => r.assertConsumed()).toThrow("fault_plan_failed");
});

test("async recorder is rejected before any mutation", () => {
  const w = world(),
    r = new NightFaultPlan(w, plan()),
    original = w.getComponent<AliveComponent>(6, COMPONENT.Alive);
  let called = 0;
  expect(() =>
    r.applyBeforeNightSourceFreeze(2, boundary, async () => {
      called++;
      throw new Error("must_not_run");
    }),
  ).toThrow("fault_plan_recorder_invalid");
  expect(called).toBe(0);
  expect(w.getComponent<AliveComponent>(6, COMPONENT.Alive)).toBe(original);
  expect(() => r.assertConsumed()).toThrow("fault_plan_failed");
});

test("a disguised promise recorder locks the actual prefix as unverifiable", async () => {
  const w = world(),
    r = new NightFaultPlan(w, plan()),
    original = w.getComponent<AliveComponent>(6, COMPONENT.Alive);
  expect(() =>
    r.applyBeforeNightSourceFreeze(2, boundary, () =>
      Promise.reject(new Error("synthetic_async_recorder")),
    ),
  ).toThrow("fault_plan_recorder_not_sync");
  expect(w.getComponent<AliveComponent>(6, COMPONENT.Alive)).not.toBe(original);
  expect(() => r.assertConsumed()).toThrow("fault_plan_failed");
  await Promise.resolve();
});

for (const variant of ["constructor", "species"] as const)
  test(`${variant}: invalid Promise output never reads foreign accessors`, () => {
    const w = world(),
      r = new NightFaultPlan(w, plan());
    let reads = 0;
    let value: Promise<unknown>;
    if (variant === "constructor") {
      value = Promise.resolve();
      Object.defineProperty(value, "constructor", {
        get() {
          reads++;
          return Promise;
        },
      });
    } else {
      class ForeignPromise extends Promise<unknown> {
        static get [Symbol.species]() {
          reads++;
          return Promise;
        }
      }
      value = new ForeignPromise((resolve) => resolve(null));
    }
    expect(() => r.applyBeforeNightSourceFreeze(2, boundary, () => value)).toThrow(
      "fault_plan_recorder_not_sync",
    );
    expect(reads).toBe(0);
    expect(() => r.assertConsumed()).toThrow("fault_plan_failed");
  });
