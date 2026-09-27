/** 文件说明：守卫角色 profile。 */
import { Camp, Role } from "../../../../core/domain/model";
import { RoleProfile } from "../contracts";
import { getGuardState, setGuardState } from "../private_state";
import { numberOrNull } from "../../llm/helpers";
import { GUARD_NIGHT_STAGES } from "./night_stages";
import { GUARD_TOOL_SPECS } from "./tool_specs";
import { isAliveTarget } from "../../validation/contracts";

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
  validationRules: {
    guard: ({ world, role, toolCall }) => {
      const guardState = getGuardState(role);
      if (role.role !== Role.Guard) return "非法操作，仅守卫可守护";
      if (toolCall.name !== "guard") return "非法操作，工具不匹配";
      if (toolCall.args.abstain) return null;
      if (toolCall.args.target_id === null) return "非法操作，守护目标必须存活";
      if (guardState?.lastTarget === toolCall.args.target_id) return "非法操作，守卫不可连续两晚守同一人";
      if (!isAliveTarget(world, toolCall.args.target_id)) return "非法操作，守护目标必须存活";
      return null;
    },
  },
  nightStages: GUARD_NIGHT_STAGES,
  llmRepair: {
    coerce: {
      guard: (args) => {
        const abstain = Boolean(args.abstain);
        if (abstain) return { target_id: null, abstain: true };
        const target = numberOrNull(args.target_id);
        return target === null ? null : { target_id: target, abstain: false };
      },
    },
  },
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
