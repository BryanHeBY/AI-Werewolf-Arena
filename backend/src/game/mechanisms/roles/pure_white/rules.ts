/**
 * 定义纯白查验目标与对应工具校验。输入为当前 World 角色和请求目标；输出为政策允许
 * 的编号或结构化拒绝。目标枚举不提交查验或发表私密结果，原目标／来源及失败顺序不变。
 */
import { roleInspectionPolicy } from "../role_inspection/ports";
import { RuleError } from "@ai-werewolf-arena/game-catalog";
import { Camp, Phase, Role, type EntityId } from "../../../../core/domain/model";
import { COMPONENT } from "../../../../core/domain/components/names";
import type { RoleComponent } from "../../../../core/domain/components/role";
import type { World } from "../../../../core/domain/world";
import type { ToolRule } from "../../validation/contracts";
import type { RoleProfile } from "../contracts";
import { activeNightAbility } from "../abilities";

export function pureWhiteInspectionTargets(
  world: World,
  actorId: EntityId,
  policy: "pure_white" | "wolf_witch",
): EntityId[] {
  return world
    .getAliveEntityIds()
    .filter(
      (id) =>
        id !== actorId &&
        (policy === "pure_white" || world.getComponent(id, COMPONENT.Role)?.camp !== Camp.Wolf),
    );
}
export const PURE_WHITE_INSPECTION_TOOL: NonNullable<RoleProfile["toolSpecs"]>[number] = {
  name: "inspect_night_identity",
  parameters: {
    type: "object",
    properties: {
      target_id: { type: ["integer", "null"], minimum: 1 },
      abstain: { type: "boolean" },
    },
    required: ["target_id", "abstain"],
    additionalProperties: false,
  },
  argHint: 'inspect_night_identity args: {"target_id":number|null,"abstain":boolean}',
  userPromptHintKey: "action.inspect_night_identity.hint",
};
export const validatePureWhiteInspection: ToolRule = ({
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
  const policy = roleInspectionPolicy(ability.state);
  if (policy !== "pure_white" && policy !== "wolf_witch")
    return { code: RuleError.RoleInspectUnavailable };
  const expected = policy === "pure_white" ? Role.PureWhiteGirl : Role.WolfWitch;
  if (
    role.role !== expected ||
    ability.source.kind !== "native" ||
    ability.source.role !== expected
  )
    return { code: RuleError.RoleInspectUnavailable };
  if (phase !== Phase.Night) return { code: RuleError.AbilityPhase };
  if (toolCall.name !== "inspect_night_identity") return { code: RuleError.ToolMismatch };
  const { target_id, abstain } = toolCall.args;
  if (abstain === true && target_id === null) return null;
  if (
    abstain !== false ||
    target_id === null ||
    !Number.isSafeInteger(target_id) ||
    !pureWhiteInspectionTargets(world, actorId, policy).includes(target_id)
  )
    return { code: RuleError.RoleInspectTarget };
  return null;
};
