import { roleName, text } from "@ai-werewolf-arena/game-text";
/** 文件说明：猎人角色 profile。 */
import { Camp, Role } from "../../../../core/domain/model";
import { RoleProfile } from "../contracts";
import { getHunterState, setHunterState } from "../private_state";
import { hunterDeathHook } from "./death_hook";
import { HUNTER_TOOL_SPECS } from "./tool_specs";
import { DEATH_SHOT_REPAIR, validateDeathShot } from "../death_shot";

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
    shoot: ctx => validateDeathShot(ctx, ctx.role.role === Role.Hunter && getHunterState(ctx.role)?.canShoot === true),
  },
  llmRepair: DEATH_SHOT_REPAIR,
  deathHook: hunterDeathHook,
  baselineAction: (_roleComp, request, pickAliveNotSelf) => {
    if (!request.allowedTools.includes("shoot")) {
      return null;
    }
    const target = pickAliveNotSelf();
    return { name: "shoot", args: { target_id: target } };
  },
};
