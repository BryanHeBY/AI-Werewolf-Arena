import { PotionType, Role } from "../../../domain/model";
import { ToolRuleMap, isAliveTarget } from "../../validation/contracts";

export const WITCH_VALIDATION_RULES: ToolRuleMap = {
  use_potion: ({ world, actorId, role, toolCall }) => {
    if (role.role !== Role.Witch || !role.witchState) {
      return "非法操作，仅女巫可用药";
    }
    if (toolCall.name !== "use_potion") {
      return "非法操作，工具不匹配";
    }
    if (toolCall.args.potion_type === PotionType.Heal) {
      if (!role.witchState.canSelfHeal && toolCall.args.target_id === actorId) {
        return "非法操作，本板子女巫不可自救";
      }
      if (role.witchState.heal <= 0 || role.witchState.healUsedThisNight) {
        return "非法操作，解药不可用";
      }
      if (role.witchState.poisonUsedThisNight) {
        return "非法操作，同夜不可双药";
      }
      return null;
    }
    if (toolCall.args.potion_type === PotionType.Poison) {
      if (role.witchState.poison <= 0 || role.witchState.poisonUsedThisNight) {
        return "非法操作，毒药不可用";
      }
      if (role.witchState.healUsedThisNight) {
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

