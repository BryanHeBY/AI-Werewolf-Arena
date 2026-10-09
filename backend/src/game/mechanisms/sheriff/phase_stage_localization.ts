import { term } from "@ai-werewolf-arena/game-text";
import { PhaseStageLocalizationContributor } from "../shared/phase_stage_localization_registry";

export const SHERIFF_PHASE_STAGE_LOCALIZATION_CONTRIBUTOR: PhaseStageLocalizationContributor = {
  stageNames: {
    sheriff_nomination: term("stage", "sheriff_nomination", "zh-CN"),
    sheriff_campaign_speech: term("stage", "sheriff_campaign_speech", "zh-CN"),
    sheriff_withdraw: term("stage", "sheriff_withdraw", "zh-CN"),
    sheriff_vote: term("stage", "sheriff_vote", "zh-CN"),
    sheriff_choose_direction: term("stage", "sheriff_choose_direction", "zh-CN"),
  },
};
