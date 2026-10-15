/**
 * 负责查询放逐、投票和警长的公开参与资格。输入为玩家 ID、当前生命／投票权及角色目录；
 * 输出为原资格布尔值，放逐投票再按原顺序查询辩论封票。不提交票、修改票重、泄露秘密免疫或执行出局。
 */
import { COMPONENT, type RoleComponent, type World, type EntityId } from "../domain";
import { type RoleCatalog } from "../rulesets/roles/catalog";
import { getDefaultRoleCatalog } from "../rulesets/roles/role-catalog-assembly";

import { debateVoteBlocked } from "../features/debater/authority";

export function canVoteExile(
  world: World,
  id: EntityId,
  day: number | undefined,
  catalog?: RoleCatalog,
): boolean {
  return canVote(world, id, catalog) && !debateVoteBlocked(world, id, day);
}

/** 只查公开放逐资格，不揭示秘密免疫或另一玩家的私态。 */
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
