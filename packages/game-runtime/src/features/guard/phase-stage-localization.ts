/**
 * 负责贡献守卫阶段的名称。输入为共享语言词典；输出为原中文阶段名映射。
 * 此对象只供阶段展示注册表装配，不推进守卫阶段、创建请求或授予技能。
 */
import { term } from "@ai-werewolf-arena/game-text";
import { PhaseStageLocalizationContributor } from "../../agents/presentation/phase-stage-localization-registry";

export const GUARD_PHASE_STAGE_LOCALIZATION_CONTRIBUTOR: PhaseStageLocalizationContributor = {
  stageNames: {
    guard: term("stage", "guard", "zh-CN"),
  },
};
