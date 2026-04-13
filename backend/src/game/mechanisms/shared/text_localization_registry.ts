/** 文件说明：广播文案的可注册翻译注册表。 */
import {
  ROLE_TEXT_LOCALIZATION_CONTRIBUTOR,
} from "../roles/text_localization";
import {
  WITCH_TEXT_LOCALIZATION_CONTRIBUTOR,
} from "../roles/witch/text_localization";
import {
  WIN_CONDITION_TEXT_LOCALIZATION_CONTRIBUTOR,
} from "../win_conditions/text_localization";

export interface TextLocalizationContributor {
  roleNames?: Record<string, string>;
  winnerNames?: Record<string, string>;
  gameOverReasons?: Record<string, string>;
  potionTypes?: Record<string, string>;
}

/** 广播翻译注册表。 */
export class TextLocalizationRegistry {
  private readonly roleNames = new Map<string, string>();
  private readonly winnerNames = new Map<string, string>();
  private readonly gameOverReasons = new Map<string, string>();
  private readonly potionTypes = new Map<string, string>();

  constructor(contributors: TextLocalizationContributor[] = []) {
    for (const contributor of contributors) {
      this.register(contributor);
    }
  }

  register(contributor: TextLocalizationContributor): void {
    for (const [key, value] of Object.entries(contributor.roleNames ?? {})) {
      this.roleNames.set(String(key), String(value));
    }
    for (const [key, value] of Object.entries(contributor.winnerNames ?? {})) {
      this.winnerNames.set(String(key), String(value));
    }
    for (const [key, value] of Object.entries(contributor.gameOverReasons ?? {})) {
      this.gameOverReasons.set(String(key), String(value));
    }
    for (const [key, value] of Object.entries(contributor.potionTypes ?? {})) {
      this.potionTypes.set(String(key), String(value));
    }
  }

  roleName(role: string): string {
    return this.roleNames.get(String(role)) ?? String(role);
  }

  winnerName(winner: string): string {
    return this.winnerNames.get(String(winner)) ?? String(winner);
  }

  gameOverReason(reason: string): string {
    return this.gameOverReasons.get(String(reason)) ?? String(reason);
  }

  potionType(potionType: string): string {
    return this.potionTypes.get(String(potionType)) ?? String(potionType);
  }
}

let defaultRegistry: TextLocalizationRegistry | null = null;

/** 获取默认翻译注册表实例。 */
export function getDefaultTextLocalizationRegistry(): TextLocalizationRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new TextLocalizationRegistry([
      ROLE_TEXT_LOCALIZATION_CONTRIBUTOR,
      WITCH_TEXT_LOCALIZATION_CONTRIBUTOR,
      WIN_CONDITION_TEXT_LOCALIZATION_CONTRIBUTOR,
    ]);
  }
  return defaultRegistry;
}

