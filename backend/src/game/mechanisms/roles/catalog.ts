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
      if (this.profileByRole.has(profile.role)) throw new Error(`role_profile_duplicate: ${profile.role}`);
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
    const profile = this.require(role);
    return profile.camp ?? Camp.Good;
  }

  label(role: Role): string {
    return this.get(role)?.label ?? role;
  }

  skillBrief(role: Role): string {
    return this.get(role)?.skillBrief ?? "请按当前规则解释该角色技能";
  }

  applyRuntime(roleComp: RoleComponent, ctx: RoleInitContext = {}): void {
    const profile = this.require(roleComp.role);
    profile.init?.(roleComp, ctx);
    roleComp.renderPrompt = () => {
      const active = this.require(roleComp.role);
      return active.renderPrompt ? active.renderPrompt(roleComp) : `你的底牌是【${active.label}】。请遵循本板规则。`;
    };
  }

  require(role: Role): RoleProfile {
    const profile = this.get(role);
    if (!profile) throw new Error(`role_profile_not_registered: ${role}`);
    return profile;
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
