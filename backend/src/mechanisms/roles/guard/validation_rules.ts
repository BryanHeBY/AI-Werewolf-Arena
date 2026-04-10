import { Role } from "../../../domain/model";
import { ToolRuleMap, isAliveTarget } from "../../validation/contracts";
import { getGuardState } from "../private_state";

export const GUARD_VALIDATION_RULES: ToolRuleMap = {
  guard: ({ world, role, toolCall }) => {
    const guardState = getGuardState(role);
    if (role.role !== Role.Guard) {
      return "非法操作，仅守卫可守护";
    }
    if (toolCall.name !== "guard") {
      return "非法操作，工具不匹配";
    }
    if (toolCall.args.abstain) {
      return null;
    }
    if (toolCall.args.target_id === null) {
      return "非法操作，守护目标必须存活";
    }
    if (guardState?.lastTarget === toolCall.args.target_id) {
      return "非法操作，守卫不可连续两晚守同一人";
    }
    if (!isAliveTarget(world, toolCall.args.target_id)) {
      return "非法操作，守护目标必须存活";
    }
    return null;
  },
};
