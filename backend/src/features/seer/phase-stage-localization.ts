/**
 * 负责贡献预言家阶段的名称。输入为共享语言词典；输出为原中文阶段名映射。
 * 只供展示注册表装配，不执行查验、创建请求或授予能力。
 */
import { term } from "@ai-werewolf-arena/game-text";
import { PhaseStageLocalizationContributor } from "../../agents/presentation/phase-stage-localization-registry";

export const SEER_PHASE_STAGE_LOCALIZATION_CONTRIBUTOR: PhaseStageLocalizationContributor = {
  stageNames: {
    seer: term("stage", "seer", "zh-CN"),
  },
};
