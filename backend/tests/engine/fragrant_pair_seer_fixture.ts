/**
 * Owns Fragrant authority test support with a fixed component roster and native pair resource.
 * Inputs are original installation/night callbacks; outputs are the same World,
 * events, open/choice helpers and controlled life mutations. Literal role/state
 * data is fixture setup, not a production rule oracle. Test-only container writes
 * preserve pair aliases and LHS timing; no profile, pipeline or transport runs here.
 */
import { World } from "../../src/core/domain/world";
import { Role, Camp } from "../../src/core/domain/identity";
import { COMPONENT } from "../../src/core/domain/components/names";
import { createAliveComponent, type AliveComponent } from "../../src/core/domain/components/alive";
import { createRoleComponent, type RoleComponent } from "../../src/core/domain/components/role";
import { createCampComponent } from "../../src/core/domain/components/camp";
import { createIdentityComponent } from "../../src/core/domain/entities/player";
import { createVictoryComponent } from "../../src/core/domain/components/victory";
import type { GameEvent } from "../../src/core/domain/events";
import {
  freshFragrantState,
  freshPairSeerState,
} from "../../src/game/mechanisms/roles/fragrant_pair_seer/state";
import { installNativeAbility } from "../../src/game/mechanisms/roles/abilities";
import {
  installFragrantPairAuthority,
  beginFragrantNight,
  openFragrantBindChoice,
  openPairCheckChoice,
} from "../../src/game/mechanisms/roles/fragrant_pair_seer/authority";
/** Component owner fixture with native pair resource. It does not run profile initialization,
 * qualify a board, or execute a pipeline, transport or replay. */
export function fragrantPairOwnerFixture(
  beforeInstall?: (role: RoleComponent) => void,
  nightHook?: () => boolean,
) {
  const world = new World(),
    events: GameEvent[] = [];
  const roles = [
    Role.FragrantPhantom,
    Role.Wolf,
    Role.Wolf,
    Role.Wolf,
    Role.AwakenedSeer,
    Role.Witch,
    Role.Hunter,
    Role.Guard,
    Role.Villager,
    Role.Villager,
    Role.Villager,
    Role.Villager,
  ];
  for (const [index, roleId] of roles.entries()) {
    const id = world.createEntity(),
      camp = index < 4 ? Camp.Wolf : Camp.Good,
      role = createRoleComponent(roleId, camp);
    if (id === 1) (role.privateState as Record<string, unknown>).fragrant = freshFragrantState();
    if (id === 5)
      (role.privateState as Record<string, unknown>).pairSeer = installNativeAbility(
        role,
        "pair_check",
        freshPairSeerState(),
      );
    world.addComponent(id, COMPONENT.Role, role);
    world.addComponent(id, COMPONENT.Camp, createCampComponent(camp));
    world.addComponent(id, COMPONENT.Alive, createAliveComponent());
    world.addComponent(id, COMPONENT.Identity, createIdentityComponent(id, id, `p${id}`));
    world.addComponent(
      id,
      COMPONENT.Victory,
      createVictoryComponent([{ kind: "faction", faction: camp }]),
    );
  }
  beforeInstall?.(world.getComponent<RoleComponent>(5, COMPONENT.Role)!);
  installFragrantPairAuthority(world, events, 1, 5);
  let current = true,
    draws = 0;
  const random = {
      next: () => {
        draws++;
        return 0.5;
      },
    },
    isCurrent = () => current && (nightHook?.() ?? true);
  const open = (day = 1) => beginFragrantNight(world, day, random, isCurrent);
  const kill = (...ids: number[]) => {
    for (const id of ids) world.getComponent<AliveComponent>(id, COMPONENT.Alive)!.alive = false;
  };
  const role = (id: number) => world.getComponent<RoleComponent>(id, COMPONENT.Role)!;
  const choices = (pair: number[] | null = [9, 10]) => {
    openFragrantBindChoice(world, 1).commit(pair);
    openPairCheckChoice(world, 1).commit([5, 6]);
  };
  return {
    world,
    events,
    open,
    kill,
    role,
    choices,
    random,
    isCurrent,
    stale: () => {
      current = false;
    },
    fresh: () => {
      current = true;
    },
    draws: () => draws,
  };
}
