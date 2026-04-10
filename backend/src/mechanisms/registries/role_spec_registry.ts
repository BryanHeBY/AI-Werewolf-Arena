import { Role, ToolName } from "../../domain/model";
import { RoleRegistry } from "../../domain/registries/role_registry";
import { RoleSpec } from "../contracts";
import {
  getDefaultRolePromptRegistry,
  RolePromptRegistry,
} from "../roles/role_prompt_registry";

export class RoleSpecRegistry {
  private readonly specByRole = new Map<Role, RoleSpec>();

  constructor(
    roleRegistry: RoleRegistry = new RoleRegistry(),
    promptRegistry: RolePromptRegistry = getDefaultRolePromptRegistry(),
  ) {
    for (const role of Object.values(Role)) {
      this.specByRole.set(role, {
        role,
        label: promptRegistry.label(role),
        skillBrief: promptRegistry.skillBrief(role),
        allowedTools: roleRegistry.getAllowedTools(role) as ToolName[],
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

