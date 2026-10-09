import { RuleError } from "@ai-werewolf-arena/game-catalog";
import { Camp, Phase, Role, type ToolName } from "../../../../core/domain/model";
import { isAliveTarget, type ToolRule, type ToolRuleMap } from "../../validation/contracts";
import { canAwakenedKnife } from "./inheritance";
import { currentAwakenedNight } from "./night_scope";
import { awakenedSkillForNight, canAwakenedExtraKnife, canAwakenedMimic, getAwakenedState } from "./state";

const validateAwakened: ToolRule = ({ world, actorId, role, phase, day, toolCall }) => {
  const state = getAwakenedState(role);
  if (role.role !== Role.AwakenedHiddenWolf || role.camp !== Camp.Wolf || !state || day === undefined || currentAwakenedNight(world, role) !== day) return { code: RuleError.AwakenedUnavailable };
  if (phase !== Phase.Night) return { code: RuleError.AbilityPhase };
  if (toolCall.name === "awakened_mimic") {
    if (!canAwakenedMimic(state, day)) return { code: RuleError.AwakenedUnavailable };
    return toolCall.args.target_id !== actorId && isAliveTarget(world, toolCall.args.target_id) ? null : { code: RuleError.AwakenedTarget };
  }
  const skill = awakenedSkillForNight(state, day);
  if (toolCall.name === "awakened_attack") {
    if (!canAwakenedKnife(role, world) || !canAwakenedExtraKnife(state, day)) return { code: RuleError.AwakenedUnavailable };
    return toolCall.args.target_id === null || isAliveTarget(world, toolCall.args.target_id) ? null : { code: RuleError.AwakenedTarget };
  }
  if (toolCall.name === "awakened_poison" && skill?.kind === "poison") return isAliveTarget(world, toolCall.args.target_id) ? null : { code: RuleError.AwakenedTarget };
  if (toolCall.name === "awakened_guard" && skill?.kind === "guard") {
    if (toolCall.args.target_id !== null && !isAliveTarget(world, toolCall.args.target_id)) return { code: RuleError.AwakenedTarget };
    if (toolCall.args.target_id !== null && skill.lastTarget === toolCall.args.target_id && skill.lastGuardDay === day - 1) return { code: RuleError.AwakenedGuardRepeat };
    return null;
  }
  return { code: RuleError.AwakenedUnavailable };
};
export const AWAKENED_TOOL_NAMES = ["awakened_mimic", "awakened_poison", "awakened_guard", "awakened_attack"] as const satisfies readonly ToolName[];
export const AWAKENED_VALIDATION_RULES: ToolRuleMap = Object.fromEntries(AWAKENED_TOOL_NAMES.map(name => [name, validateAwakened]));
