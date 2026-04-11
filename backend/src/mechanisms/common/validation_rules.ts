/** 文件说明：定义通用工具的校验规则。 */
import { COMPONENT } from "../../domain/components/names";
import { VotingRightComponent } from "../../domain/components/voting_right";
import { ToolRuleMap, isAliveTarget } from "../validation/contracts";

/** 通用工具校验规则集合。 */
export const COMMON_VALIDATION_RULES: ToolRuleMap = {
  report_bug: ({ toolCall }) => {
    if (toolCall.name !== "report_bug") {
      return "非法操作，工具不匹配";
    }
    const { category, severity, message, evidence_event_seq } = toolCall.args;
    const categorySet = new Set(["flow", "rule", "state", "logging", "other"]);
    const severitySet = new Set(["low", "medium", "high", "critical"]);
    if (!categorySet.has(String(category))) {
      return "非法操作，report_bug.category 非法";
    }
    if (!severitySet.has(String(severity))) {
      return "非法操作，report_bug.severity 非法";
    }
    if (typeof message !== "string" || message.trim().length === 0) {
      return "非法操作，report_bug.message 不能为空";
    }
    if (message.length > 300) {
      return "非法操作，report_bug.message 长度不能超过 300";
    }
    if (evidence_event_seq !== undefined) {
      if (!Array.isArray(evidence_event_seq)) {
        return "非法操作，report_bug.evidence_event_seq 必须为数组";
      }
      if (evidence_event_seq.length > 20) {
        return "非法操作，report_bug.evidence_event_seq 最多 20 项";
      }
      for (const item of evidence_event_seq) {
        if (typeof item !== "number" || !Number.isFinite(item) || item <= 0) {
          return "非法操作，report_bug.evidence_event_seq 必须为正整数数组";
        }
      }
    }
    return null;
  },
  speak: () => null,
  vote: ({ world, actorId, toolCall }) => {
    if (toolCall.name !== "vote") {
      return "非法操作，工具不匹配";
    }
    const voting = world.getComponent<VotingRightComponent>(actorId, COMPONENT.VotingRight);
    if (!voting?.canVote) {
      return "非法操作，你当前无投票权";
    }
    if (toolCall.args.abstain) {
      return null;
    }
    if (toolCall.args.target_id === null) {
      return "非法操作，投票目标必须存活";
    }
    if (!isAliveTarget(world, toolCall.args.target_id)) {
      return "非法操作，投票目标必须存活";
    }
    return null;
  },
};
