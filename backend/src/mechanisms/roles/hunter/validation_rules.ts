import { Role } from "../../../domain/model";
import { ToolRuleMap, isAliveTarget } from "../../validation/contracts";

export const HUNTER_VALIDATION_RULES: ToolRuleMap = {
  shoot: ({ world, role, toolCall }) => {
    if (role.role !== Role.Hunter || !role.hunterState?.canShoot) {
      return "非法操作，当前不可开枪";
    }
    if (toolCall.name !== "shoot") {
      return "非法操作，工具不匹配";
    }
    if (!isAliveTarget(world, toolCall.args.target_id)) {
      return "非法操作，开枪目标必须存活";
    }
    return null;
  },
};

