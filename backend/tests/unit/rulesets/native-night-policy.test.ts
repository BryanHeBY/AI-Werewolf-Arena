/**
 * Unit tests for native policy binding, argument timing and separate read/write ports.
 * Inputs are an uninstalled in-memory World and deferred accessor traces; literal
 * lookup counts and untouched argument callbacks are independent expectations.
 * Compile-only valid target mutations reject stock/receipt/life write authority.
 * No complete phase, model, transport, filesystem fixture or generated oracle runs.
 */
import "../../../src/app/bootstrap";
import { expect, test } from "bun:test";
import { World } from "../../../src/domain/world";
import { bindNativeNightFailurePolicy } from "../../../src/rulesets/native-night-failure-policy";
import {
  bindNativeNightTargetPolicy,
  type NativeMappedTarget,
  type NativeReflectedTarget,
} from "../../../src/rulesets/native-night-target-policy";
import { bindNativeNightEffects } from "../../../src/rulesets/native-night-effects";
import { nightStageContext } from "../../support/builders/night-stage-context";

function readersCannotMutateTargets(mapped: NativeMappedTarget, reflected: NativeReflectedTarget) {
  // @ts-expect-error Mapping exposes an original life reference with read-only status.
  mapped.scope.life.alive = false;
  // @ts-expect-error Reflection does not expose the paid receipt commit method.
  reflected.commit();
  // @ts-expect-error Captured target identity is read-only.
  reflected.effectiveId = 3;
}
void readersCannotMutateTargets;

test("binding queries no World and stale-scope policies preserve their complete predicate passes", () => {
  const world = new World();
  let reads = 0;
  const policy = bindNativeNightFailurePolicy(() => {
    reads++;
    return world;
  });
  expect(reads).toBe(0);
  policy.scopeStale("seer");
  expect(reads).toBe(3);
  policy.scopeStale("guard");
  expect(reads).toBe(5);
  policy.scopeStale("witch");
  expect(reads).toBe(8);
});

test("missing and invalid policies keep three distinct native chains", () => {
  const world = new World();
  let reads = 0;
  const policy = bindNativeNightFailurePolicy(() => {
    reads++;
    return world;
  });
  policy.actionMissing("seer");
  expect(reads).toBe(6);
  policy.actionMissing("guard");
  expect(reads).toBe(9);
  policy.actionMissing("witch");
  expect(reads).toBe(15);
  policy.actionInvalid("seer");
  policy.actionInvalid("guard");
  policy.actionInvalid("witch");
  expect(reads).toBe(30);
});

test("ordinary wolf failure reads all ten existing board contributions in order without a match", () => {
  const world = new World();
  let reads = 0;
  const policy = bindNativeNightFailurePolicy(() => {
    reads++;
    return world;
  });
  expect(policy.strictWolfFailurePrefix()).toBeNull();
  expect(reads).toBe(10);
});

test("absent mapping and reflection do not pull day or target arguments", () => {
  const world = new World(),
    trace: string[] = [];
  const context = nightStageContext({ world });
  Object.defineProperty(context, "world", {
    get() {
      trace.push("world");
      return world;
    },
  });
  const policy = bindNativeNightTargetPolicy(() => context);
  expect(trace).toEqual([]);
  const argument = () => {
    trace.push("argument");
    return 1;
  };
  expect(policy.mappedTarget(argument, argument)).toBeNull();
  expect(policy.reflectedTarget(argument, argument, argument, "check")).toBeNull();
  expect(trace).toEqual(["world", "world"]);
});

test("nonmatching paid contributions preserve no-argument and null-receipt boundaries", () => {
  const world = new World(),
    trace: string[] = [];
  const context = nightStageContext({ world });
  Object.defineProperty(context, "world", {
    get() {
      trace.push("world");
      return world;
    },
  });
  const effects = bindNativeNightEffects(() => context);
  expect(trace).toEqual([]);
  effects.commitReflectedTarget(null, 1, 1, "check");
  expect(trace).toEqual([]);
  effects.recordModifierTarget(1, 1, "check", () => {
    trace.push("target");
    return 2;
  });
  expect(trace).toEqual(["world"]);
});
