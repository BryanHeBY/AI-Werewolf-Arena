import { isMagicianBoard, resolveMagicianNightTarget } from "../magician/night_frame";
import { nativePotionsCanCombine } from "./policies";
import { RuleError } from "@ai-werewolf-arena/game-catalog";
/** 文件说明：女巫工具校验规则。 */
import { PotionType, Phase, WitchSelfHealRule, StatusMark } from "../../../../core/domain/model";
import { COMPONENT } from "../../../../core/domain/components/names";
import type { StatusMarksComponent } from "../../../../core/domain/components/status_marks";
import type { RoleComponent } from "../../../../core/domain/components/role";
import { ToolRuleMap, isAliveTarget } from "../../validation/contracts";
import { getWitchState } from "../private_state";
import { activeNightAbility } from "../abilities";
import { luckyTargetAllowed } from "../night_action_history";

/** 女巫工具校验规则集合。 */
export const WITCH_VALIDATION_RULES: ToolRuleMap = {
  use_potion: ({ world, actorId, role, toolCall, day, abilityId, phase }) => {
    const ability = activeNightAbility(role, "potion", day ?? 1, abilityId);
    const witchState = ability?.state;
    if (!witchState) {
      return { code: RuleError.WitchOnly };
    }
    if (phase !== Phase.Night) return { code: RuleError.AbilityPhase };
    if (toolCall.name !== "use_potion") {
      return { code: RuleError.ToolMismatch };
    }
    if (
      ability?.activation === "lucky" &&
      toolCall.args.potion_type === PotionType.None &&
      toolCall.args.target_id !== actorId
    )
      return { code: RuleError.PoisonTarget };
    if (
      ability?.activation === "black_market" &&
      toolCall.args.potion_type === PotionType.None &&
      !isAliveTarget(world, toolCall.args.target_id)
    )
      return { code: RuleError.PoisonTarget };
    if (toolCall.args.potion_type === PotionType.Heal) {
      const canSelfHeal =
        day === undefined
          ? witchState.canSelfHeal
          : witchState.selfHealRule === WitchSelfHealRule.Always ||
            (witchState.selfHealRule === WitchSelfHealRule.FirstNightOnly && day === 1);
      if (!canSelfHeal && toolCall.args.target_id === actorId) {
        return { code: RuleError.SelfHeal };
      }
      if (witchState.heal <= 0 || witchState.healUsedThisNight) {
        return { code: RuleError.HealUnavailable };
      }
      if (witchState.poisonUsedThisNight && !nativePotionsCanCombine(ability!)) {
        return { code: RuleError.TwoPotions };
      }
      const requestedId = toolCall.args.target_id;
      if (!isAliveTarget(world, requestedId)) return { code: RuleError.HealTarget };
      const mapping = isMagicianBoard(world)
        ? resolveMagicianNightTarget(world, day ?? 0, requestedId)
        : null;
      if (mapping && !mapping.isCurrent()) return { code: RuleError.HealTarget };
      const targetId = mapping?.effectiveId ?? requestedId;
      if (
        !isAliveTarget(world, targetId) ||
        !world.getComponent<RoleComponent>(targetId, COMPONENT.Role) ||
        !world
          .getComponent<StatusMarksComponent>(targetId, COMPONENT.StatusMarks)
          ?.has(StatusMark.WolfKillMark)
      ) {
        return { code: RuleError.HealTarget };
      }
      return null;
    }
    if (toolCall.args.potion_type === PotionType.Poison) {
      if (witchState.poison <= 0 || witchState.poisonUsedThisNight) {
        return { code: RuleError.PoisonUnavailable };
      }
      if (witchState.healUsedThisNight && !nativePotionsCanCombine(ability!)) {
        return { code: RuleError.TwoPotions };
      }
      if (!isAliveTarget(world, toolCall.args.target_id)) {
        return { code: RuleError.PoisonTarget };
      }
      if (
        !luckyTargetAllowed(world, actorId, ability!, day ?? 1, "poison", toolCall.args.target_id)
      )
        return { code: RuleError.LuckyTargetRepeat };
      return null;
    }
    return null;
  },
};
