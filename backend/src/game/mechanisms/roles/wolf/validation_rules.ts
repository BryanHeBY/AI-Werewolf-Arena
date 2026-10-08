import { RuleError } from "@ai-werewolf-arena/game-catalog";
/** 文件说明：狼人工具校验规则。 */
import { ActionWindow, Phase, Role } from "../../../../core/domain/model";
import { ToolRuleMap, isAliveTarget } from "../../validation/contracts";
import { wolfTeamPermissions } from "../wolf_team";

/** 狼人工具校验规则集合。 */
export const WOLF_VALIDATION_RULES: ToolRuleMap = {
  speak_to_wolves: ({ role, roleCatalog, phase }) => {
    if (!wolfTeamPermissions(role, roleCatalog).canChat) {
      return { code: RuleError.WolfChatPermission };
    }
    if (phase !== Phase.Night) return { code: RuleError.WolfChatPhase };
    return null;
  },
  kill_vote: ({ world, role, roleCatalog, toolCall, phase }) => {
    if (!wolfTeamPermissions(role, roleCatalog).canVoteForKill) {
      return { code: RuleError.WolfKillPermission };
    }
    if (phase !== Phase.Night) return { code: RuleError.WolfKillPhase };
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
    if (actionWindow === undefined || !Object.values(ActionWindow).includes(actionWindow)) {
      return { code: RuleError.BlastWindow };
    }
    if (phase !== (actionWindow === ActionWindow.OnPreVote ? Phase.Voting : Phase.Day)) return { code: RuleError.BlastPhase };
    if (!allowSelfDestruct) {
      return { code: RuleError.BlastDisabled };
    }
    if (toolCall.name !== "self_destruct" || toolCall.args.confirm !== true) {
      return { code: RuleError.BlastConfirm };
    }
    return null;
  },
};
