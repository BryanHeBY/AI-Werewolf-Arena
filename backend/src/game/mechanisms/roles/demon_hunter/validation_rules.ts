/**
 * 负责猎魔挑战工具的资格校验贡献。输入为当前角色／库存与可信工具上下文，输出原资格拒绝或通过。
 * 规则委托 canSubmitDemonHunt 核具体资格，预检不写角色状态或付款，挑战资源仍由猎魔所有者持有。
 */
import { RuleError } from "@ai-werewolf-arena/game-contract";
import { canSubmitDemonHunt } from "./authority";
import type { ToolRule } from "../../validation/contracts";
/** profile 明确注册此规则，角色在当前板子是否可运行仍由实际装配负责。 */
export const DEMON_HUNTER_TOOL_RULE: ToolRule = ({
  world,
  actorId,
  phase,
  day,
  demonHunterScope,
  toolCall,
}) =>
  canSubmitDemonHunt(world, actorId, phase, day ?? 0, demonHunterScope, toolCall)
    ? null
    : { code: RuleError.ToolMismatch };
