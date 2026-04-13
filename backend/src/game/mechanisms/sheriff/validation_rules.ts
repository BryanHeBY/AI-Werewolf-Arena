/** 文件说明：警长机制工具校验规则。 */
import { Phase } from "../../../domain/model";
import { COMPONENT } from "../../../domain/components/names";
import { ToolRuleMap } from "../validation/contracts";

/** 警长机制工具校验规则集合。 */
export const SHERIFF_VALIDATION_RULES: ToolRuleMap = {
  run_for_sheriff: ({ phase, toolCall }) => {
    if (phase !== Phase.Day) {
      return "非法操作，仅白天可报名上警";
    }
    const args = toolCall.args as { run?: unknown };
    if (typeof args.run !== "boolean") {
      return "非法操作，run 必须是布尔值";
    }
    return null;
  },
  vote_for_sheriff: ({ phase, toolCall }) => {
    if (phase !== Phase.Day) {
      return "非法操作，仅白天可进行警长投票";
    }
    const args = toolCall.args as { abstain?: unknown; target_id?: unknown };
    const abstain = Boolean(args.abstain);
    const targetId = args.target_id;
    if (abstain) {
      if (targetId !== null) {
        return "非法操作，弃票时 target_id 必须为 null";
      }
      return null;
    }
    if (typeof targetId !== "number" || !Number.isFinite(targetId) || targetId <= 0) {
      return "非法操作，警长投票目标无效";
    }
    return null;
  },
  choose_direction: ({ world, actorId, phase }) => {
    const badge = world.getComponent<{ isSheriff: boolean; destroyed: boolean }>(
      actorId,
      COMPONENT.Badge,
    );
    if (!badge?.isSheriff || badge.destroyed) {
      return "非法操作，仅警长可决定发言顺序";
    }
    if (phase !== Phase.Day) {
      return "非法操作，仅白天可决定发言顺序";
    }
    return null;
  },
};
