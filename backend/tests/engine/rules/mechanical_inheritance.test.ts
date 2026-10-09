import { expect, test } from "bun:test";
import { COMPONENT } from "../../../src/core/domain/components/names";
import { createAliveComponent } from "../../../src/core/domain/components/alive";
import { createRoleComponent } from "../../../src/core/domain/components/role";
import { Camp, Role } from "../../../src/core/domain/model";
import { World } from "../../../src/core/domain/world";
import {
  canMechanicalKnife,
  refreshMechanicalInheritance,
} from "../../../src/game/mechanisms/roles/mechanical_wolf/inheritance";
import {
  captureMechanicalOwner,
  recordMechanicalModeScope,
} from "../../../src/game/mechanisms/roles/mechanical_wolf/night_scope";
import {
  freshMechanicalState,
  selectMechanicalMode,
  setMechanicalState,
} from "../../../src/game/mechanisms/roles/mechanical_wolf/state";

function fixture(otherWolves = 1) {
  const world = new World(),
    actor = world.createEntity();
  const role = createRoleComponent(Role.MechanicalWolf, Camp.Wolf),
    life = createAliveComponent();
  world.addComponent(actor, COMPONENT.Role, role);
  world.addComponent(actor, COMPONENT.Alive, life);
  const state = setMechanicalState(role, freshMechanicalState());
  const others = Array.from({ length: otherWolves }, () => {
    const id = world.createEntity(),
      alive = createAliveComponent();
    world.addComponent(id, COMPONENT.Role, createRoleComponent(Role.WolfKing, Camp.Wolf));
    world.addComponent(id, COMPONENT.Alive, alive);
    return alive;
  });
  const chooseMode = (day: number, mode: "skill" | "kill") => {
    selectMechanicalMode(state, day, mode);
    recordMechanicalModeScope(
      world,
      captureMechanicalOwner(world, actor, () => true)!,
      day,
    );
  };
  return { world, actor, role, life, state, others, chooseMode };
}

test("only assembly or actual complete death commit can acquire the sole-true-Wolf knife fact", () => {
  const f = fixture(),
    before = JSON.stringify(f.state);
  f.chooseMode(2, "kill");
  expect(refreshMechanicalInheritance(f.world, 1)).toEqual([]);
  expect(canMechanicalKnife(f.role, f.world)).toBe(false);
  expect(f.state.hasInheritedKnife).toBe(false);
  // The controller commits the death before invoking the actual-death refresh.
  f.others[0]!.alive = false;
  for (let i = 0; i < 3; i++) expect(canMechanicalKnife(f.role, f.world)).toBe(false);
  expect(f.state.hasInheritedKnife).toBe(false);
  expect(refreshMechanicalInheritance(f.world, 2)).toEqual([
    { actorId: f.actor, day: 2, firstKnifeNight: 3 },
  ]);
  expect(canMechanicalKnife(f.role, f.world)).toBe(false);
  f.chooseMode(3, "kill");
  expect(canMechanicalKnife(f.role, f.world)).toBe(true);
  expect(refreshMechanicalInheritance(f.world, 3)).toEqual([]);
  expect(JSON.parse(before).hasInheritedKnife).toBe(false);
});

test("no transient inheritance when mechanical and the last other Wolf die in the same marked proposal", () => {
  const f = fixture();
  f.others[0]!.alive = false;
  f.life.alive = false;
  expect(refreshMechanicalInheritance(f.world, 2)).toEqual([]);
  expect(f.state.hasInheritedKnife).toBe(false);
  expect(f.state.firstKnifeNight).toBeNull();
});

test("a fact acquired in an earlier committed proposal survives later death and another Wolf's revival", () => {
  const f = fixture();
  f.others[0]!.alive = false;
  refreshMechanicalInheritance(f.world, 2);
  f.chooseMode(3, "kill");
  expect(canMechanicalKnife(f.role, f.world)).toBe(true);
  f.others[0]!.alive = true;
  expect(canMechanicalKnife(f.role, f.world)).toBe(false);
  expect(refreshMechanicalInheritance(f.world, 7)).toEqual([]);
  f.others[0]!.alive = false;
  expect(f.state.firstKnifeNight).toBe(3);
  f.life.alive = false;
  expect(canMechanicalKnife(f.role, f.world)).toBe(false);
  expect(f.state.hasInheritedKnife).toBe(true);
});

test("a lone mechanical at assembly first attacks on night two, with a live chosen kill mode", () => {
  const f = fixture(0);
  expect(refreshMechanicalInheritance(f.world, 1)).toEqual([
    { actorId: 1, day: 1, firstKnifeNight: 2 },
  ]);
  expect(canMechanicalKnife(f.role)).toBe(false);
  expect(canMechanicalKnife(f.role, f.world)).toBe(false);
  f.chooseMode(2, "skill");
  expect(canMechanicalKnife(f.role, f.world)).toBe(false);
  f.chooseMode(3, "kill");
  expect(canMechanicalKnife(f.role, f.world)).toBe(true);
});
