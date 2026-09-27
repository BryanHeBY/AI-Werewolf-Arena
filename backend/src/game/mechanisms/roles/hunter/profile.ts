/** 文件说明：猎人角色 profile。 */
import { Camp, Role } from "../../../../core/domain/model";
import { RoleProfile } from "../contracts";
import { getHunterState, setHunterState } from "../private_state";
import { hunterDeathHook } from "./death_hook";
import { numberOrNull } from "../../llm/helpers";
import { HUNTER_TOOL_SPECS } from "./tool_specs";
import { isAliveTarget } from "../../validation/contracts";

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
  validationRules: {
    shoot: ({ world, role, toolCall }) => {
      if (role.role !== Role.Hunter || !getHunterState(role)?.canShoot) return "非法操作，当前不可开枪";
      if (toolCall.name !== "shoot") return "非法操作，工具不匹配";
      if (!isAliveTarget(world, toolCall.args.target_id)) return "非法操作，开枪目标必须存活";
      return null;
    },
  },
  llmRepair: {
    coerce: {
      shoot: (args) => {
        const target = numberOrNull(args.target_id);
        return target === null ? null : { target_id: target };
      },
    },
  },
  deathHook: hunterDeathHook,
  baselineAction: (_roleComp, request, pickAliveNotSelf) => {
    if (!request.allowedTools.includes("shoot")) {
      return null;
    }
    const target = pickAliveNotSelf();
    return target !== null ? { name: "shoot", args: { target_id: target } } : null;
  },
};
