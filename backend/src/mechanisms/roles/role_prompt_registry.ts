import { Role } from "../../domain/model";
import { getDefaultRoleProfileRegistry, RoleProfileRegistry } from "./profile_registry";

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

export function getDefaultRolePromptRegistry(): RolePromptRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new RolePromptRegistry();
  }
  return defaultRegistry;
}
