import { Camp, PromptRenderable } from "../model";

/**
 * 阵营组件：记录玩家阵营信息。
 */
export interface CampComponent extends PromptRenderable {
  camp: Camp;
}

/**
 * 创建阵营组件。
 */
export function createCampComponent(camp: Camp): CampComponent {
  return {
    camp,
    renderPrompt(): string {
      if (camp === Camp.Wolf) {
        return "你属于【狼人阵营】。";
      }
      if (camp === Camp.ThirdParty) {
        return "你属于【第三方阵营】。";
      }
      return "你属于【好人阵营】。";
    },
  };
}
