/**
 * 负责阶段名称贡献的顺序注册与语言查询。输入为 phaseNames／stageNames 及语言；
 * 输出为最后注册的字符串覆盖或词典回退。注册时 String 转换可能执行 caller 方法／抛错，前面写入不回滚。
 * 默认实例惰性创建，内建中文值在查询时可回退目标语言；这里只翻译阶段，不调度阶段或修改请求许可。
 */
import { term, type Locale } from "@ai-werewolf-arena/game-text";
/** 文件说明：行动提示中 phase/stage 的可注册翻译注册表。 */
import { GUARD_PHASE_STAGE_LOCALIZATION_CONTRIBUTOR } from "../../features/guard/phase-stage-localization";
import { HUNTER_PHASE_STAGE_LOCALIZATION_CONTRIBUTOR } from "../../features/hunter/phase-stage-localization";
import { SEER_PHASE_STAGE_LOCALIZATION_CONTRIBUTOR } from "../../features/seer/phase-stage-localization";
import { WITCH_PHASE_STAGE_LOCALIZATION_CONTRIBUTOR } from "../../features/witch/phase-stage-localization";
import { WOLF_PHASE_STAGE_LOCALIZATION_CONTRIBUTOR } from "../../features/wolf/phase-stage-localization";
import { SHERIFF_PHASE_STAGE_LOCALIZATION_CONTRIBUTOR } from "../../features/sheriff/phase-stage-localization";

/** 贡献值注册时转成字符串并存Map；同名后写覆盖，字段可选不改变原遍历顺序。 */
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

  /** 自定义非空且不同于内建中文词时优先；空串／内建中文值沿原词典按locale回退。 */
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
