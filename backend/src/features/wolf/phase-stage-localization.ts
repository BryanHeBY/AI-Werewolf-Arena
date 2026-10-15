/**
 * 负责贡献狼聊与刀票阶段名称。输入为共享语言词典；输出为原中文阶段名映射。
 * 只供展示注册表装配，不开狼聊、不计刀票或授予狼队知识。
 */
import { term } from "@ai-werewolf-arena/game-text";
import { PhaseStageLocalizationContributor } from "../../agents/presentation/phase-stage-localization-registry";

export const WOLF_PHASE_STAGE_LOCALIZATION_CONTRIBUTOR: PhaseStageLocalizationContributor = {
  stageNames: {
    wolf_discussion: term("stage", "wolf_discussion", "zh-CN"),
    wolf_vote: term("stage", "wolf_vote", "zh-CN"),
  },
};
