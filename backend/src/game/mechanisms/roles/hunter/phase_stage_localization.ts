/**
 * 负责贡献猎人开枪阶段的名称。输入为共享语言词典；输出为原中文阶段名映射。
 * 只供展示注册表装配，不开死亡窗口、创建请求或授予枪权。
 */
import { term } from "@ai-werewolf-arena/game-text";
import { PhaseStageLocalizationContributor } from "../../shared/phase_stage_localization_registry";

export const HUNTER_PHASE_STAGE_LOCALIZATION_CONTRIBUTOR: PhaseStageLocalizationContributor = {
  stageNames: {
    hunter_shot: term("stage", "hunter_shot", "zh-CN"),
  },
};
