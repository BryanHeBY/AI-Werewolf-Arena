/**
 * Owns test driver support: Raw subsystem World fixture plus bounded Noble Body night choices, damage and closure controls; no whole game or transport.
 * Inputs are supplied script steps, callbacks or fixture resource requests;
 * outputs are the original controlled traces, handles and boundary responses.
 * Unit and scenario tests keep their supplied literal actions and failure
 * expectations as the oracle. Driver ownership, cleanup and error policy never
 * change during this relocation; no billed model is introduced.
 */
import { World } from "../../../../../src/core/domain/world";
import { COMPONENT } from "../../../../../src/core/domain/components/names";
import { Role, Camp } from "../../../../../src/core/domain/identity";
import { createRoleComponent } from "../../../../../src/core/domain/components/role";
import { createAliveComponent, type AliveComponent } from "../../../../../src/core/domain/components/alive";
import { createCampComponent } from "../../../../../src/core/domain/components/camp";
import { createVictoryComponent } from "../../../../../src/core/domain/components/victory";
import { createIdentityComponent } from "../../../../../src/core/domain/entities/player";
import {
  createNobleState,
  createSecretBodyState,
} from "../../../../../src/game/mechanisms/roles/noble_secret_body/state";
import {
  installNobleBodyAuthority,
  beginNobleBodyNight,
  openSecretBodyChoice,
  openServantChoice,
  expireServantAtNightEnd,
  resolveSecretBodyDamage,
  closeNobleBodyNight,
} from "../../../../../src/game/mechanisms/roles/noble_secret_body/authority";
/** Explicit subsystem fixture. Surrogate existing cards prove original-object ownership;
 * this does not register the two planned roles or pretend to run their game rules. */
export function nobleBodyAuthorityFixture() {
  const world = new World(),
    roles = [];
  for (let id = 1; id <= 6; id++) {
    const actual = world.createEntity(),
      camp = id === 1 ? Camp.Wolf : Camp.Good,
      role = createRoleComponent(id === 1 ? Role.Wolf : Role.Villager, camp);
    if (id === 1) role.privateState.noble = createNobleState();
    if (id === 2) role.privateState.secretBody = createSecretBodyState();
    world.addComponent(actual, COMPONENT.Role, role);
    world.addComponent(
      actual,
      COMPONENT.Identity,
      createIdentityComponent(actual, actual, `Synthetic ${actual}`),
    );
    world.addComponent(actual, COMPONENT.Camp, createCampComponent(camp));
    world.addComponent(
      actual,
      COMPONENT.Victory,
      createVictoryComponent([{ kind: "faction", faction: camp }]),
    );
    world.addComponent(actual, COMPONENT.Alive, createAliveComponent());
    roles.push(role);
  }
  installNobleBodyAuthority(world, 1, 2);
  const life = (id: number) => world.getComponent<AliveComponent>(id, COMPONENT.Alive)!;
  const finish = (day: number) => {
    expireServantAtNightEnd(world, day);
    closeNobleBodyNight(world, day, "normal");
    return resolveSecretBodyDamage(world, day, {});
  };
  const night = (
    day: number,
    bodyTarget: number | null = null,
    nobleTarget: number | null = null,
  ) => {
    beginNobleBodyNight(world, day, () => true);
    openSecretBodyChoice(world, day).commit(bodyTarget);
    if (day >= 2) openServantChoice(world, day).commit(nobleTarget);
  };
  return { world, roles, life, finish, night };
}
