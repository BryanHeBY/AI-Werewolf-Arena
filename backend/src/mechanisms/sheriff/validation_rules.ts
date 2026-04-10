import { Phase } from "../../domain/model";
import { COMPONENT } from "../../domain/components/names";
import { ToolRuleMap } from "../validation/contracts";

export const SHERIFF_VALIDATION_RULES: ToolRuleMap = {
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
