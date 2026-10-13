/**
 * Unit tests for the damage-plan query and resolver mutation boundary. Literal
 * original-life claims and mark states supply independent expected results:
 * folding leaves marks/lives intact, a failed fold clears no marks, and a late
 * per-player query failure retains the original earlier clear prefix. These
 * module tests invoke no model, transport or complete-game driver.
 */
import { expect, test } from "bun:test";
import { World } from "../../../src/core/domain/world";
import { COMPONENT } from "../../../src/core/domain/components/names";
import { createAliveComponent } from "../../../src/core/domain/components/alive";
import { StatusMarksComponent } from "../../../src/core/domain/components/status_marks";
import { StatusMark } from "../../../src/core/domain/identity";
import { captureNightLife } from "../../../src/core/domain/night_effects";
import { planNightDamage } from "../../../src/core/domain/night-damage-plan";
import { DamageResolutionSystem } from "../../../src/core/domain/systems/damage_resolution_system";

function fixture() {
  const world = new World();
  const ids = [world.createEntity(), world.createEntity()];
  const marks = ids.map((id) => {
    world.addComponent(id, COMPONENT.Alive, createAliveComponent());
    const component = new StatusMarksComponent([StatusMark.WolfKillMark]);
    world.addComponent(id, COMPONENT.StatusMarks, component);
    return component;
  });
  return { world, ids, marks };
}

test("folding a paid shield queries its original receiver without consuming marks or lives", () => {
  const { world, ids, marks } = fixture();
  const target = captureNightLife(world, ids[0]!)!;
  const effect = {
    actorId: ids[1]!,
    target,
    isCurrent() {
      expect(this).toBe(effect);
      return true;
    },
  };
  const plan = planNightDamage(world, {
    mechanicalEffects: { shields: [effect], attacks: [], failures: [] },
  });
  expect([...plan.mechanical.shields]).toEqual([ids[0]!]);
  expect(world.getComponent(ids[0]!, COMPONENT.Alive)).toBe(target.life);
  expect(target.life.alive).toBe(true);
  expect(marks.map((mark) => mark.values())).toEqual([
    [StatusMark.WolfKillMark],
    [StatusMark.WolfKillMark],
  ]);
});

test("a fold failure preserves every original mark before entity resolution begins", () => {
  const { world, ids, marks } = fixture();
  const failure = Error("paid_owner_query_failed");
  expect(() =>
    new DamageResolutionSystem().resolve(world, {
      awakenedEffects: {
        shields: [
          {
            actorId: ids[1]!,
            target: captureNightLife(world, ids[0]!)!,
            isCurrent: () => {
              throw failure;
            },
          },
        ],
        attacks: [],
      },
    }),
  ).toThrow(failure);
  expect(marks.map((mark) => mark.values())).toEqual([
    [StatusMark.WolfKillMark],
    [StatusMark.WolfKillMark],
  ]);
});

test("a late protection getter failure retains the earlier entity's cleared-mark prefix", () => {
  const { world, ids, marks } = fixture();
  const failure = Error("late_protection_query_failed");
  let reads = 0;
  expect(() =>
    new DamageResolutionSystem().resolve(world, {
      get protectedTargets() {
        if (++reads === 2) throw failure;
        return [];
      },
    }),
  ).toThrow(failure);
  expect(reads).toBe(2);
  expect(marks[0]!.values()).toEqual([]);
  expect(marks[1]!.values()).toEqual([StatusMark.WolfKillMark]);
  expect(ids.map((id) => world.getComponent(id, COMPONENT.Alive)!.alive)).toEqual([true, true]);
});
