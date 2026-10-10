import { EVIL_KNIGHT_ROLE_PROFILE } from "./evil_knight/profile";
import { DEMON_HUNTER_ROLE_PROFILE } from "./demon_hunter/profile";
import { PURE_WHITE_ROLE_PROFILE, WOLF_WITCH_ROLE_PROFILE } from "./pure_white/profile";
import { GHOST_BRIDE_ROLE_PROFILE } from "./ghost_bride/profile";
import { LONELY_GIRL_ROLE_PROFILE } from "./lonely_girl/profile";
import { WILD_CHILD_ROLE_PROFILE } from "./wild_child/profile";
import { SHAPESHIFTER_ROLE_PROFILE } from "./shapeshifter/profile";
import { THIEF_ROLE_PROFILE } from "./thief/profile";
/** 文件说明：集中注册角色 profile，并提供阵营、提示词和运行时适配能力。 */
import { RoleComponent } from "../../../core/domain/components/role";
import { Camp, Role } from "../../../core/domain/model";
import { RoleInitContext, RoleProfile } from "./contracts";
import { GUARD_ROLE_PROFILE } from "./guard/profile";
import { HUNTER_ROLE_PROFILE } from "./hunter/profile";
import { IDIOT_ROLE_PROFILE } from "./idiot/profile";
import { roleName, text, type Locale, type MessageKey } from "@ai-werewolf-arena/game-text";
import { SEER_ROLE_PROFILE } from "./seer/profile";
import { VILLAGER_ROLE_PROFILE } from "./villager/profile";
import { WITCH_ROLE_PROFILE } from "./witch/profile";
import { WOLF_ROLE_PROFILE } from "./wolf/profile";
import { WOLF_KING_ROLE_PROFILE } from "./wolf_king/profile";
import { WHITE_WOLF_KING_ROLE_PROFILE } from "./white_wolf_king/profile";
import { KNIGHT_ROLE_PROFILE } from "./knight/profile";
import { GRAVEKEEPER_ROLE_PROFILE } from "./gravekeeper/profile";
import { DREAMER_ROLE_PROFILE } from "./dreamer/profile";
import { WOLF_BEAUTY_ROLE_PROFILE } from "./wolf_beauty/profile";
import { BEAR_ROLE_PROFILE } from "./bear/profile";
import { HIDDEN_WOLF_ROLE_PROFILE } from "./hidden_wolf/profile";
import { GARGOYLE_ROLE_PROFILE } from "./gargoyle/profile";

import { PSYCHIC_ROLE_PROFILE } from "./psychic/profile";
import { MECHANICAL_WOLF_ROLE_PROFILE } from "./mechanical_wolf/profile";
import { BLACK_MARKET_MERCHANT_ROLE_PROFILE } from "./black_market_merchant/profile";
import { MIRACLE_MERCHANT_ROLE_PROFILE } from "./miracle_merchant/profile";

import { HYBRID_ROLE_PROFILE } from "./hybrid/profile";
import { MIRROR_GIRL_ROLE_PROFILE } from "./mirror_girl/profile";
import { AWAKENED_HIDDEN_WOLF_ROLE_PROFILE } from "./awakened_hidden_wolf/profile";

import { CURSED_FOX_ROLE_PROFILE } from "./cursed_fox/profile";

import { DEBATER_ROLE_PROFILE } from "./debater/profile";
import { CUPID_ROLE_PROFILE } from "./cupid/profile";

const DEFAULT_ROLE_PROFILES: RoleProfile[] = [
  EVIL_KNIGHT_ROLE_PROFILE,
  PURE_WHITE_ROLE_PROFILE,
  WOLF_WITCH_ROLE_PROFILE,
  DEMON_HUNTER_ROLE_PROFILE,
  GHOST_BRIDE_ROLE_PROFILE,
  WILD_CHILD_ROLE_PROFILE,
  LONELY_GIRL_ROLE_PROFILE,
  THIEF_ROLE_PROFILE,
  SHAPESHIFTER_ROLE_PROFILE,
  WOLF_ROLE_PROFILE,
  WOLF_KING_ROLE_PROFILE,
  WHITE_WOLF_KING_ROLE_PROFILE,
  KNIGHT_ROLE_PROFILE,
  GRAVEKEEPER_ROLE_PROFILE,
  DREAMER_ROLE_PROFILE,
  WOLF_BEAUTY_ROLE_PROFILE,
  BEAR_ROLE_PROFILE,
  CURSED_FOX_ROLE_PROFILE,
  CUPID_ROLE_PROFILE,
  DEBATER_ROLE_PROFILE,
  HIDDEN_WOLF_ROLE_PROFILE,
  GARGOYLE_ROLE_PROFILE,
  PSYCHIC_ROLE_PROFILE,
  MECHANICAL_WOLF_ROLE_PROFILE,
  MIRACLE_MERCHANT_ROLE_PROFILE,
  BLACK_MARKET_MERCHANT_ROLE_PROFILE,
  HYBRID_ROLE_PROFILE,
  MIRROR_GIRL_ROLE_PROFILE,
  AWAKENED_HIDDEN_WOLF_ROLE_PROFILE,
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
      if (this.profileByRole.has(profile.role))
        throw new Error(`role_profile_duplicate: ${profile.role}`);
      this.profileByRole.set(profile.role, profile);
    }
  }

  get(role: Role): RoleProfile | undefined {
    return this.profileByRole.get(role);
  }

  all(): RoleProfile[] {
    return Array.from(this.profileByRole.values());
  }

  participation(role: RoleComponent): {
    canVote: boolean;
    canBeExiled: boolean;
    canBeSheriff: boolean;
  } {
    const profile = this.get(role.role);
    if (!profile) return { canVote: false, canBeExiled: false, canBeSheriff: false };
    return typeof profile.participation === "function"
      ? { ...profile.participation(role) }
      : { ...(profile.participation ?? { canVote: true, canBeExiled: true, canBeSheriff: true }) };
  }

  getCamp(role: Role): Camp {
    const profile = this.require(role);
    return profile.camp ?? Camp.Good;
  }

  label(role: Role, locale: Locale = "zh-CN"): string {
    const profile = this.get(role);
    const builtIn = DEFAULT_ROLE_PROFILES.find((entry) => entry.role === role);
    // Explicit injected text is user content, not a built-in translation key.
    if (profile && (!builtIn || profile.label !== builtIn.label)) return profile.label;
    return roleName(role, locale);
  }

  skillBrief(role: Role, locale: Locale = "zh-CN"): string {
    const profile = this.get(role);
    if (!profile) return role;
    const builtIn = DEFAULT_ROLE_PROFILES.find((entry) => entry.role === role);
    if (!builtIn || profile.skillBrief !== builtIn.skillBrief) return profile.skillBrief;
    return text(locale, `role.${role}.brief` as MessageKey);
  }

  applyRuntime(roleComp: RoleComponent, ctx: RoleInitContext = {}): void {
    const profile = this.require(roleComp.role);
    profile.init?.(roleComp, ctx);
    const defaultLocale = ctx.locale ?? "zh-CN";
    roleComp.renderPrompt = (locale = defaultLocale) => {
      const active = this.require(roleComp.role);
      return active.renderPrompt
        ? active.renderPrompt(roleComp, locale, ctx.world)
        : text(locale, "role.generic.state", { role: this.label(active.role, locale) });
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
