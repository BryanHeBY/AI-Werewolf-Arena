/** 文件说明：预言家工具校验规则。 */
import { Role } from "../../../../core/domain/model";
import { ToolRuleMap, isAliveTarget } from "../../validation/contracts";

/** 预言家工具校验规则集合。 */
export const SEER_VALIDATION_RULES: ToolRuleMap = {
  check_identity: ({ world, role, toolCall }) => {
    if (role.role !== Role.Seer) {
      return "非法操作，仅预言家可查验";
    }
    if (toolCall.name !== "check_identity") {
      return "非法操作，工具不匹配";
    }
    if (!isAliveTarget(world, toolCall.args.target_id)) {
      return "非法操作，查验目标必须存活";
    }
    return null;
  },
};
