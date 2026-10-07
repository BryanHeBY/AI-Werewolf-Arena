import { text, type Locale } from "@ai-werewolf-arena/game-text";
import { PromptRenderable } from "../model";

/**
 * 存活状态组件：标记玩家是否仍在场。
 */
export interface AliveComponent extends PromptRenderable {
  alive: boolean;
}

/**
 * 创建存活状态组件。
 */
export function createAliveComponent(alive: boolean = true, locale: Locale = "zh-CN"): AliveComponent {
  return {
    alive,
    renderPrompt(displayLocale: Locale = locale): string {
      return text(displayLocale, this.alive ? "component.alive" : "component.dead");
    },
  };
}
