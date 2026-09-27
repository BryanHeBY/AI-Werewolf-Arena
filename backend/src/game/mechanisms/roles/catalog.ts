/** 文件说明：集中注册角色 profile，并提供阵营、提示词和运行时适配能力。 */
import { RoleComponent } from "../../../core/domain/components/role";
import { Camp, Role } from "../../../core/domain/model";
import { RoleInitContext, RoleProfile } from "./contracts";
import { GUARD_ROLE_PROFILE } from "./guard/profile";
import { HUNTER_ROLE_PROFILE } from "./hunter/profile";
import { IDIOT_ROLE_PROFILE } from "./idiot/profile";
import { SEER_ROLE_PROFILE } from "./seer/profile";
import { VILLAGER_ROLE_PROFILE } from "./villager/profile";
import { WITCH_ROLE_PROFILE } from "./witch/profile";
import { WOLF_ROLE_PROFILE } from "./wolf/profile";

const DEFAULT_ROLE_PROFILES: RoleProfile[] = [
  WOLF_ROLE_PROFILE,
  VILLAGER_ROLE_PROFILE,
  SEER_ROLE_PROFILE,
  GUARD_ROLE_PROFILE,
  WITCH_ROLE_PROFILE,
  HUNTER_ROLE_PROFILE,
  IDIOT_ROLE_PROFILE,
];

/** 角色目录：集中提供角色完整 profile 及其轻量派生视图。 */
export class RoleCatalog {
  private readonly profileByRole = new Map<Role, RoleProfile>();

  constructor(profiles: RoleProfile[] = DEFAULT_ROLE_PROFILES) {
    for (const profile of profiles) {
      this.profileByRole.set(profile.role, profile);
    }
  }

  get(role: Role): RoleProfile | undefined {
    return this.profileByRole.get(role);
  }

  all(): RoleProfile[] {
    return Array.from(this.profileByRole.values());
  }

  getCamp(role: Role): Camp {
    return this.get(role)?.camp ?? Camp.Good;
  }

  label(role: Role): string {
    return this.get(role)?.label ?? role;
  }

  skillBrief(role: Role): string {
    return this.get(role)?.skillBrief ?? "请按当前规则解释该角色技能";
  }

  applyRuntime(roleComp: RoleComponent, ctx: RoleInitContext = {}): void {
    this.get(roleComp.role)?.init?.(roleComp, ctx);
    roleComp.renderPrompt = () => {
      const render = this.get(roleComp.role)?.renderPrompt;
      return render ? render(roleComp) : "你的底牌是【平民】。你没有夜间技能。";
    };
  }
}

let defaultCatalog: RoleCatalog | null = null;

/** 获取默认角色目录实例。 */
export function getDefaultRoleCatalog(): RoleCatalog {
  if (!defaultCatalog) {
    defaultCatalog = new RoleCatalog();
  }
  return defaultCatalog;
}
