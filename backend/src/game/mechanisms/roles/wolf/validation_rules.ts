/**
 * 负责狼聊、狼刀及自爆的校验贡献。输入为可信演员权限、阶段／窗口和提交工具，输出为原首个规则拒绝或预检通过。
 * 原 pass 检查之后才读取公开的只读狼刀候选；校验不消费库存、不制造狼刀或提交效果。
 */
import { canRoleSelfDestruct } from "../self_destruct_capability";
import { bindWolfKnifeTargetQuery } from "./ports";
import {
  weddingMember,
  weddingSetup,
  ghostBrideReady,
  canSubmitWeddingTool,
} from "../ghost_bride/authority";
import { RuleError } from "@ai-werewolf-arena/game-contract";
/** 文件说明：狼人工具校验规则。 */
import { ActionWindow, Phase } from "../../../../core/domain/model";
import { ToolRuleMap } from "../../validation/contracts";
import { wolfTeamPermissions } from "../wolf_team";

/** 狼人工具校验规则集合。 */
export const WOLF_VALIDATION_RULES: ToolRuleMap = {
  speak_to_wolves: ({ world, role, roleCatalog, phase }) => {
    if (!wolfTeamPermissions(role, roleCatalog, world).canChat) {
      return { code: RuleError.WolfChatPermission };
    }
    if (phase !== Phase.Night) return { code: RuleError.WolfChatPhase };
    return null;
  },
  kill_vote: ({ world, actorId, day, ghostBrideScope, role, roleCatalog, toolCall, phase }) => {
    if (weddingSetup(world))
      return canSubmitWeddingTool(world, actorId, phase, day ?? 0, ghostBrideScope, toolCall)
        ? null
        : { code: RuleError.GhostBrideUnavailable };
    if (!wolfTeamPermissions(role, roleCatalog, world).canVoteForKill) {
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
      !bindWolfKnifeTargetQuery(world).allows(toolCall.args.target_id)
    ) {
      return { code: RuleError.KillTarget };
    }
    return null;
  },
  self_destruct: ({
    world,
    role,
    roleCatalog,
    phase,
    actionWindow,
    allowSelfDestruct,
    toolCall,
  }) => {
    if (weddingSetup(world) && (!ghostBrideReady(world) || weddingMember(world, role)))
      return { code: RuleError.WolfBlastOnly };
    if (!canRoleSelfDestruct(role, roleCatalog)) {
      return { code: RuleError.WolfBlastOnly };
    }
    if (phase !== Phase.Day && phase !== Phase.Voting) {
      return { code: RuleError.BlastPhase };
    }
    if (actionWindow === undefined || !Object.values(ActionWindow).includes(actionWindow)) {
      return { code: RuleError.BlastWindow };
    }
    if (phase !== (actionWindow === ActionWindow.OnPreVote ? Phase.Voting : Phase.Day))
      return { code: RuleError.BlastPhase };
    if (!allowSelfDestruct) {
      return { code: RuleError.BlastDisabled };
    }
    if (toolCall.name !== "self_destruct" || toolCall.args.confirm !== true) {
      return { code: RuleError.BlastConfirm };
    }
    return null;
  },
};
