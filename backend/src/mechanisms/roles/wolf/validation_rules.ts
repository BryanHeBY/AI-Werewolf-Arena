import { Phase, Role } from "../../../domain/model";
import { ToolRuleMap, isAliveTarget } from "../../validation/contracts";

export const WOLF_VALIDATION_RULES: ToolRuleMap = {
  speak_to_wolves: ({ role }) => {
    if (role.role !== Role.Wolf) {
      return "非法操作，仅狼人可执行该动作";
    }
    return null;
  },
  kill_vote: ({ world, role, toolCall }) => {
    if (role.role !== Role.Wolf) {
      return "非法操作，仅狼人可执行该动作";
    }
    if (toolCall.name !== "kill_vote") {
      return "非法操作，工具不匹配";
    }
    if (toolCall.args.abstain) {
      return null;
    }
    if (
      toolCall.args.target_id === null ||
      !isAliveTarget(world, toolCall.args.target_id)
    ) {
      return "非法操作，刀人目标必须存活";
    }
    return null;
  },
  self_destruct: ({ role, phase, allowSelfDestruct }) => {
    if (role.role !== Role.Wolf) {
      return "非法操作，仅狼人可自爆";
    }
    if (phase !== Phase.Day && phase !== Phase.Voting) {
      return "非法操作，自爆仅可在白天阶段触发";
    }
    if (!allowSelfDestruct) {
      return "非法操作，当前窗口不允许自爆";
    }
    return null;
  },
};

