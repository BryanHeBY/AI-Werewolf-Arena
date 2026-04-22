import { Camp, EntityId, PromptRenderable, Role } from "../model";

/**
 * 角色组件：统一记录底牌与角色私有状态。
 */
export interface RoleComponent extends PromptRenderable {
  role: Role;
  camp: Camp;
  /**
   * 角色私有机制状态由机制层管理，框架层仅维护通用容器。
   */
  privateState: Record<string, unknown>;
}

/**
 * 创建角色组件并按角色初始化私有状态。
 */
export function createRoleComponent(role: Role, camp: Camp): RoleComponent {
  return {
    role,
    camp,
    privateState: {},
    renderPrompt(): string {
      return `你的底牌是【${this.role}】。`;
    },
  };
}
