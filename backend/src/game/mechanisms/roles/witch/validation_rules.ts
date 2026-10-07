import { RuleError } from "@ai-werewolf-arena/game-catalog";
/** 文件说明：女巫工具校验规则。 */
import { PotionType, Role } from "../../../../core/domain/model";
import { ToolRuleMap, isAliveTarget } from "../../validation/contracts";
import { getWitchState } from "../private_state";

/** 女巫工具校验规则集合。 */
export const WITCH_VALIDATION_RULES: ToolRuleMap = {
  use_potion: ({ world, actorId, role, toolCall }) => {
    const witchState = getWitchState(role);
    if (role.role !== Role.Witch || !witchState) {
      return { code: RuleError.WitchOnly };
    }
    if (toolCall.name !== "use_potion") {
      return { code: RuleError.ToolMismatch };
    }
    if (toolCall.args.potion_type === PotionType.Heal) {
      if (!witchState.canSelfHeal && toolCall.args.target_id === actorId) {
        return { code: RuleError.SelfHeal };
      }
      if (witchState.heal <= 0 || witchState.healUsedThisNight) {
        return { code: RuleError.HealUnavailable };
      }
      if (witchState.poisonUsedThisNight) {
        return { code: RuleError.TwoPotions };
      }
      return null;
    }
    if (toolCall.args.potion_type === PotionType.Poison) {
      if (witchState.poison <= 0 || witchState.poisonUsedThisNight) {
        return { code: RuleError.PoisonUnavailable };
      }
      if (witchState.healUsedThisNight) {
        return { code: RuleError.TwoPotions };
      }
      if (!isAliveTarget(world, toolCall.args.target_id)) {
        return { code: RuleError.PoisonTarget };
      }
      return null;
    }
    return null;
  },
};
