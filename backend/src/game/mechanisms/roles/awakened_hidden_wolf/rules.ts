/**
 * 负责觉醒隐狼的工具资格校验贡献。输入为原工具参数、角色状态及可信窗口，输出原规则拒绝或通过。
 * 当前原体、学习／盾／刀资格仍归实际机制，本校验不执行学习、消费库存或提交死亡。
 */
import { AWAKENED_TOOL_NAMES } from "./tool_names";
import { RuleError } from "@ai-werewolf-arena/game-contract";
import { COMPONENT } from "../../../../core/domain/components/names";
import { Camp, Phase, Role } from "../../../../core/domain/model";
import { isAliveTarget, type ToolRule, type ToolRuleMap } from "../../validation/contracts";
import { canAwakenedKnife } from "./inheritance";
import { currentAwakenedNight } from "./night_scope";
import {
  awakenedSkillForNight,
  canAwakenedExtraKnife,
  canAwakenedMimic,
  getAwakenedState,
} from "./state";

const validateAwakened: ToolRule = ({ world, actorId, role, phase, day, toolCall }) => {
  const state = getAwakenedState(role);
  if (
    role.role !== Role.AwakenedHiddenWolf ||
    world.getComponent(actorId, COMPONENT.Camp)?.camp !== Camp.Wolf ||
    !state ||
    day === undefined ||
    currentAwakenedNight(world, role) !== day
  )
    return { code: RuleError.AwakenedUnavailable };
  if (phase !== Phase.Night) return { code: RuleError.AbilityPhase };
  if (toolCall.name === "awakened_mimic") {
    if (!canAwakenedMimic(state, day)) return { code: RuleError.AwakenedUnavailable };
    return toolCall.args.target_id !== actorId && isAliveTarget(world, toolCall.args.target_id)
      ? null
      : { code: RuleError.AwakenedTarget };
  }
  const skill = awakenedSkillForNight(state, day);
  if (toolCall.name === "awakened_attack") {
    if (!canAwakenedKnife(role, world, () => world.getComponent(actorId, COMPONENT.Camp)) || !canAwakenedExtraKnife(state, day))
      return { code: RuleError.AwakenedUnavailable };
    return toolCall.args.target_id === null || isAliveTarget(world, toolCall.args.target_id)
      ? null
      : { code: RuleError.AwakenedTarget };
  }
  if (toolCall.name === "awakened_poison" && skill?.kind === "poison")
    return isAliveTarget(world, toolCall.args.target_id)
      ? null
      : { code: RuleError.AwakenedTarget };
  if (toolCall.name === "awakened_guard" && skill?.kind === "guard") {
    if (toolCall.args.target_id !== null && !isAliveTarget(world, toolCall.args.target_id))
      return { code: RuleError.AwakenedTarget };
    if (
      toolCall.args.target_id !== null &&
      skill.lastTarget === toolCall.args.target_id &&
      skill.lastGuardDay === day - 1
    )
      return { code: RuleError.AwakenedGuardRepeat };
    return null;
  }
  return { code: RuleError.AwakenedUnavailable };
};
export { AWAKENED_TOOL_NAMES } from "./tool_names";
export const AWAKENED_VALIDATION_RULES: ToolRuleMap = Object.fromEntries(
  AWAKENED_TOOL_NAMES.map((name) => [name, validateAwakened]),
);
