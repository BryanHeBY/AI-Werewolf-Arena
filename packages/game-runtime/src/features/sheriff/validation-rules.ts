/**
 * 负责按当前警徽和候选资格校验方向及接徽选择。输入为已清洗工具和可信警徽上下文，输出原规则拒绝或通过。
 * 本校验不转移、销毁或重新生成警徽，实际写入仍归警徽所有者。
 */
import { ownedToolRules } from "../../engine/actions/validation-queries";

import { RuleError } from "@ai-werewolf-arena/game-contract";
/** 文件说明：警长机制工具校验规则。 */
import { Phase } from "../../domain/model";
import { COMPONENT } from "../../domain/components/names";
import { ToolRuleMap } from "../../engine/actions/validation-contracts";
import { canBeSheriff, canVote } from "../../engine/participation";

/** 警长机制工具校验规则集合。 */
export const SHERIFF_VALIDATION_RULES: ToolRuleMap = ownedToolRules({
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
});
