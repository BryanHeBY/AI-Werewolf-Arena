/**
 * 负责角色标签到工具列表的登记；输入角色与有序工具名，输出列表的独立浅副本。
 * 构造时给既有角色空列表，登记保持原工具顺序和重复项，不校验实际库存或请求阶段。
 * 查询是配置资料，真实工具预检、当前资格与提交仍由接收器和机制拥有。
 */
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
   * 返回登记资料副本，缺项返回新空数组；这不证明当前玩家有权调用这些工具。
   */
  getAllowedTools(role: Role): ToolName[] {
    return [...(this.toolMap.get(role) ?? [])];
  }

  /**
   * 保存传入数组的副本，覆盖同角色旧表；不合并或删除重复工具名。
   */
  registerAllowedTools(role: Role, tools: ToolName[]): void {
    this.toolMap.set(role, [...tools]);
  }
}
