/**
 * Defines the original role component and its opaque read-only private-state container.
 * Inputs are role/camp/locale; outputs retain the same component and empty record.
 * The core never installs feature slots, clones state or freezes a live actor.
 * Read callers cannot index or replace the container or assign arbitrary keys; feature
 * owners keep their concrete slots and profile initialization has its own write
 * contract. Role/camp mutation and prompt behavior retain their existing owners.
 */
import { text, roleName, type Locale } from "@ai-werewolf-arena/game-text";
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
  readonly privateState: object;
}

/**
 * 创建角色组件并按角色初始化私有状态。
 */
export function createRoleComponent(
  role: Role,
  camp: Camp,
  locale: Locale = "zh-CN",
): RoleComponent {
  return {
    role,
    camp,
    privateState: {},
    renderPrompt(displayLocale: Locale = locale): string {
      return text(displayLocale, "component.role", { role: roleName(this.role, displayLocale) });
    },
  };
}
