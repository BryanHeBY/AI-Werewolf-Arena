/** 文件说明：组装角色规格视图（label/skill/allowedTools）。 */
import { Role, ToolName } from "../../domain/model";
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
