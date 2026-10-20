/**
 * 负责贡献女巫阶段的名称。输入为共享语言词典；输出为原中文阶段名映射。
 * 只供展示注册表装配，不开启用药回合、读取瓶量或授予用药许可。
 */
import { term } from "@ai-werewolf-arena/game-text";
import { PhaseStageLocalizationContributor } from "../../agents/presentation/phase-stage-localization-registry";

export const WITCH_PHASE_STAGE_LOCALIZATION_CONTRIBUTOR: PhaseStageLocalizationContributor = {
  stageNames: {
    witch: term("stage", "witch", "zh-CN"),
  },
};
