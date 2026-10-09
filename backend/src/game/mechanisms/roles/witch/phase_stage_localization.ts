import { term } from "@ai-werewolf-arena/game-text";
import { PhaseStageLocalizationContributor } from "../../shared/phase_stage_localization_registry";

export const WITCH_PHASE_STAGE_LOCALIZATION_CONTRIBUTOR: PhaseStageLocalizationContributor = {
  stageNames: {
    witch: term("stage", "witch", "zh-CN"),
  },
};
