/**
 * 负责贡献警徽选择、竞选、PK、投票与方向阶段名称。输入为共享语言词典；
 * 输出为原中文阶段名映射。只供展示注册表装配，不开选举、决定 PK 或分派行动权限。
 */
import { term } from "@ai-werewolf-arena/game-text";
import { PhaseStageLocalizationContributor } from "../shared/phase_stage_localization_registry";

export const SHERIFF_PHASE_STAGE_LOCALIZATION_CONTRIBUTOR: PhaseStageLocalizationContributor = {
  stageNames: {
    sheriff_badge_choice: term("stage", "sheriff_badge_choice", "zh-CN"),
    sheriff_nomination: term("stage", "sheriff_nomination", "zh-CN"),
    sheriff_campaign_speech: term("stage", "sheriff_campaign_speech", "zh-CN"),
    sheriff_withdraw: term("stage", "sheriff_withdraw", "zh-CN"),
    sheriff_pk_speech: term("stage", "sheriff_pk_speech", "zh-CN"),
    sheriff_pk_vote: term("stage", "sheriff_pk_vote", "zh-CN"),
    sheriff_vote: term("stage", "sheriff_vote", "zh-CN"),
    sheriff_choose_direction: term("stage", "sheriff_choose_direction", "zh-CN"),
  },
};
