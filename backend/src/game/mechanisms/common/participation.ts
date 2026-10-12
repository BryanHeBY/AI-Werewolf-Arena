/**
 * Checks exile, vote and sheriff participation from current World components. Inputs are player
 * IDs and their life/role rights; outputs are the existing eligibility booleans. It does not
 * submit ballots, change vote weights or apply elimination.
 */
import { COMPONENT, type RoleComponent, type World, type EntityId } from "../../../core/domain";
import { getDefaultRoleCatalog, type RoleCatalog } from "../roles/catalog";

import { debateVoteBlocked } from "../roles/debater/authority";

export function canVoteExile(
  world: World,
  id: EntityId,
  day: number | undefined,
  catalog?: RoleCatalog,
): boolean {
  return canVote(world, id, catalog) && !debateVoteBlocked(world, id, day);
}

/** Public eligibility; never exposes a secret immunity or another player's state. */
export function canBeExiled(
  world: World,
  id: EntityId,
  catalog: RoleCatalog = getDefaultRoleCatalog(),
): boolean {
  const role = world.getComponent(id, COMPONENT.Role);
  return (
    world.getComponent(id, COMPONENT.Alive)?.alive === true &&
    role !== undefined &&
    catalog.participation(role).canBeExiled
  );
}

export function canVote(
  world: World,
  id: EntityId,
  catalog: RoleCatalog = getDefaultRoleCatalog(),
): boolean {
  const role = world.getComponent(id, COMPONENT.Role);
  return (
    world.getComponent(id, COMPONENT.Alive)?.alive === true &&
    role !== undefined &&
    catalog.participation(role).canVote &&
    world.getComponent(id, COMPONENT.VotingRight)?.canVote === true
  );
}

export function canBeSheriff(
  world: World,
  id: EntityId,
  catalog: RoleCatalog = getDefaultRoleCatalog(),
): boolean {
  const role = world.getComponent(id, COMPONENT.Role);
  return (
    canVote(world, id, catalog) && role !== undefined && catalog.participation(role).canBeSheriff
  );
}
