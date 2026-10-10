import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { COMPONENT } from "../../../src/core/domain/components/names";
import {
  createAliveComponent,
  type AliveComponent,
} from "../../../src/core/domain/components/alive";
import type { RoleComponent } from "../../../src/core/domain/components/role";
import type { StatusMarksComponent } from "../../../src/core/domain/components/status_marks";
import { DeathCause } from "../../../src/core/domain/deaths";
import { Role, StatusMark } from "../../../src/core/domain/identity";
import {
  captureNightLife,
  type NightInspectionAttack,
} from "../../../src/core/domain/night_effects";
import { DamageResolutionSystem } from "../../../src/core/domain/systems/damage_resolution_system";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";

function fixture(cause: NightInspectionAttack["cause"]) {
  const { world } = bootstrapGame(sixPlayerMvpConfig);
  const actorId = world
    .entityIds()
    .find((id) => world.getComponent<RoleComponent>(id, COMPONENT.Role)?.role === Role.Seer)!;
  const targetId = world
    .entityIds()
    .find((id) => world.getComponent<RoleComponent>(id, COMPONENT.Role)?.role === Role.Wolf)!;
  const target = captureNightLife(world, targetId)!;
  let current = true;
  const attack: NightInspectionAttack = { actorId, target, cause, isCurrent: () => current };
  const marks = world.getComponent<StatusMarksComponent>(targetId, COMPONENT.StatusMarks)!;
  return {
    world,
    actorId,
    targetId,
    attack,
    marks,
    revoke: () => {
      current = false;
    },
  };
}

const matrix = [
  { name: "no ordinary marks", marks: [], other: [] },
  { name: "guard", marks: [StatusMark.GuardMark], other: [] },
  { name: "heal", marks: [StatusMark.HealMark], other: [] },
  { name: "guard and heal", marks: [StatusMark.GuardMark, StatusMark.HealMark], other: [] },
  { name: "guarded knife", marks: [StatusMark.GuardMark, StatusMark.WolfKillMark], other: [] },
  { name: "healed knife", marks: [StatusMark.HealMark, StatusMark.WolfKillMark], other: [] },
  {
    name: "conflicting guard and heal with knife",
    marks: [StatusMark.GuardMark, StatusMark.HealMark, StatusMark.WolfKillMark],
    other: [DeathCause.WolfKill],
  },
  { name: "independent poison", marks: [StatusMark.PoisonMark], other: [DeathCause.Poison] },
] as const;

for (const cause of [DeathCause.PureWhiteInspection, DeathCause.WolfWitchInspection] as const) {
  for (const row of matrix) {
    test(`${cause}/${row.name}: sourced inspection ignores ordinary guard and heal, retaining independent causes`, () => {
      const f = fixture(cause);
      for (const mark of row.marks) f.marks.add(mark);
      const damage = new DamageResolutionSystem().resolve(f.world, {
        inspectionAttacks: [f.attack],
      });
      expect(damage.deaths).toEqual([f.targetId]);
      expect([...damage.deathSources[f.targetId]!].sort()).toEqual([cause, ...row.other].sort());
      expect(f.world.getComponent<AliveComponent>(f.targetId, COMPONENT.Alive)?.alive).toBe(true);
    });
  }
  test(`${cause}: revoked original authority cannot contribute a death`, () => {
    const f = fixture(cause);
    f.revoke();
    expect(
      new DamageResolutionSystem().resolve(f.world, { inspectionAttacks: [f.attack] }).deaths,
    ).toEqual([]);
  });
  test(`${cause}: a dead and revived target is not the captured life`, () => {
    const f = fixture(cause);
    const life = f.world.getComponent<AliveComponent>(f.targetId, COMPONENT.Alive)!;
    life.alive = false;
    life.alive = true;
    expect(
      new DamageResolutionSystem().resolve(f.world, { inspectionAttacks: [f.attack] }).deaths,
    ).toEqual([]);
  });
}

for (const cause of [DeathCause.PureWhiteInspection, DeathCause.WolfWitchInspection] as const) {
  test(`${cause}: replacing the target life revokes the original attack`, () => {
    const f = fixture(cause);
    const replacement = createAliveComponent();
    f.world.addComponent(f.targetId, COMPONENT.Alive, replacement);
    const damage = new DamageResolutionSystem().resolve(f.world, { inspectionAttacks: [f.attack] });
    expect(damage.deaths).toEqual([]);
    expect(damage.deathSources[f.targetId]).toBeUndefined();
    expect(replacement.alive).toBe(true);
  });
  test(`${cause}: inspection without a status component still stages a death`, () => {
    const f = fixture(cause);
    f.world.removeComponent(f.targetId, COMPONENT.StatusMarks);
    const damage = new DamageResolutionSystem().resolve(f.world, { inspectionAttacks: [f.attack] });
    expect(damage.deaths).toEqual([f.targetId]);
    expect([...damage.deathSources[f.targetId]!]).toEqual([cause]);
    expect(f.world.getComponent<AliveComponent>(f.targetId, COMPONENT.Alive)?.alive).toBe(true);
  });
}

test("both inspection sources are preserved once while marking no player dead prematurely", () => {
  const f = fixture(DeathCause.PureWhiteInspection);
  const other: NightInspectionAttack = { ...f.attack, cause: DeathCause.WolfWitchInspection };
  const damage = new DamageResolutionSystem().resolve(f.world, {
    inspectionAttacks: [f.attack, f.attack, other],
  });
  expect(damage.deaths).toEqual([f.targetId]);
  expect([...damage.deathSources[f.targetId]!].sort()).toEqual(
    [DeathCause.PureWhiteInspection, DeathCause.WolfWitchInspection].sort(),
  );
  expect(f.world.getComponent<AliveComponent>(f.targetId, COMPONENT.Alive)?.alive).toBe(true);
});
