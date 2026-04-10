/** 文件说明：把角色 profile 的初始化与提示渲染能力注入到组件。 */
import { RoleComponent } from "../../domain/components/role";
import { getDefaultRoleProfileRegistry, RoleProfileRegistry } from "./profile_registry";

/** 角色运行时初始化注册表。 */
export class RoleRuntimeRegistry {
  private readonly roleProfileRegistry: RoleProfileRegistry;

  constructor(roleProfileRegistry: RoleProfileRegistry = getDefaultRoleProfileRegistry()) {
    this.roleProfileRegistry = roleProfileRegistry;
  }

  apply(roleComp: RoleComponent): void {
    this.roleProfileRegistry.get(roleComp.role)?.init?.(roleComp);
    roleComp.renderPrompt = () => {
      const render = this.roleProfileRegistry.get(roleComp.role)?.renderPrompt;
      if (render) {
        return render(roleComp);
      }
      return "你的底牌是【平民】。你没有夜间技能。";
    };
  }
}

let defaultRegistry: RoleRuntimeRegistry | null = null;

/** 获取默认角色运行时初始化注册表实例。 */
export function getDefaultRoleRuntimeRegistry(): RoleRuntimeRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new RoleRuntimeRegistry();
  }
  return defaultRegistry;
}
