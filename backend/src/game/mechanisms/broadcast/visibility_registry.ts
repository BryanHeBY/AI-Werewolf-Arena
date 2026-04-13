/** 文件说明：封装广播可见性判定逻辑。 */
import { COMPONENT } from "../../../domain/components/names";
import { RoleComponent } from "../../../domain/components/role";
import { Camp, EntityId, Role } from "../../../domain/model";
import { World } from "../../../domain/world";
import { getDefaultRoleCampRegistry } from "../roles/camp_registry";

/** 广播受众身份视图。 */
export interface AudienceIdentity {
  role?: string;
  camp?: Camp | string;
}

/** 广播可见性判定注册器。 */
export class VisibilityRegistry {
  private readonly roleCampRegistry = getDefaultRoleCampRegistry();

  isWolfPlayer(world: World, actorId: EntityId): boolean {
    const roleComp = world.getComponent<RoleComponent>(actorId, COMPONENT.Role);
    return roleComp?.camp === Camp.Wolf;
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
    return this.roleCampRegistry.get(identity.role) === Camp.Wolf;
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
