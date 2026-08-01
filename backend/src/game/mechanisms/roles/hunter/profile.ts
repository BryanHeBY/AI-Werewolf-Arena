/** 文件说明：猎人角色 profile。 */
import { Camp, Role } from "../../../../core/domain/model";
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
  skillBrief: "死亡时通常可开枪带走一名玩家；被毒死或成为最后一神时禁枪",
  goodSide: "god",
  init: (roleComp) => {
    setHunterState(roleComp, { canShoot: true });
  },
  renderPrompt: () => "你的底牌是【猎人】。死亡时通常可以开枪带走一名玩家；被女巫毒死或成为最后一名存活神职时不能开枪。",
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
