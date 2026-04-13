/** 文件说明：猎人工具校验规则。 */
import { Role } from "../../../../domain/model";
import { ToolRuleMap, isAliveTarget } from "../../validation/contracts";
import { getHunterState } from "../private_state";

/** 猎人工具校验规则集合。 */
export const HUNTER_VALIDATION_RULES: ToolRuleMap = {
  shoot: ({ world, role, toolCall }) => {
    if (role.role !== Role.Hunter || !getHunterState(role)?.canShoot) {
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
