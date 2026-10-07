import { RuleError } from "@ai-werewolf-arena/game-catalog";
/** 文件说明：定义通用工具的校验规则。 */
import { COMPONENT } from "../../../core/domain/components/names";
import { VotingRightComponent } from "../../../core/domain/components/voting_right";
import { ToolRuleMap, isAliveTarget } from "../validation/contracts";

/** 通用工具校验规则集合。 */
export const COMMON_VALIDATION_RULES: ToolRuleMap = {
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
  vote: ({ world, actorId, toolCall }) => {
    if (toolCall.name !== "vote") {
      return { code: RuleError.ToolMismatch };
    }
    const voting = world.getComponent<VotingRightComponent>(actorId, COMPONENT.VotingRight);
    if (!voting?.canVote) {
      return { code: RuleError.VoteRight };
    }
    if (toolCall.args.abstain) {
      return null;
    }
    if (toolCall.args.target_id === null) {
      return { code: RuleError.VoteTarget };
    }
    if (!isAliveTarget(world, toolCall.args.target_id)) {
      return { code: RuleError.VoteTarget };
    }
    return null;
  },
};
