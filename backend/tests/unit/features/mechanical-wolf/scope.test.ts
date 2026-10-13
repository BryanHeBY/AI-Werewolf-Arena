/**
 * Unit tests for mechanical-wolf; Isolated mechanical-wolf scope contract; native in-memory owner/frame/readers, no assembled game cycle.
 * Inputs are existing in-memory fixtures, original callback controls and explicit
 * invalid mutations. Original literal expectations, identity snapshots and
 * rejection assertions supply the oracle; none are regenerated during relocation.
 * Test-owned mocks/components exercise this boundary without a model or physical
 * transport. Support files, fixture bytes, policy and state behavior are retained.
 */
import { expect, test } from "bun:test";
import { createAliveComponent } from "../../../../src/core/domain/components/alive";
import { createRoleComponent } from "../../../../src/core/domain/components/role";
import { Camp, Role } from "../../../../src/core/domain/model";
import { COMPONENT } from "../../../../src/core/domain/components/names";
import { World } from "../../../../src/core/domain/world";
import {
  bindMechanicalSkill,
  captureMechanicalOwner,
  hasCurrentMechanicalKillMode,
  recordMechanicalModeScope,
} from "../../../../src/game/mechanisms/roles/mechanical_wolf/night_scope";
import {
  closeMechanicalSkill,
  freshMechanicalState,
  learnMechanicalRole,
  selectMechanicalMode,
  setMechanicalState,
} from "../../../../src/game/mechanisms/roles/mechanical_wolf/state";

function fixture(mode: "skill" | "kill" = "skill") {
  // An isolated World exercises scope controls separately from full lifecycle scenarios.
  const world = new World(),
    actor = world.createEntity();
  const role = createRoleComponent(Role.MechanicalWolf, Camp.Wolf),
    life = createAliveComponent();
  world.addComponent(actor, COMPONENT.Role, role);
  world.addComponent(actor, COMPONENT.Alive, life);
  const state = setMechanicalState(role, freshMechanicalState());
  learnMechanicalRole(state, 5, "guard", 1);
  selectMechanicalMode(state, 2, mode);
  let current = true;
  const scope = captureMechanicalOwner(world, actor, () => current)!;
  if (mode === "skill") recordMechanicalModeScope(world, scope, 2);
  return {
    world,
    actor,
    role,
    life,
    state,
    scope,
    cancel: () => {
      current = false;
    },
  };
}

for (const revoke of [
  "cancel",
  "role",
  "camp",
  "component",
  "private_state",
  "state",
  "life",
  "revive",
] as const) {
  test(`${revoke}: original owner authorization cannot move to another phase, role, inventory or life`, () => {
    const f = fixture(),
      bound = bindMechanicalSkill(f.scope, 2)!;
    expect(f.scope.isCurrent()).toBe(true);
    expect(bound.isCurrent()).toBe(true);
    if (revoke === "cancel") f.cancel();
    if (revoke === "role") f.role.role = Role.Villager;
    if (revoke === "camp") f.role.camp = Camp.Good;
    if (revoke === "component") f.world.addComponent(f.actor, COMPONENT.Role, { ...f.role });
    if (revoke === "private_state")
      (f.role as { privateState: Readonly<Record<string, unknown>> }).privateState = {
        ...f.role.privateState,
      };
    if (revoke === "state") setMechanicalState(f.role, f.state);
    if (revoke === "life") f.world.addComponent(f.actor, COMPONENT.Alive, createAliveComponent());
    if (revoke === "revive") {
      f.life.alive = false;
      f.life.alive = true;
    }
    expect(f.scope.isCurrent()).toBe(false);
    expect(bound.isCurrent()).toBe(false);
  });
}

for (const revoke of [
  "learning",
  "skill",
  "skill_kind",
  "mode",
  "mode_kind",
  "mode_day",
] as const) {
  test(`${revoke}: an accepted effect stays bound to its original learning and mode`, () => {
    const f = fixture(),
      bound = bindMechanicalSkill(f.scope, 2)!;
    if (revoke === "learning") f.state.learned = { ...f.state.learned! };
    if (revoke === "skill")
      f.state.learned = {
        ...f.state.learned!,
        skill: { kind: "guard", lastTarget: null, lastGuardDay: null },
      };
    if (revoke === "skill_kind") (f.state.learned!.skill as { kind: string }).kind = "poison";
    if (revoke === "mode") f.state.mode = { ...f.state.mode! };
    if (revoke === "mode_kind") f.state.mode!.kind = "kill";
    if (revoke === "mode_day") f.state.mode!.day = 3;
    expect(f.scope.isCurrent()).toBe(true);
    expect(bound.isCurrent()).toBe(false);
  });
}

test("closing a skill and spending its own resource do not revoke an already committed effect", () => {
  const f = fixture(),
    bound = bindMechanicalSkill(f.scope, 2)!;
  expect(closeMechanicalSkill(f.state, 2)).toBe(true);
  if (bound.skill.kind !== "guard") throw new Error("wrong fixture");
  bound.skill.lastTarget = 5;
  bound.skill.lastGuardDay = 2;
  expect(bound.isCurrent()).toBe(true);
});

test("mode facts cannot authorize a knife without a live runtime scope, and queries never consume state", () => {
  const f = fixture("kill"),
    before = JSON.stringify(f.state);
  expect(hasCurrentMechanicalKillMode(f.world, f.role)).toBe(false);
  expect(recordMechanicalModeScope(f.world, f.scope, 2)).toBe(true);
  expect(recordMechanicalModeScope(f.world, f.scope, 2)).toBe(false);
  expect(hasCurrentMechanicalKillMode(f.world, f.role)).toBe(true);
  expect(JSON.stringify(f.state)).toBe(before);
  f.cancel();
  expect(hasCurrentMechanicalKillMode(f.world, f.role)).toBe(false);
});

test("mutating an accepted skill-mode object cannot turn its saved scope into kill authority", () => {
  const f = fixture("skill");
  recordMechanicalModeScope(f.world, f.scope, 2);
  f.state.mode!.kind = "kill";
  expect(hasCurrentMechanicalKillMode(f.world, f.role)).toBe(false);
  expect(recordMechanicalModeScope(f.world, f.scope, 2)).toBe(false);
});

test("new night and independent World never inherit another night's or another game's mode authority", () => {
  const f = fixture("kill"),
    other = fixture("kill");
  recordMechanicalModeScope(f.world, f.scope, 2);
  expect(recordMechanicalModeScope(other.world, f.scope, 2)).toBe(false);
  expect(hasCurrentMechanicalKillMode(other.world, other.role)).toBe(false);
  expect(hasCurrentMechanicalKillMode(other.world, f.role)).toBe(false);
  selectMechanicalMode(f.state, 3, "skill");
  recordMechanicalModeScope(f.world, f.scope, 3);
  expect(hasCurrentMechanicalKillMode(f.world, f.role)).toBe(false);
  expect(recordMechanicalModeScope(f.world, f.scope, 2)).toBe(false);
});
