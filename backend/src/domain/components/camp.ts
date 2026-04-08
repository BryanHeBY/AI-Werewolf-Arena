import { Camp, PromptRenderable } from "../model";

export interface CampComponent extends PromptRenderable {
  camp: Camp;
}

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
