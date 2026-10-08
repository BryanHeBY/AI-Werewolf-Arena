import { RuleError } from "@ai-werewolf-arena/game-catalog";
import { Phase, type EntityId } from "../../../../core/domain/model";
import type { World } from "../../../../core/domain/world";
import type { ToolRule } from "../../validation/contracts";
import { isAliveTarget } from "../../validation/contracts";
import type { RoleProfile } from "../contracts";
import { activeNightAbility, roleInspectionPolicy } from "../abilities";
import type { RoleInspectionState } from "../private_state";

export function roleInspectionTargets(world: World, actorId: EntityId, state: RoleInspectionState): EntityId[] {
  const repeat = roleInspectionPolicy(state) === "psychic";
  return world.getAliveEntityIds().filter(id => id !== actorId && (repeat || !state.history.some(report => report.targetId === id)));
}
export const ROLE_INSPECTION_TOOL: NonNullable<RoleProfile["toolSpecs"]>[number] = {
  name: "inspect_role",
  llm: { name: "inspect_role", description: "Privately inspect another living player's rule-defined role label. Follow the bound instance's current-turn rules for repetition and whether inspection is required.", parameters: { type: "object", properties: { target_id: { type: "number" } }, required: ["target_id"], additionalProperties: false } },
  argHint: 'inspect_role args: {"target_id":number}', userPromptHintKey: "action.inspect_role.hint",
};
export const validateRoleInspection: ToolRule = ({ world, actorId, role, day, phase, abilityId, toolCall }) => {
  const ability = activeNightAbility(role, "role_check", day ?? 1, abilityId);
  if (!ability) return { code: RuleError.RoleInspectUnavailable };
  if (phase !== Phase.Night) return { code: RuleError.AbilityPhase };
  if (toolCall.name !== "inspect_role") return { code: RuleError.ToolMismatch };
  if (toolCall.args.target_id === actorId || !isAliveTarget(world, toolCall.args.target_id)) return { code: RuleError.RoleInspectTarget };
  if (roleInspectionPolicy(ability.state) === "gargoyle" && ability.state.history.some(report => report.targetId === toolCall.args.target_id)) return { code: RuleError.RoleInspectRepeat };
  return null;
};
