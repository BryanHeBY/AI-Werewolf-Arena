import { ToolName, TurnConstraints } from "../../core/domain/model";

/**
 * 构造统一的 turn_constraints 上下文字段。
 * 说明：
 * - min/max 当前按“单主动作”模式生成；
 * - 只有必须行动的回合才要求命中某个工具；可选窗口可直接结束。
 */
export function buildTurnConstraintContext(input: {
  requiresAction: boolean;
  allowedTools: ToolName[];
  summary?: string;
  maxValidActions?: number;
}): TurnConstraints {
  const min = input.requiresAction ? 1 : 0;
  return {
    min_valid_actions: min,
    max_valid_actions: Math.max(min, Math.floor(input.maxValidActions ?? 1)),
    required_any_tools: input.requiresAction ? [...input.allowedTools] : [],
    ...(input.summary ? { summary: input.summary } : {}),
  };
}
