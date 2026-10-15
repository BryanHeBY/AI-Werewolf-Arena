/**
 * 负责机械狼工具的本夜模式与行动资格校验。输入为原工具参数、角色状态及可信上下文，输出原规则拒绝或通过。
 * 预检不等于复制、付款或落效果，原体与能力资源仍由机械机制持有并在提交时复验。
 */
import { MECHANICAL_TOOL_NAMES } from "./tool-names";
import { RuleError } from "@ai-werewolf-arena/game-contract";
import { COMPONENT } from "../../domain/components/names";
import { isRoleExecutionRetired } from "../../domain/role-execution-authority";
import { Camp, Role, Phase } from "../../domain/model";
import type { ToolRule, ToolRuleMap } from "../../engine/actions/validation-contracts";
import { isAliveTarget } from "../../engine/actions/validation-contracts";
import { canMechanicalKnife } from "./inheritance";
import { hasCurrentMechanicalMode } from "./night-scope";
import {
  canMechanicalMimic,
  canSelectMechanicalMode,
  canMechanicalExtraKnife,
  getMechanicalState,
  mechanicalSkillForNight,
} from "./state";

const validateMechanical: ToolRule = ({ world, actorId, role, day, phase, toolCall }) => {
  const state = getMechanicalState(role);
  if (role.role !== Role.MechanicalWolf || world.getComponent(actorId, COMPONENT.Camp)?.camp !== Camp.Wolf || !state || day === undefined || isRoleExecutionRetired(role))
    return { code: RuleError.MechanicalUnavailable };
  // 这是未付款工具预检；墓碑只拒绝新动作，已付效果和知识读器不用这张规则表。
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
    if (!canMechanicalKnife(role, world, () => world.getComponent(actorId, COMPONENT.Camp)) || !canMechanicalExtraKnife(state, day))
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
    // 连续守护同编号仍是合法提交；惩罚在黎明生效，不能在预检阶段代付或拒绝。
    return toolCall.args.target_id === null || isAliveTarget(world, toolCall.args.target_id)
      ? null
      : { code: RuleError.MechanicalTarget };
  }
  return { code: RuleError.MechanicalUnavailable };
};

export { MECHANICAL_TOOL_NAMES } from "./tool-names";
export const MECHANICAL_VALIDATION_RULES: ToolRuleMap = Object.fromEntries(
  MECHANICAL_TOOL_NAMES.map((name) => [name, validateMechanical]),
);
