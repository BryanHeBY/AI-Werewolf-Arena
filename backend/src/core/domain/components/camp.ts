import { text, term, type Locale } from "@ai-werewolf-arena/game-text";
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
export function createCampComponent(camp: Camp, locale: Locale = "zh-CN"): CampComponent {
  return {
    camp,
    renderPrompt(displayLocale: Locale = locale): string {
      return text(displayLocale, "component.camp", { camp: term("camp_team", this.camp, displayLocale) });
    },
  };
}
