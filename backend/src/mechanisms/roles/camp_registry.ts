/** 文件说明：角色阵营注册表（从角色 profile 派生），用于解耦框架层角色特化判断。 */
import { Camp, Role } from "../../domain/model";
import { getDefaultRoleProfileRegistry, RoleProfileRegistry } from "./profile_registry";

/** 角色阵营注册表。 */
export class RoleCampRegistry {
  private readonly campByRole = new Map<Role, Camp>();

  constructor(roleProfileRegistry: RoleProfileRegistry = getDefaultRoleProfileRegistry()) {
    for (const role of Object.values(Role)) {
      const camp = roleProfileRegistry.get(role)?.camp ?? Camp.Good;
      this.campByRole.set(role, camp);
    }
  }

  /** 获取角色对应阵营，未配置时默认 good。 */
  get(role: Role): Camp {
    return this.campByRole.get(role) ?? Camp.Good;
  }
}

let defaultRegistry: RoleCampRegistry | null = null;

/** 获取默认角色阵营注册表。 */
export function getDefaultRoleCampRegistry(): RoleCampRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new RoleCampRegistry();
  }
  return defaultRegistry;
}
