import { term } from "@ai-werewolf-arena/game-text";
import { PhaseStageLocalizationContributor } from "../../shared/phase_stage_localization_registry";

export const WOLF_PHASE_STAGE_LOCALIZATION_CONTRIBUTOR: PhaseStageLocalizationContributor = {
  stageNames: {
    wolf_discussion: term("stage", "wolf_discussion", "zh-CN"),
    wolf_vote: term("stage", "wolf_vote", "zh-CN"),
  },
};
