import { PromptRenderable } from "../model";

export interface VotingRightComponent extends PromptRenderable {
  weight: number;
  canVote: boolean;
}

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
