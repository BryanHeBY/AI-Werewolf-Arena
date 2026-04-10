import { COMPONENT } from "../../domain/components/names";
import { VotingRightComponent } from "../../domain/components/voting_right";
import { ToolRuleMap, isAliveTarget } from "../validation/contracts";

export const COMMON_VALIDATION_RULES: ToolRuleMap = {
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
