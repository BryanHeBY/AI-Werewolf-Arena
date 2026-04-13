/** 文件说明：集中注册所有角色 profile。 */
import { Role } from "../../../core/domain/model";
import { RoleProfile } from "./contracts";
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

/** 角色 profile 注册表。 */
export class RoleProfileRegistry {
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
}

let defaultRegistry: RoleProfileRegistry | null = null;

/** 获取默认角色 profile 注册表实例。 */
export function getDefaultRoleProfileRegistry(): RoleProfileRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new RoleProfileRegistry();
  }
  return defaultRegistry;
}
