import { RoleComponent } from "../../domain/components/role";
import { getDefaultRoleProfileRegistry, RoleProfileRegistry } from "./profile_registry";

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

export function getDefaultRoleRuntimeRegistry(): RoleRuntimeRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new RoleRuntimeRegistry();
  }
  return defaultRegistry;
}
