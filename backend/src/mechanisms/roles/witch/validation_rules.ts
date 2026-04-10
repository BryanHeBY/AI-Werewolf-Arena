import { PotionType, Role } from "../../../domain/model";
import { ToolRuleMap, isAliveTarget } from "../../validation/contracts";
import { getWitchState } from "../private_state";

export const WITCH_VALIDATION_RULES: ToolRuleMap = {
  use_potion: ({ world, actorId, role, toolCall }) => {
    const witchState = getWitchState(role);
    if (role.role !== Role.Witch || !witchState) {
      return "非法操作，仅女巫可用药";
    }
    if (toolCall.name !== "use_potion") {
      return "非法操作，工具不匹配";
    }
    if (toolCall.args.potion_type === PotionType.Heal) {
      if (!witchState.canSelfHeal && toolCall.args.target_id === actorId) {
        return "非法操作，本板子女巫不可自救";
      }
      if (witchState.heal <= 0 || witchState.healUsedThisNight) {
        return "非法操作，解药不可用";
      }
      if (witchState.poisonUsedThisNight) {
        return "非法操作，同夜不可双药";
      }
      return null;
    }
    if (toolCall.args.potion_type === PotionType.Poison) {
      if (witchState.poison <= 0 || witchState.poisonUsedThisNight) {
        return "非法操作，毒药不可用";
      }
      if (witchState.healUsedThisNight) {
        return "非法操作，同夜不可双药";
      }
      if (!isAliveTarget(world, toolCall.args.target_id)) {
        return "非法操作，毒药目标必须存活";
      }
      return null;
    }
    return null;
  },
};
