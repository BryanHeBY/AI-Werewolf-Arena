import { PromptRenderable } from "../model";

/**
 * 警徽组件：记录当前是否持有警徽以及是否已销毁。
 */
export interface BadgeComponent extends PromptRenderable {
  isSheriff: boolean;
  destroyed: boolean;
}

/**
 * 创建警徽组件。
 */
export function createBadgeComponent(
  isSheriff: boolean = false,
  destroyed: boolean = false,
): BadgeComponent {
  return {
    isSheriff,
    destroyed,
    renderPrompt(): string {
      if (this.destroyed) {
        return "警徽已销毁。";
      }
      if (this.isSheriff) {
        return "你当前持有警徽，投票权重可提升至 1.5。";
      }
      return "你当前不持有警徽。";
    },
  };
}
