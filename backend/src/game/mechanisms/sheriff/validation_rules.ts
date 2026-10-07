import { RuleError } from "@ai-werewolf-arena/game-catalog";
/** 文件说明：警长机制工具校验规则。 */
import { Phase } from "../../../core/domain/model";
import { COMPONENT } from "../../../core/domain/components/names";
import { ToolRuleMap } from "../validation/contracts";

/** 警长机制工具校验规则集合。 */
export const SHERIFF_VALIDATION_RULES: ToolRuleMap = {
  run_for_sheriff: ({ phase, toolCall }) => {
    if (phase !== Phase.Day) {
      return { code: RuleError.SheriffNominationPhase };
    }
    const args = toolCall.args as { run?: unknown };
    if (typeof args.run !== "boolean") {
      return { code: RuleError.SheriffRunBoolean };
    }
    return null;
  },
  vote_for_sheriff: ({ phase, toolCall }) => {
    if (phase !== Phase.Day) {
      return { code: RuleError.SheriffVotePhase };
    }
    const args = toolCall.args as { abstain?: unknown; target_id?: unknown };
    const abstain = Boolean(args.abstain);
    const targetId = args.target_id;
    if (abstain) {
      if (targetId !== null) {
        return { code: RuleError.AbstainTargetNull };
      }
      return null;
    }
    if (typeof targetId !== "number" || !Number.isFinite(targetId) || targetId <= 0) {
      return { code: RuleError.SheriffVoteTarget };
    }
    return null;
  },
  choose_direction: ({ world, actorId, phase }) => {
    const badge = world.getComponent<{ isSheriff: boolean; destroyed: boolean }>(
      actorId,
      COMPONENT.Badge,
    );
    if (!badge?.isSheriff || badge.destroyed) {
      return { code: RuleError.SheriffDirectionOnly };
    }
    if (phase !== Phase.Day) {
      return { code: RuleError.SheriffDirectionPhase };
    }
    return null;
  },
};
