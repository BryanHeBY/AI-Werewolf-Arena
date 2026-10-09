import { text, type Locale } from "@ai-werewolf-arena/game-text";
import { PromptRenderable } from "../model";

/**
 * 警徽组件：记录当前是否持有警徽以及是否已销毁。
 */
export interface BadgeComponent extends PromptRenderable {
  isSheriff: boolean;
  destroyed: boolean;
  /** Owned by the badge, so transfer retains the board's configured weight. */
  voteWeight: number;
  handoffPolicy?: import("../board").SheriffBadgePolicy;
}

/**
 * 创建警徽组件。
 */
export function createBadgeComponent(
  isSheriff: boolean = false,
  destroyed: boolean = false,
  locale: Locale = "zh-CN",
): BadgeComponent {
  return {
    isSheriff,
    destroyed,
    voteWeight: 1.5,
    renderPrompt(displayLocale: Locale = locale): string {
      if (this.destroyed) {
        return text(displayLocale, "component.badge_destroyed");
      }
      if (this.isSheriff) {
        return text(displayLocale, "component.badge_held", { weight: this.voteWeight });
      }
      return text(displayLocale, "component.badge_none");
    },
  };
}
