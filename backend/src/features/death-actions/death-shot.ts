/**
 * 负责死亡枪工具定义与预检。输入为当前工具请求、候选和已知枪权，输出为原规则错误或通过。
 * 预检不付款；原生／学习枪结算由具名 owner 复验并消费，目标死亡与最终判胜仍由有序中央结算负责。
 */
import { RuleError } from "@ai-werewolf-arena/game-contract";
import type { ToolSpec } from "../../engine/actions/tool-contracts";
import type { ToolRepairPack } from "../../agents/tool-repair/contracts";
import { numberOrNull } from "../../agents/tool-repair/helpers";
import { isAliveTarget, type ValidationRuleContext } from "../../engine/actions/validation-contracts";

/** 原生工具元数据不绑定特定角色；SDK／MCP 文案与玩家提示由本地化入口提供。 */
export const DEATH_SHOT_TOOL_SPECS: ToolSpec[] = [
  {
    name: "shoot",
    parameters: {
      type: "object",
      properties: {
        target_id: {
          type: ["number", "null"],
        },
      },
      required: ["target_id"],
      additionalProperties: false,
    },
    argHint: 'shoot args: {"target_id":number|null}',
    userPromptHintKey: "action.shoot.hint",
  },
];
export const DEATH_SHOT_REPAIR: ToolRepairPack = {
  coerce: {
    shoot: (args) => {
      if (args.target_id === null) return { target_id: null };
      const target = numberOrNull(args.target_id);
      return target === null ? null : { target_id: target };
    },
  },
};
export function validateDeathShot(ctx: ValidationRuleContext, hasShot: boolean) {
  if (!hasShot) return { code: RuleError.ShootUnavailable };
  if (ctx.toolCall.name !== "shoot") return { code: RuleError.ToolMismatch };
  if (
    ctx.toolCall.args.target_id !== null &&
    !isAliveTarget(ctx.world, ctx.toolCall.args.target_id)
  )
    return { code: RuleError.ShootTarget };
  return null;
}
