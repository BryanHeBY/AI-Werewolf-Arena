/**
 * Defines sheriff direction and successor validation against the current badge and eligible
 * targets. Inputs are sanitized tools and trusted badge context; outputs are the original rule
 * refusals or acceptance. Validation does not transfer, destroy or recreate the badge.
 */
import { RuleError } from "@ai-werewolf-arena/game-catalog";
/** 文件说明：警长机制工具校验规则。 */
import { Phase } from "../../../core/domain/model";
import { COMPONENT } from "../../../core/domain/components/names";
import { ToolRuleMap } from "../validation/contracts";
import { canBeSheriff, canVote } from "../common/participation";

/** 警长机制工具校验规则集合。 */
export const SHERIFF_VALIDATION_RULES: ToolRuleMap = {
  choose_badge_successor: ({ world, actorId, toolCall, badgeCandidates, roleCatalog }) => {
    const badge = world.getComponent(actorId, COMPONENT.Badge);
    if (!badge?.isSheriff || badge.destroyed || badge.handoffPolicy !== "awa_holder_choice_v1")
      return { code: RuleError.BadgeChoiceUnavailable };
    const target = toolCall.args as { target_id?: unknown };
    if (target.target_id === null) return null;
    if (
      !Number.isSafeInteger(target.target_id) ||
      !badgeCandidates?.includes(target.target_id as number) ||
      !canBeSheriff(world, target.target_id as number, roleCatalog) ||
      world.getComponent(target.target_id as number, COMPONENT.Badge)?.destroyed !== false
    )
      return { code: RuleError.BadgeChoiceTarget };
    return null;
  },
  run_for_sheriff: ({ world, actorId, phase, toolCall, roleCatalog }) => {
    if (phase !== Phase.Day) {
      return { code: RuleError.SheriffNominationPhase };
    }
    const args = toolCall.args as { run?: unknown };
    if (typeof args.run !== "boolean") {
      return { code: RuleError.SheriffRunBoolean };
    }
    if (!canBeSheriff(world, actorId, roleCatalog))
      return { code: RuleError.SheriffNominationEligibility };
    return null;
  },
  vote_for_sheriff: ({ world, actorId, phase, toolCall, roleCatalog, sheriffCandidates }) => {
    if (phase !== Phase.Day) {
      return { code: RuleError.SheriffVotePhase };
    }
    if (!canVote(world, actorId, roleCatalog) || sheriffCandidates?.includes(actorId))
      return { code: RuleError.SheriffVoteEligibility };
    const args = toolCall.args as { abstain?: unknown; target_id?: unknown };
    const abstain = Boolean(args.abstain);
    const targetId = args.target_id;
    if (abstain) {
      if (targetId !== null) {
        return { code: RuleError.AbstainTargetNull };
      }
      return null;
    }
    if (
      typeof targetId !== "number" ||
      !Number.isFinite(targetId) ||
      targetId <= 0 ||
      !sheriffCandidates?.includes(targetId) ||
      !canBeSheriff(world, targetId, roleCatalog)
    ) {
      return { code: RuleError.SheriffVoteTarget };
    }
    return null;
  },
  choose_direction: ({ world, actorId, phase, roleCatalog }) => {
    const badge = world.getComponent(actorId, COMPONENT.Badge);
    if (!badge?.isSheriff || badge.destroyed || !canBeSheriff(world, actorId, roleCatalog)) {
      return { code: RuleError.SheriffDirectionOnly };
    }
    if (phase !== Phase.Day) {
      return { code: RuleError.SheriffDirectionPhase };
    }
    return null;
  },
};
