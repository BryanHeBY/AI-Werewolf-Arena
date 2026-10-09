import { COMPONENT, type RoleComponent, type World, type EntityId } from "../../../core/domain";
import { getDefaultRoleCatalog, type RoleCatalog } from "../roles/catalog";

/** Public eligibility; never exposes a secret immunity or another player's state. */
export function canBeExiled(
  world: World,
  id: EntityId,
  catalog: RoleCatalog = getDefaultRoleCatalog(),
): boolean {
  const role = world.getComponent<RoleComponent>(id, COMPONENT.Role);
  return (
    world.getComponent<{ alive: boolean }>(id, COMPONENT.Alive)?.alive === true &&
    role !== undefined &&
    catalog.participation(role).canBeExiled
  );
}

export function canVote(
  world: World,
  id: EntityId,
  catalog: RoleCatalog = getDefaultRoleCatalog(),
): boolean {
  const role = world.getComponent<RoleComponent>(id, COMPONENT.Role);
  return (
    world.getComponent<{ alive: boolean }>(id, COMPONENT.Alive)?.alive === true &&
    role !== undefined &&
    catalog.participation(role).canVote &&
    world.getComponent<{ canVote: boolean }>(id, COMPONENT.VotingRight)?.canVote === true
  );
}

export function canBeSheriff(
  world: World,
  id: EntityId,
  catalog: RoleCatalog = getDefaultRoleCatalog(),
): boolean {
  const role = world.getComponent<RoleComponent>(id, COMPONENT.Role);
  return (
    canVote(world, id, catalog) && role !== undefined && catalog.participation(role).canBeSheriff
  );
}
