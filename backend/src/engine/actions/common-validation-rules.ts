/**
 * 提供通用工具的原校验集合：匿名墙检查作者／窗口，辩论检查参与者／阶段，放逐票检查票权与候选。输入为网关上下文和工具参数；返回既有 RuleError 或 null，不在校验中提交资源或阶段。
 */
import { readWallTool } from "@ai-werewolf-arena/game-contract/facts/wall-notes";
import { authorizedWallAuthor } from "../../features/wall-notes/author-ports";
import { prohibitsLoversVote } from "../../features/cupid/vote-ports";
import { RuleError } from "@ai-werewolf-arena/game-contract";
/** 文件说明：定义通用工具的校验规则。 */
import { ToolRuleMap } from "./validation-contracts";
import { debateAuthority } from "../../features/debater/vote-ports";
import { sameOriginalParticipant as sameDebateParticipant } from "../../domain/original-participant";
import { Phase } from "../../domain";
import { canBeExiled, canVoteExile } from "../participation";

/** 通用工具校验规则集合。 */
export const COMMON_VALIDATION_RULES: ToolRuleMap = {
  write_note: ({ world, actorId, day, phase, toolCall, wallScope, wallId, itemInstanceId }) => {
    if (
      day !== 1 ||
      phase !== Phase.Voting ||
      !authorizedWallAuthor(world, actorId, wallId, itemInstanceId, wallScope)
    )
      return { code: RuleError.WallNoteUnavailable };
    return readWallTool(toolCall) ? null : { code: RuleError.WallNoteText };
  },
  debate_vote: ({ world, actorId, day, phase, toolCall, debateId }) => {
    const a = debateAuthority(world, debateId),
      actor = a?.participants.get(actorId);
    if (toolCall.name !== "debate_vote") return { code: RuleError.ToolMismatch };
    if (
      !a ||
      !actor ||
      a.stage !== "ballot" ||
      a.day !== day ||
      phase !== Phase.Day ||
      !sameDebateParticipant(world, actor)
    )
      return { code: RuleError.DebateUnavailable };
    if (
      toolCall.args.support !== true &&
      toolCall.args.support !== false &&
      toolCall.args.support !== null
    )
      return { code: RuleError.DebateBallot };
    return null;
  },
  report_bug: ({ toolCall }) => {
    if (toolCall.name !== "report_bug") {
      return { code: RuleError.ToolMismatch };
    }
    const { category, severity, message } = toolCall.args;
    const categorySet = new Set(["flow", "rule", "state", "logging", "other"]);
    const severitySet = new Set(["low", "medium", "high", "critical"]);
    if (!categorySet.has(String(category))) {
      return { code: RuleError.ReportCategory };
    }
    if (!severitySet.has(String(severity))) {
      return { code: RuleError.ReportSeverity };
    }
    if (typeof message !== "string" || message.trim().length === 0) {
      return { code: RuleError.ReportMessageEmpty };
    }
    if (message.length > 300) {
      return { code: RuleError.ReportMessageLong };
    }
    return null;
  },
  speak: () => null,
  vote: ({ world, actorId, day, toolCall, roleCatalog, exileCandidates }) => {
    if (toolCall.name !== "vote") {
      return { code: RuleError.ToolMismatch };
    }
    if (exileCandidates?.includes(actorId)) return { code: RuleError.PkVoteEligibility };
    if (
      !toolCall.args.abstain &&
      exileCandidates &&
      !exileCandidates.includes(toolCall.args.target_id!)
    )
      return { code: RuleError.PkVoteTarget };
    if (!canVoteExile(world, actorId, day, roleCatalog)) {
      return { code: RuleError.VoteRight };
    }
    if (toolCall.args.abstain) {
      return null;
    }
    if (toolCall.args.target_id === null) {
      return { code: RuleError.VoteTarget };
    }
    if (prohibitsLoversVote(world, actorId, toolCall.args.target_id))
      return { code: RuleError.LoversVote };
    if (!canBeExiled(world, toolCall.args.target_id, roleCatalog)) {
      return { code: RuleError.VoteTarget };
    }
    return null;
  },
};
