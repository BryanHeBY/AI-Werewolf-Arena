import { RuleError } from "@ai-werewolf-arena/game-catalog";
import { roleName, text } from "@ai-werewolf-arena/game-text";
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
  label: roleName("hunter"),
  skillBrief: text("zh-CN", "role.hunter.brief"),
  goodSide: "god",
  init: (roleComp) => {
    setHunterState(roleComp, { canShoot: true });
  },
  renderPrompt: (_roleComp, locale = "zh-CN") => text(locale, "role.hunter.state"),
  toolSpecs: HUNTER_TOOL_SPECS,
  validationRules: {
    shoot: ({ world, role, toolCall }) => {
      if (role.role !== Role.Hunter || !getHunterState(role)?.canShoot) return { code: RuleError.ShootUnavailable };
      if (toolCall.name !== "shoot") return { code: RuleError.ToolMismatch };
      if (!isAliveTarget(world, toolCall.args.target_id)) return { code: RuleError.ShootTarget };
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
