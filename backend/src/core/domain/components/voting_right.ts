import { text, type Locale } from "@ai-werewolf-arena/game-text";
import { PromptRenderable } from "../model";

/**
 * 投票权组件：记录是否可投票与票重。
 */
export interface VotingRightComponent extends PromptRenderable {
  weight: number;
  canVote: boolean;
}

/**
 * 创建投票权组件。
 */
export function createVotingRightComponent(
  weight: number = 1,
  canVote: boolean = true,
  locale: Locale = "zh-CN",
): VotingRightComponent {
  return {
    weight,
    canVote,
    renderPrompt(displayLocale: Locale = locale): string {
      if (!this.canVote) {
        return text(displayLocale, "component.vote_none");
      }
      return text(displayLocale, "component.vote_weight", { weight: this.weight });
    },
  };
}
