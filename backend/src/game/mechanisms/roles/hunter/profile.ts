/** 文件说明：猎人角色 profile。 */
import { Camp, Role } from "../../../../domain/model";
import { RoleProfile } from "../contracts";
import { setHunterState } from "../private_state";
import { hunterDeathHook } from "./death_hook";
import { HUNTER_LLM_REPAIR_PACK } from "./llm_repair";
import { HUNTER_TOOL_SPECS } from "./tool_specs";
import { HUNTER_VALIDATION_RULES } from "./validation_rules";

/** 猎人角色配置。 */
export const HUNTER_ROLE_PROFILE: RoleProfile = {
  role: Role.Hunter,
  camp: Camp.Good,
  label: "猎人",
  skillBrief: "满足条件时可开枪带走一名玩家",
  goodSide: "god",
  init: (roleComp) => {
    setHunterState(roleComp, { canShoot: true });
  },
  renderPrompt: () => "你的底牌是【猎人】。满足条件时你可以开枪带走一名玩家。",
  toolSpecs: HUNTER_TOOL_SPECS,
  validationRules: HUNTER_VALIDATION_RULES,
  llmRepair: HUNTER_LLM_REPAIR_PACK,
  deathHook: hunterDeathHook,
  baselineAction: (_roleComp, request, pickAliveNotSelf) => {
    if (!request.allowedTools.includes("shoot")) {
      return null;
    }
    const target = pickAliveNotSelf();
    return target !== null ? { name: "shoot", args: { target_id: target } } : null;
  },
};
