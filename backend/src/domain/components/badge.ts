import { PromptRenderable } from "../model";

export interface BadgeComponent extends PromptRenderable {
  isSheriff: boolean;
  destroyed: boolean;
}

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
