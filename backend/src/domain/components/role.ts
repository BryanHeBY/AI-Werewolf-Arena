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
 * 角色组件工厂：
 * 根据底牌初始化角色私有状态（如女巫药量、守卫上轮守护目标等）。
 */
export function inferCamp(role: Role): Camp {
  if (role === Role.Wolf) {
    return Camp.Wolf;
  }
  return Camp.Good;
}

/**
 * 创建角色组件并按角色初始化私有状态。
 */
export function createRoleComponent(role: Role): RoleComponent {
  return {
    role,
    camp: inferCamp(role),
    privateState: {},
    renderPrompt(): string {
      return `你的底牌是【${this.role}】。`;
    },
  };
}
