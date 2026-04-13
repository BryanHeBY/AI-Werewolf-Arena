import { Role, ToolName } from "../model";

/**
 * 角色工具注册表：
 * 负责“角色 -> 可调用工具列表”的集中管理。
 */
export class RoleRegistry {
  private readonly toolMap: Map<Role, ToolName[]> = new Map();

  constructor() {
    for (const role of Object.values(Role)) {
      this.toolMap.set(role, []);
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
