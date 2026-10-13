/**
 * 负责查询放逐、投票和警长参与资格。输入为玩家编号及当前生命／角色权利；输出为原资格布尔值。不提交票、修改票重或执行出局。
 */
import { COMPONENT, type RoleComponent, type World, type EntityId } from "../../../core/domain";
import { type RoleCatalog } from "../roles/catalog";
import { getDefaultRoleCatalog } from "../roles/role-catalog-assembly";

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
