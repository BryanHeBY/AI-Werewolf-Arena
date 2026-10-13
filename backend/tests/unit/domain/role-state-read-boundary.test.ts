/**
 * Unit tests for ordinary private-slot read references and concrete write prefixes.
 * Inputs are literal installed role data, accessor-backed skills and trade stock;
 * independent identity and getter/setter traces assert original copying and paid
 * partial writes. Compile-only valid-shape mutations must fail through read views.
 * No full game, transport, model or generated fixture oracle executes here.
 */
import "../../../src/app/bootstrap";
import { expect, test } from "bun:test";
import { Camp, Role } from "@ai-werewolf-arena/game-contract";
import type {
  HunterReadState,
  MechanicalReadState,
  MechanicalReadSkill,
  MerchantReadState,
  GravekeeperReadState,
  BearReadState,
  HiddenWolfReadState,
} from "@ai-werewolf-arena/game-contract";
import { createRoleComponent } from "../../../src/core/domain/components/role";
import { getHunterState, setHunterState } from "../../../src/game/mechanisms/roles/hunter/state";
import {
  freshMechanicalState,
  getMechanicalState,
  setMechanicalState,
  recordMechanicalInspection,
} from "../../../src/game/mechanisms/roles/mechanical_wolf/state";
import { recordMerchantTrade } from "../../../src/game/mechanisms/roles/miracle_merchant/state";

function ordinaryReadersCannotWrite(
  hunter: HunterReadState,
  mechanical: MechanicalReadState,
  merchant: MerchantReadState,
  grave: GravekeeperReadState,
  bear: BearReadState,
  hidden: HiddenWolfReadState,
) {
  // @ts-expect-error Shooting stock belongs to the native death-shot owner.
  hunter.canShoot = false;
  // @ts-expect-error Copied policy fields remain read-only in an installed view.
  hidden.campInspection = "awa_inheritance_v1";
  // @ts-expect-error Trade stock is not a reader's write surface.
  merchant.remaining = 0;
  // @ts-expect-error Nullable trade-choice records are deeply read-only.
  merchant.choice!.targetId = 3;
  // @ts-expect-error Roar histories cannot be appended through a getter view.
  bear.history.push({ day: 1, roared: true });
  // @ts-expect-error Feedback results stay read-only below history rows.
  grave.history[0]!.result.camp = "wolf";
  // @ts-expect-error Learned role metadata has no ordinary write authority.
  mechanical.learned!.readyOnNight = 3;
  // @ts-expect-error Mode metadata is read-only below its nullable record.
  mechanical.mode!.day = 3;
  const skill = mechanical.learned?.skill;
  if (skill?.kind === "poison") {
    // @ts-expect-error Selected skill stock is read-only below learned metadata.
    skill.remaining = 0;
  }
  if (skill?.kind === "inspection") {
    // @ts-expect-error Learned inspection rows/results do not expose writes.
    skill.history[0]!.result.role = Role.Wolf;
  }
}
void ordinaryReadersCannotWrite;

test("plain installation keeps its original input reference while Mechanical keeps its original copy", () => {
  const hunterRole = createRoleComponent(Role.Hunter, Camp.Good),
    input = { canShoot: true },
    installed = setHunterState(hunterRole, input);
  expect(installed).toBe(input);
  expect(getHunterState(hunterRole)).toBe(input);
  const mechanicalRole = createRoleComponent(Role.MechanicalWolf, Camp.Wolf),
    data = freshMechanicalState(),
    copied = setMechanicalState(mechanicalRole, data);
  expect(copied).not.toBe(data);
  expect(getMechanicalState(mechanicalRole)).toBe(copied);
  expect(getMechanicalState(mechanicalRole)).toBe(copied);
  expect(Object.isFrozen(input)).toBe(false);
  expect(Object.isFrozen(copied)).toBe(false);
});

function observedInspection(trace: string[], failTarget = false) {
  const history: Array<{ day: number; targetId: number; result: { kind: "role"; role: Role } }> =
    [];
  Object.defineProperty(history, "push", {
    get() {
      trace.push("push");
      return Array.prototype.push;
    },
  });
  const skill: Extract<MechanicalReadSkill, { kind: "inspection" }> = {
    kind: "inspection",
    get history() {
      trace.push("history");
      return history;
    },
  };
  const target = {
    get id() {
      trace.push("target");
      if (failTarget) throw Error("original_target_read_failure");
      return 4;
    },
  };
  const result = {
    kind: "role" as const,
    get role() {
      trace.push("result");
      return Role.Wolf;
    },
  };
  return { skill, target, result, history };
}

test("Mechanical history and push lookup still precede target and result getters", () => {
  const trace: string[] = [],
    f = observedInspection(trace);
  recordMechanicalInspection(f.skill, 2, f.target, f.result);
  expect(trace).toEqual(["history", "push", "target", "result"]);
  expect(f.history).toEqual([{ day: 2, targetId: 4, result: { kind: "role", role: Role.Wolf } }]);
});

test("a target getter failure retains lookup prefix without appending a row", () => {
  const trace: string[] = [],
    f = observedInspection(trace, true);
  expect(() => recordMechanicalInspection(f.skill, 2, f.target, f.result)).toThrow(
    "original_target_read_failure",
  );
  expect(trace).toEqual(["history", "push", "target"]);
  expect(f.history).toEqual([]);
});

test("trade day-write failure preserves paid stock and never evaluates the choice write", () => {
  const trace: string[] = [],
    stored: { remaining: 0 | 1 } = { remaining: 1 };
  const state: MerchantReadState = {
    get remaining() {
      return stored.remaining;
    },
    set remaining(value: 0 | 1) {
      trace.push("remaining");
      stored.remaining = value;
    },
    get closedDay() {
      return null;
    },
    set closedDay(_value: number | null) {
      trace.push("day");
      throw Error("original_day_write_failure");
    },
    get choice() {
      return null;
    },
    set choice(_value: MerchantReadState["choice"]) {
      trace.push("choice");
    },
  };
  expect(() => recordMerchantTrade(state, 2, 4, "check")).toThrow("original_day_write_failure");
  expect(trace).toEqual(["remaining", "day"]);
  expect(stored.remaining).toBe(0);
});
