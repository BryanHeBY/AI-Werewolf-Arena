/** 文件说明：广播文案的可注册翻译注册表。 */
import { roleName, term, text, type Locale } from "@ai-werewolf-arena/game-text";

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

  roleName(role: string, locale: Locale = "zh-CN"): string {
    return this.roleNames.get(String(role)) ?? roleName(role, locale);
  }

  winnerName(winner: string, locale: Locale = "zh-CN"): string {
    return (
      this.winnerNames.get(String(winner)) ??
      (winner ? term("camp", winner, locale) : text(locale, "common.none"))
    );
  }

  gameOverReason(reason: string, locale: Locale = "zh-CN"): string {
    return this.gameOverReasons.get(String(reason)) ?? term("reason", reason, locale);
  }

  potionType(potionType: string, locale: Locale = "zh-CN"): string {
    return (
      this.potionTypes.get(String(potionType)) ??
      (potionType === "none"
        ? text(locale, "console.potion_none")
        : term("potion", potionType, locale))
    );
  }
}

let defaultRegistry: TextLocalizationRegistry | null = null;

/** 获取默认翻译注册表实例。 */
export function getDefaultTextLocalizationRegistry(): TextLocalizationRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new TextLocalizationRegistry();
  }
  return defaultRegistry;
}
