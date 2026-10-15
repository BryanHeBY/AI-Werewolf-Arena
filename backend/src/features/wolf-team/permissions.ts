/**
 * 负责分别推导狼队知识、聊天参与和刀权。输入为当前 World 角色及明确运行政策；输出保留队友、狼聊、狼刀名单和事件受众。狼阵营本身不等于拥有全部狼队权限，不据历史知识授予当前刀权。身份安装失败的退休仅关闭狼聊／刀执行，不抹已知队友或改写历史受众。
 */
import { invokeRoleCallback } from "../../rulesets/roles/owned-bindings";
import { scholarMentorPackBlocked } from "../scholar-mentor/wolf-team-ports";
import { animalPackKnifeBlocked } from "../animal-dream/wolf-team-ports";
import { nightmareKnifeBlocked } from "../nightmare/wolf-team-ports";
import { weddingMember, ghostBrideReady, weddingSetup } from "../ghost-bride/wedding-ports";
import { initialIdentitySetupReady } from "../initial-identity/deal-ports";
import { COMPONENT } from "../../domain/components/names";
import type { RoleComponent } from "../../domain/components/role";
import type { CurrentCampSource } from "../../domain/components/camp";
import { isRoleExecutionRetired } from "../../domain/role-execution-authority";
import { Camp, type EntityId, type GameEvent, type WolfTeamEventType } from "../../domain/model";
import type { World } from "../../domain/world";
import type { RoleCatalog } from "../../rulesets/roles/catalog";
import type { WolfTeamPermissions } from "../../rulesets/roles/contracts";

const NO_ACCESS: WolfTeamPermissions = Object.freeze({
  recognizedByPack: false,
  recognizes: "none",
  canChat: false,
  canVoteForKill: false,
});

/** 当前阵营仅在原门控点消费显式 source；知识与行动资格仍独立，不缓存组件或写库存。 */
export function wolfTeamPermissions(
  role: RoleComponent | undefined,
  catalog: RoleCatalog,
  currentCamp: CurrentCampSource,
  world?: World,
): WolfTeamPermissions {
  if (world && !initialIdentitySetupReady(world)) return NO_ACCESS;
  if (!role || currentCamp()?.camp !== Camp.Wolf) return NO_ACCESS;
  if (world && weddingSetup(world) && (!ghostBrideReady(world) || weddingMember(world, role)))
    return NO_ACCESS;
  const permissions = catalog.runtime(role.role)?.wolfTeam;
  const result =
    typeof permissions === "function"
      ? invokeRoleCallback("wolfTeam", permissions, undefined, role, world, currentCamp)
      : (permissions ?? NO_ACCESS);
  const current =
    world &&
    (nightmareKnifeBlocked(world) ||
      scholarMentorPackBlocked(world) ||
      animalPackKnifeBlocked(world))
      ? { ...result, canVoteForKill: false }
      : result;
  // 原拒绝单例仍保身份，避免知识查询把它当新权限对象而继续读取。
  if (current === NO_ACCESS) return current;
  // 原资格和阻断查询先行；退休只拒演员执行，recognized／recognizes 仍供原知识查询使用。
  return isRoleExecutionRetired(role)
    ? { ...current, canChat: false, canVoteForKill: false }
    : current;
}

export function knownWolfTeammates(
  world: World,
  actorId: EntityId,
  catalog: RoleCatalog,
): EntityId[] {
  const viewer = wolfTeamPermissions(
    world.getComponent(actorId, COMPONENT.Role),
    catalog,
    () => world.getComponent(actorId, COMPONENT.Camp),
    world,
  );
  if (viewer === NO_ACCESS) return [];
  const role = world.getComponent(actorId, COMPONENT.Role);
  const snapshot =
    role &&
    world.getComponent(actorId, COMPONENT.Camp)?.camp === Camp.Wolf &&
    catalog.runtime(role.role)?.knownTeammates;
  if (snapshot)
    return [...new Set(invokeRoleCallback("knownTeammates", snapshot, undefined, role!, world))]
      .filter(
        (id) =>
          id !== actorId &&
          world.getComponent(id, COMPONENT.Role) &&
          world.getComponent(id, COMPONENT.Camp)?.camp === Camp.Wolf,
      )
      .sort((a, b) => a - b);
  if (viewer.recognizes === "none") return [];
  // 身份知识独立于尚未公告的死亡，不能按真实存活状态重写已知队友。
  return world
    .entityIds()
    .filter((id) => {
      if (id === actorId) return false;
      const target = world.getComponent(id, COMPONENT.Role);
      if (!target || world.getComponent(id, COMPONENT.Camp)?.camp !== Camp.Wolf) return false;
      if (viewer.recognizes === "all") return true;
      if (viewer.recognizes === "pack")
        return wolfTeamPermissions(
          target,
          catalog,
          () => world.getComponent(id, COMPONENT.Camp),
          world,
        ).recognizedByPack;
      return viewer.recognizes.includes(target.role);
    })
    .sort((a, b) => a - b);
}

export function wolfChatParticipants(world: World, catalog: RoleCatalog): EntityId[] {
  return world
    .getAliveEntityIds()
    .filter(
      (id) =>
        wolfTeamPermissions(
          world.getComponent(id, COMPONENT.Role),
          catalog,
          () => world.getComponent(id, COMPONENT.Camp),
          world,
        ).canChat,
    )
    .sort((a, b) => a - b);
}

export function wolfKnifeHolders(world: World, catalog: RoleCatalog): EntityId[] {
  return world
    .getAliveEntityIds()
    .filter(
      (id) =>
        wolfTeamPermissions(
          world.getComponent(id, COMPONENT.Role),
          catalog,
          () => world.getComponent(id, COMPONENT.Camp),
          world,
        ).canVoteForKill,
    )
    .sort((a, b) => a - b);
}

/** 在事实发布时捕获一次受众；此受众包只用于引擎／Tape，不随后续阵营变化补发历史。 */
export function wolfTeamEvent<K extends WolfTeamEventType>(
  world: World,
  catalog: RoleCatalog,
  event: Omit<Extract<GameEvent, { type: K }>, "audience">,
): Extract<GameEvent, { type: K }> {
  const recipients = wolfChatParticipants(world, catalog);
  if (event.type === "wolf_kill_vote_cast") recipients.push(...wolfKnifeHolders(world, catalog));
  return {
    ...event,
    audience: Object.freeze([...new Set(recipients)].sort((a, b) => a - b)),
  } as Extract<GameEvent, { type: K }>;
}
