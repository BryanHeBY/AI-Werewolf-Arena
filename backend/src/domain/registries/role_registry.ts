import { Role, ToolName } from "../model";

/**
 * 每个角色默认可用工具集合（可被 `registerAllowedTools` 覆盖）。
 */
const BASE_ALLOWED_TOOLS: Record<Role, ToolName[]> = {
  [Role.Wolf]: ["speak_to_wolves", "kill_vote", "self_destruct", "speak", "vote"],
  [Role.Villager]: ["speak", "vote"],
  [Role.Seer]: ["check_identity", "speak", "vote"],
  [Role.Guard]: ["guard", "speak", "vote"],
  [Role.Witch]: ["use_potion", "speak", "vote"],
  [Role.Hunter]: ["shoot", "speak", "vote"],
  [Role.Idiot]: ["speak", "vote"],
};

/**
 * 角色工具注册表：
 * 负责“角色 -> 可调用工具列表”的集中管理。
 */
export class RoleRegistry {
  private readonly toolMap: Map<Role, ToolName[]> = new Map();

  constructor() {
    for (const role of Object.values(Role)) {
      this.toolMap.set(role, [...BASE_ALLOWED_TOOLS[role]]);
    }
  }

  /**
   * 获取角色当前可调用工具列表。
   */
  getAllowedTools(role: Role): ToolName[] {
    return [...(this.toolMap.get(role) ?? [])];
  }

  /**
   * 覆盖注册角色可调用工具列表。
   */
  registerAllowedTools(role: Role, tools: ToolName[]): void {
    this.toolMap.set(role, [...tools]);
  }
}
