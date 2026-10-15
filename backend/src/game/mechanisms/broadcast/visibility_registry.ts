/**
 * 负责按当前角色和狼队权限核对广播受众。输入为 World 与受众身份；输出为狼队／角色可见性谓词。这些谓词只裁剪信息，不赋予玩家全知状态或行动权限。
 */
/** 文件说明：封装广播可见性判定逻辑。 */
import { COMPONENT } from "../../../domain/components/names";
import { RoleComponent } from "../../../domain/components/role";
import { Camp, EntityId, Role } from "../../../domain/model";
import { World } from "../../../domain/world";
import { getDefaultRoleCatalog } from "../roles/role-catalog-assembly";

/** 广播受众身份视图。 */
export interface AudienceIdentity {
  role?: string;
  camp?: Camp | string;
}

/** 广播可见性判定注册器。 */
export class VisibilityRegistry {
  private readonly roleCatalog = getDefaultRoleCatalog();

  isWolfPlayer(world: World, actorId: EntityId): boolean {
    const roleComp = world.getComponent(actorId, COMPONENT.Role);
    return !!roleComp && world.getComponent(actorId, COMPONENT.Camp)?.camp === Camp.Wolf;
  }

  isWolfAudience(identity: AudienceIdentity): boolean {
    if (identity.camp === Camp.Wolf || identity.camp === Camp.Wolf.toString()) {
      return true;
    }
    if (typeof identity.role !== "string") {
      return false;
    }
    if (!this.isRole(identity.role)) {
      return false;
    }
    return this.roleCatalog.getCamp(identity.role) === Camp.Wolf;
  }

  private isRole(role: string): role is Role {
    return (Object.values(Role) as string[]).includes(role);
  }
}

let defaultRegistry: VisibilityRegistry | null = null;

/** 获取默认广播可见性注册器实例。 */
export function getDefaultVisibilityRegistry(): VisibilityRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new VisibilityRegistry();
  }
  return defaultRegistry;
}
