/**
 * 负责广播文本名词的可注册覆盖与语言回退。输入为角色／胜者／结束原因／瓶型贡献和查询语言；
 * 输出为最后注册字符串或原词典结果。String 转换保 caller 行为及部分写入；默认实例惰性缓存，
 * 自定义空串通过 nullish 规则保留，不据角色名推导真实阵营、重写事实或授予受众。
 */
import { roleName, term, text, type Locale } from "@ai-werewolf-arena/game-text";

/** 四类覆盖表按原类别／Object.entries顺序逐项安装；不是事件payload或身份权限的副本。 */
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
