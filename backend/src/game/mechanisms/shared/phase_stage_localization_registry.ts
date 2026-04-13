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

  phaseName(phase: string): string {
    return this.phaseNames.get(String(phase)) ?? String(phase);
  }

  stageName(stage: string): string {
    return this.stageNames.get(String(stage)) ?? String(stage);
  }
}

export const CORE_PHASE_STAGE_LOCALIZATION_CONTRIBUTOR: PhaseStageLocalizationContributor = {
  phaseNames: {
    night: "夜晚",
    day: "白天",
    voting: "投票",
    game_over: "终局",
  },
  stageNames: {
    night: "夜晚",
    day: "白天",
    voting: "放逐投票",
    game_over: "终局",
    day_speech: "白天发言",
    on_daybreak: "天亮后窗口",
    on_pre_election: "警长流程前窗口",
    on_pre_vote: "放逐前窗口",
    on_per_speech_gap: "发言间隔窗口",
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
