/** 文件说明：组装角色规格视图（label/skill/allowedTools）。 */
import { Role, ToolName } from "../../../core/domain/model";
import { RoleRegistry } from "../../../core/domain/registries/role_registry";
import { COMMON_TOOL_SPECS } from "../common/tool_specs";
import { RoleSpec } from "../contracts";
import {
  getDefaultRolePromptRegistry,
  RolePromptRegistry,
} from "../roles/role_prompt_registry";
import { getDefaultRoleProfileRegistry, RoleProfileRegistry } from "../roles/profile_registry";

/** 角色规格注册表。 */
export class RoleSpecRegistry {
  private readonly specByRole = new Map<Role, RoleSpec>();

  constructor(
    roleProfileRegistry: RoleProfileRegistry = getDefaultRoleProfileRegistry(),
    promptRegistry: RolePromptRegistry = getDefaultRolePromptRegistry(),
  ) {
    const commonTools = COMMON_TOOL_SPECS.map((spec) => spec.name);
    for (const role of Object.values(Role)) {
      const roleTools = roleProfileRegistry
        .get(role)
        ?.toolSpecs?.map((spec) => spec.name) ?? [];
      const allowedTools = Array.from(new Set([...commonTools, ...roleTools])) as ToolName[];
      this.specByRole.set(role, {
        role,
        label: promptRegistry.label(role),
        skillBrief: promptRegistry.skillBrief(role),
        allowedTools,
      });
    }
  }

  get(role: Role): RoleSpec | undefined {
    return this.specByRole.get(role);
  }

  all(): RoleSpec[] {
    return Array.from(this.specByRole.values());
  }
}

/**
 * 构造与当前角色规格一致的工具权限注册表。
 *
 * RoleRegistry 属于 core 的数据结构，而“哪些角色拥有哪些工具”属于机制配置；
 * 通过此工厂装配，避免调用方复制 RoleSpecRegistry 的遍历逻辑。
 */
export function createDefaultRoleRegistry(
  roleSpecs: RoleSpecRegistry = new RoleSpecRegistry(),
): RoleRegistry {
  const registry = new RoleRegistry();
  for (const spec of roleSpecs.all()) {
    registry.registerAllowedTools(spec.role, spec.allowedTools);
  }
  return registry;
}
