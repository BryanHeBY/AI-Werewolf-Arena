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
): VotingRightComponent {
  return {
    weight,
    canVote,
    renderPrompt(): string {
      if (!this.canVote) {
        return "你当前没有投票权。";
      }
      return `你的投票权重为 ${this.weight}。`;
    },
  };
}
