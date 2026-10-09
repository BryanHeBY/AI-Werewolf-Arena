import { term, type Locale } from "@ai-werewolf-arena/game-text";
/** 文件说明：行动提示中 phase/stage 的可注册翻译注册表。 */
import { GUARD_PHASE_STAGE_LOCALIZATION_CONTRIBUTOR } from "../roles/guard/phase_stage_localization";
import { HUNTER_PHASE_STAGE_LOCALIZATION_CONTRIBUTOR } from "../roles/hunter/phase_stage_localization";
import { SEER_PHASE_STAGE_LOCALIZATION_CONTRIBUTOR } from "../roles/seer/phase_stage_localization";
import { WITCH_PHASE_STAGE_LOCALIZATION_CONTRIBUTOR } from "../roles/witch/phase_stage_localization";
import { WOLF_PHASE_STAGE_LOCALIZATION_CONTRIBUTOR } from "../roles/wolf/phase_stage_localization";
import { SHERIFF_PHASE_STAGE_LOCALIZATION_CONTRIBUTOR } from "../sheriff/phase_stage_localization";

export interface PhaseStageLocalizationContributor {
  phaseNames?: Record<string, string>;
  stageNames?: Record<string, string>;
}

/** 阶段翻译注册表。 */
export class PhaseStageLocalizationRegistry {
  private readonly phaseNames = new Map<string, string>();
  private readonly stageNames = new Map<string, string>();

  constructor(contributors: PhaseStageLocalizationContributor[] = []) {
    for (const contributor of contributors) {
      this.register(contributor);
    }
  }

  register(contributor: PhaseStageLocalizationContributor): void {
    for (const [key, value] of Object.entries(contributor.phaseNames ?? {})) {
      this.phaseNames.set(String(key), String(value));
    }
    for (const [key, value] of Object.entries(contributor.stageNames ?? {})) {
      this.stageNames.set(String(key), String(value));
    }
  }

  phaseName(phase: string, locale: Locale = "zh-CN"): string {
    const value = this.phaseNames.get(String(phase));
    return value && value !== term("phase", phase, "zh-CN") ? value : term("phase", phase, locale);
  }

  stageName(stage: string, locale: Locale = "zh-CN"): string {
    const value = this.stageNames.get(String(stage));
    return value && value !== term("stage", stage, "zh-CN") ? value : term("stage", stage, locale);
  }
}

export const CORE_PHASE_STAGE_LOCALIZATION_CONTRIBUTOR: PhaseStageLocalizationContributor = {
  phaseNames: {
    night: term("phase", "night", "zh-CN"),
    day: term("phase", "day", "zh-CN"),
    voting: term("phase", "voting", "zh-CN"),
    game_over: term("phase", "game_over", "zh-CN"),
  },
  stageNames: {
    night: term("stage", "night", "zh-CN"),
    day: term("stage", "day", "zh-CN"),
    voting: term("stage", "voting", "zh-CN"),
    exile_pk_speech: term("stage", "exile_pk_speech", "zh-CN"),
    exile_pk_vote: term("stage", "exile_pk_vote", "zh-CN"),
    game_over: term("stage", "game_over", "zh-CN"),
    day_speech: term("stage", "day_speech", "zh-CN"),
    death_shot: term("stage", "death_shot", "zh-CN"),
    before_speeches: term("stage", "before_speeches", "zh-CN"),
    between_speeches: term("stage", "between_speeches", "zh-CN"),
    after_speeches: term("stage", "after_speeches", "zh-CN"),
    on_daybreak: term("stage", "on_daybreak", "zh-CN"),
    on_pre_election: term("stage", "on_pre_election", "zh-CN"),
    on_pre_vote: term("stage", "on_pre_vote", "zh-CN"),
    on_per_speech_gap: term("stage", "on_per_speech_gap", "zh-CN"),
  },
};

let defaultRegistry: PhaseStageLocalizationRegistry | null = null;

/** 获取默认阶段翻译注册表实例。 */
export function getDefaultPhaseStageLocalizationRegistry(): PhaseStageLocalizationRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new PhaseStageLocalizationRegistry([
      CORE_PHASE_STAGE_LOCALIZATION_CONTRIBUTOR,
      SHERIFF_PHASE_STAGE_LOCALIZATION_CONTRIBUTOR,
      WOLF_PHASE_STAGE_LOCALIZATION_CONTRIBUTOR,
      SEER_PHASE_STAGE_LOCALIZATION_CONTRIBUTOR,
      GUARD_PHASE_STAGE_LOCALIZATION_CONTRIBUTOR,
      WITCH_PHASE_STAGE_LOCALIZATION_CONTRIBUTOR,
      HUNTER_PHASE_STAGE_LOCALIZATION_CONTRIBUTOR,
    ]);
  }
  return defaultRegistry;
}
