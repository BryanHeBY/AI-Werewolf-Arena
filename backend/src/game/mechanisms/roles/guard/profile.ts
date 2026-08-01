/** 文件说明：守卫角色 profile。 */
import { Camp, Role } from "../../../../core/domain/model";
import { RoleProfile } from "../contracts";
import { setGuardState } from "../private_state";
import { GUARD_LLM_REPAIR_PACK } from "./llm_repair";
import { GUARD_NIGHT_STAGES } from "./night_stages";
import { GUARD_TOOL_SPECS } from "./tool_specs";
import { GUARD_VALIDATION_RULES } from "./validation_rules";

/** 守卫角色配置。 */
export const GUARD_ROLE_PROFILE: RoleProfile = {
  role: Role.Guard,
  camp: Camp.Good,
  label: "守卫",
  skillBrief: "每晚可守护一名玩家，不可连续两晚守护同一人",
  goodSide: "god",
  init: (roleComp) => {
    setGuardState(roleComp, { lastTarget: null });
  },
  renderPrompt: () => "你的底牌是【守卫】。你每晚可以守护一名玩家，且不可连续同守。",
  toolSpecs: GUARD_TOOL_SPECS,
  validationRules: GUARD_VALIDATION_RULES,
  nightStages: GUARD_NIGHT_STAGES,
  llmRepair: GUARD_LLM_REPAIR_PACK,
  baselineAction: (_roleComp, request, pickAliveNotSelf) => {
    if (!request.allowedTools.includes("guard")) {
      return null;
    }
    const target = pickAliveNotSelf();
    if (target !== null) {
      return { name: "guard", args: { target_id: target, abstain: false } };
    }
    return { name: "guard", args: { target_id: null, abstain: true } };
  },
};
