/**
 * 负责角色查验的目标查询、工具 schema 与规则校验。输入为原只读查验历史、World 成员及待提交动作，输出合法 ID 或原拒绝代码。
 * 此业务叶不修改历史、消费库存或提交查验效果，当前许可仍由具体机制核对。
 */
import type { RoleInspectionReadState } from "@ai-werewolf-arena/game-contract";

import { RuleError } from "@ai-werewolf-arena/game-contract";
import { Phase, type EntityId } from "../../domain/model";
import type { World } from "../../domain/world";
import type { ToolRule } from "../../engine/actions/validation-contracts";
import { isAliveTarget } from "../../engine/actions/validation-contracts";
import type { RoleProfile } from "../../rulesets/roles/contracts";
import { activeNightAbility } from "../night-abilities/inventory-ports";
import { inspectionRepeats } from "@ai-werewolf-arena/game-contract/role-inspection-policy";

export function roleInspectionTargets(
  world: World,
  actorId: EntityId,
  state: RoleInspectionReadState,
): EntityId[] {
  const repeat = inspectionRepeats(state);
  return world
    .getAliveEntityIds()
    .filter(
      (id) => id !== actorId && (repeat || !state.history.some((report) => report.targetId === id)),
    );
}
export const ROLE_INSPECTION_TOOL: NonNullable<RoleProfile["toolSpecs"]>[number] = {
  name: "inspect_role",
  parameters: {
    type: "object",
    properties: { target_id: { type: "number" } },
    required: ["target_id"],
    additionalProperties: false,
  },
  argHint: 'inspect_role args: {"target_id":number}',
  userPromptHintKey: "action.inspect_role.hint",
};
export const validateRoleInspection: ToolRule = ({
  world,
  actorId,
  role,
  day,
  phase,
  abilityId,
  toolCall,
}) => {
  const ability = activeNightAbility(role, "role_check", day ?? 1, abilityId);
  if (!ability) return { code: RuleError.RoleInspectUnavailable };
  if (phase !== Phase.Night) return { code: RuleError.AbilityPhase };
  if (toolCall.name !== "inspect_role") return { code: RuleError.ToolMismatch };
  if (toolCall.args.target_id === actorId || !isAliveTarget(world, toolCall.args.target_id))
    return { code: RuleError.RoleInspectTarget };
  if (
    !inspectionRepeats(ability.state) &&
    ability.state.history.some((report) => report.targetId === toolCall.args.target_id)
  )
    return { code: RuleError.RoleInspectRepeat };
  return null;
};
