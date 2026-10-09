import { MECHANICAL_TOOL_NAMES } from "./tool_names";
import { RuleError } from "@ai-werewolf-arena/game-catalog";
import { Camp, Role, Phase } from "../../../../core/domain/model";
import type { ToolRule, ToolRuleMap } from "../../validation/contracts";
import { isAliveTarget } from "../../validation/contracts";
import { canMechanicalKnife } from "./inheritance";
import { hasCurrentMechanicalMode } from "./night_scope";
import {
  canMechanicalMimic,
  canSelectMechanicalMode,
  canMechanicalExtraKnife,
  getMechanicalState,
  mechanicalSkillForNight,
} from "./state";

const validateMechanical: ToolRule = ({ world, actorId, role, day, phase, toolCall }) => {
  const state = getMechanicalState(role);
  if (role.role !== Role.MechanicalWolf || role.camp !== Camp.Wolf || !state || day === undefined)
    return { code: RuleError.MechanicalUnavailable };
  if (phase !== Phase.Night) return { code: RuleError.AbilityPhase };
  if (toolCall.name === "mechanical_mode") {
    return canSelectMechanicalMode(state, day) && ["kill", "skill"].includes(toolCall.args.mode)
      ? null
      : { code: RuleError.MechanicalUnavailable };
  }
  if (toolCall.name === "mimic_role") {
    if (!canMechanicalMimic(state, day)) return { code: RuleError.MechanicalUnavailable };
    return toolCall.args.target_id !== actorId && isAliveTarget(world, toolCall.args.target_id)
      ? null
      : { code: RuleError.MechanicalTarget };
  }
  if (toolCall.name === "mechanical_attack") {
    if (!canMechanicalKnife(role, world) || !canMechanicalExtraKnife(state, day))
      return { code: RuleError.MechanicalUnavailable };
    return toolCall.args.target_id === null || isAliveTarget(world, toolCall.args.target_id)
      ? null
      : { code: RuleError.MechanicalTarget };
  }
  const skill = hasCurrentMechanicalMode(world, role, "skill")
    ? mechanicalSkillForNight(state, day)
    : undefined;
  if (toolCall.name === "mechanical_inspect" && skill?.kind === "inspection") {
    return toolCall.args.target_id !== actorId && isAliveTarget(world, toolCall.args.target_id)
      ? null
      : { code: RuleError.MechanicalTarget };
  }
  if (toolCall.name === "mechanical_poison" && skill?.kind === "poison" && skill.remaining > 0) {
    return isAliveTarget(world, toolCall.args.target_id)
      ? null
      : { code: RuleError.MechanicalTarget };
  }
  if (toolCall.name === "mechanical_guard" && skill?.kind === "guard") {
    // Same-ID consecutive guard is a legal commitment; dawn, not preflight, applies its penalty.
    return toolCall.args.target_id === null || isAliveTarget(world, toolCall.args.target_id)
      ? null
      : { code: RuleError.MechanicalTarget };
  }
  return { code: RuleError.MechanicalUnavailable };
};

export { MECHANICAL_TOOL_NAMES } from "./tool_names";
export const MECHANICAL_VALIDATION_RULES: ToolRuleMap = Object.fromEntries(
  MECHANICAL_TOOL_NAMES.map((name) => [name, validateMechanical]),
);
