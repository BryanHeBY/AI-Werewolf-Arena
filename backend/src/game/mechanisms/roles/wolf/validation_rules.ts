import { RuleError } from "@ai-werewolf-arena/game-catalog";
/** 文件说明：狼人工具校验规则。 */
import { ActionWindow, Phase, Role } from "../../../../core/domain/model";
import { ToolRuleMap, isAliveTarget } from "../../validation/contracts";

/** 狼人工具校验规则集合。 */
export const WOLF_VALIDATION_RULES: ToolRuleMap = {
  speak_to_wolves: ({ role }) => {
    if (role.role !== Role.Wolf) {
      return { code: RuleError.WolfOnly };
    }
    return null;
  },
  kill_vote: ({ world, role, toolCall }) => {
    if (role.role !== Role.Wolf) {
      return { code: RuleError.WolfOnly };
    }
    if (toolCall.name !== "kill_vote") {
      return { code: RuleError.ToolMismatch };
    }
    if (toolCall.args.abstain) {
      return null;
    }
    if (
      toolCall.args.target_id === null ||
      !isAliveTarget(world, toolCall.args.target_id)
    ) {
      return { code: RuleError.KillTarget };
    }
    return null;
  },
  self_destruct: ({ role, phase, actionWindow, allowSelfDestruct, toolCall }) => {
    if (role.role !== Role.Wolf) {
      return { code: RuleError.WolfBlastOnly };
    }
    if (phase !== Phase.Day && phase !== Phase.Voting) {
      return { code: RuleError.BlastPhase };
    }
    if (actionWindow !== ActionWindow.OnPreVote) {
      return { code: RuleError.BlastWindow };
    }
    if (!allowSelfDestruct) {
      return { code: RuleError.BlastDisabled };
    }
    if (toolCall.name !== "self_destruct" || toolCall.args.confirm !== true) {
      return { code: RuleError.BlastConfirm };
    }
    return null;
  },
};
