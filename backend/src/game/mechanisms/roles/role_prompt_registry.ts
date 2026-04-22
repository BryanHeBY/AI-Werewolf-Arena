/** 文件说明：提供角色名称与技能简介的统一查询接口。 */
import { Role } from "../../../core/domain/model";
import { getDefaultRoleProfileRegistry, RoleProfileRegistry } from "./profile_registry";

/** 角色提示词信息注册表。 */
export class RolePromptRegistry {
  private readonly roleProfileRegistry: RoleProfileRegistry;

  constructor(roleProfileRegistry: RoleProfileRegistry = getDefaultRoleProfileRegistry()) {
    this.roleProfileRegistry = roleProfileRegistry;
  }

  label(role: Role): string {
    return this.roleProfileRegistry.get(role)?.label ?? role;
  }

  skillBrief(role: Role): string {
    return this.roleProfileRegistry.get(role)?.skillBrief ?? "请按当前规则解释该角色技能";
  }
}

let defaultRegistry: RolePromptRegistry | null = null;

/** 获取默认角色提示词信息注册表实例。 */
export function getDefaultRolePromptRegistry(): RolePromptRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new RolePromptRegistry();
  }
  return defaultRegistry;
}
