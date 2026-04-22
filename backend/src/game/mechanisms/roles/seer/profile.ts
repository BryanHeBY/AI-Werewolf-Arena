/** 文件说明：预言家角色 profile。 */
import { Camp, Role } from "../../../../core/domain/model";
import { RoleProfile } from "../contracts";
import { getSeerState, setSeerState } from "../private_state";
import { SEER_LLM_REPAIR_PACK } from "./llm_repair";
import { SEER_NIGHT_STAGES } from "./night_stages";
import { SEER_TOOL_SPECS } from "./tool_specs";
import { SEER_VALIDATION_RULES } from "./validation_rules";

/** 预言家角色配置。 */
export const SEER_ROLE_PROFILE: RoleProfile = {
  role: Role.Seer,
  camp: Camp.Good,
  label: "预言家",
  skillBrief: "每晚可查验一名玩家阵营",
  goodSide: "god",
  init: (roleComp) => {
    setSeerState(roleComp, {
      lastTarget: null,
      lastIsWerewolf: null,
      history: [],
    });
  },
  renderPrompt: (roleComp) => {
    const seerState = getSeerState(roleComp);
    const latest =
      seerState &&
      seerState.lastTarget !== null &&
      seerState.lastIsWerewolf !== null
        ? ` 你上一条查验结果：${seerState.lastTarget}号是${seerState.lastIsWerewolf ? "狼人" : "好人"}。`
        : "";
    return `你的底牌是【预言家】。你每晚可以查验一名玩家阵营。${latest}`;
  },
  toolSpecs: SEER_TOOL_SPECS,
  validationRules: SEER_VALIDATION_RULES,
  nightStages: SEER_NIGHT_STAGES,
  llmRepair: SEER_LLM_REPAIR_PACK,
  baselineAction: (_roleComp, request, pickAliveNotSelf) => {
    if (!request.allowedTools.includes("check_identity")) {
      return null;
    }
    const target = pickAliveNotSelf();
    return target !== null ? { name: "check_identity", args: { target_id: target } } : null;
  },
};
