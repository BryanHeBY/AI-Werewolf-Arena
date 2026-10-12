/**
 * Unit tests: Radiant Eclipse returned effects use mutated shelter/backlash objects;
 * literal original paid targets and sources check that a consumer cannot redirect the
 * committed claim. Inputs and expected outcomes remain the original literal or
 * immutable-fixture oracle; these module assertions invoke no model or complete-game
 * driver.
 */
import { expect, test } from "bun:test";
import { World } from "../../../../src/core/domain/world";
import { Role, Camp, WitchSelfHealRule } from "../../../../src/core/domain/identity";
import { COMPONENT } from "../../../../src/core/domain/components/names";
import { createRoleComponent, type RoleComponent } from "../../../../src/core/domain/components/role";
import { createAliveComponent } from "../../../../src/core/domain/components/alive";
import { createCampComponent } from "../../../../src/core/domain/components/camp";
import { createVictoryComponent } from "../../../../src/core/domain/components/victory";
import {
  installNativeAbility,
  findNightAbility,
  abilityStatus,
  type NightAbility,
} from "../../../../src/game/mechanisms/roles/abilities";
import {
  createEclipseState,
  createShelterState,
} from "../../../../src/game/mechanisms/roles/radiant_eclipse/state";
import {
  installRadiantEclipseBoard,
  beginRadiantNight,
  openEclipseChoice,
  commitEclipseChoice,
  captureRadiantTurn,
  closeRadiantNight,
  commitRadiantShelter,
  sealRadiantNightEffects,
} from "../../../../src/game/mechanisms/roles/radiant_eclipse/night_frame";
import type { GameEvent } from "../../../../src/core/domain/events";
function fixture() {
  const world = new World();
  const roles = [
    Role.EclipseMaid,
    Role.RadiantCount,
    Role.Seer,
    Role.Witch,
    Role.Dreamer,
    Role.Villager,
    Role.Villager,
    Role.Villager,
    Role.Villager,
    Role.Wolf,
    Role.Wolf,
    Role.Wolf,
  ];
  for (const kind of roles) {
    const id = world.createEntity(),
      camp = kind === Role.EclipseMaid || kind === Role.Wolf ? Camp.Wolf : Camp.Good,
      role = createRoleComponent(kind, camp);
    world.addComponent(id, COMPONENT.Role, role);
    world.addComponent(id, COMPONENT.Camp, createCampComponent(camp));
    world.addComponent(
      id,
      COMPONENT.Victory,
      createVictoryComponent([{ kind: "faction", faction: camp }]),
    );
    world.addComponent(id, COMPONENT.Alive, createAliveComponent());
    world.addComponent(id, COMPONENT.Identity, {
      id,
      seat: id,
      name: `synthetic-${id}`,
      sessionId: "synthetic",
    });
    if (kind === Role.EclipseMaid) {
      role.privateState.eclipse = createEclipseState();
      role.privateState.abilities = {};
    }
    if (kind === Role.RadiantCount) installNativeAbility(role, "shelter", createShelterState());
    if (kind === Role.Seer)
      installNativeAbility(role, "seer_check", {
        lastTarget: null,
        lastIsWerewolf: null,
        history: [],
      });
    if (kind === Role.Witch)
      installNativeAbility(role, "potion", {
        heal: 1,
        poison: 0,
        selfHealRule: WitchSelfHealRule.Disabled,
        canSelfHeal: false,
        healUsedThisNight: false,
        poisonUsedThisNight: false,
      });
    if (kind === Role.Dreamer)
      installNativeAbility(role, "dream", {
        lastTarget: 6,
        lastDay: 1,
        history: [{ day: 1, targetId: 6 }],
        protectionPolicy: "netease_2026_night_immunity_v1",
      });
  }
  const role = (id: number) => world.getComponent<RoleComponent>(id, COMPONENT.Role)!;
  const events: GameEvent[] = [];
  installRadiantEclipseBoard(world);
  beginRadiantNight(world, 2);
  openEclipseChoice(world, 2);
  return { world, role, events };
}
import { captureNightLife } from "../../../../src/core/domain/night_effects";
import { DamageResolutionSystem } from "../../../../src/core/domain/systems/damage_resolution_system";
import { StatusMarksComponent } from "../../../../src/core/domain/components/status_marks";
import { StatusMark } from "../../../../src/core/domain/identity";
test("a returned shelter claim cannot redirect an original paid shelter to another player", () => {
  const f = fixture();
  commitEclipseChoice(f.world, 2, 2, f.events);
  const borrowed = findNightAbility(f.role(1), "shelter")!;
  commitRadiantShelter(f.world, 2, 1, borrowed, 6, f.events);
  const effects = sealRadiantNightEffects(f.world, 2);
  closeRadiantNight(f.world, 2, "committed", f.events);
  try {
    Object.assign(effects.shelters[0]!.target, captureNightLife(f.world, 7)!);
  } catch {}
  f.world.addComponent(
    7,
    COMPONENT.StatusMarks,
    new StatusMarksComponent([StatusMark.WolfKillMark]),
  );
  const result = new DamageResolutionSystem().resolve(f.world, {
    radiantShelters: effects.shelters,
  });
  expect(result.deaths).toContain(7);
});
test("a returned backlash claim cannot move the Maids paid backlash to another player", () => {
  const f = fixture();
  commitEclipseChoice(f.world, 2, 2, f.events);
  const effects = sealRadiantNightEffects(f.world, 2);
  closeRadiantNight(f.world, 2, "committed", f.events);
  try {
    Object.assign(effects.backlashes[0]!.target, captureNightLife(f.world, 7)!);
  } catch {}
  const result = new DamageResolutionSystem().resolve(f.world, {
    radiantBacklashes: effects.backlashes,
  });
  expect(result.deaths).not.toContain(7);
  expect(result.deathSources[7]).toBeUndefined();
});
