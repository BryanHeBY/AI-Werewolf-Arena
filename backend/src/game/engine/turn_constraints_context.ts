import { ToolName } from "../../core/domain/model";

/**
 * 构造统一的 turn_constraints 上下文字段。
 * 说明：
 * - min/max 当前按“单主动作”模式生成；
 * - required_any_tools 默认取本轮可用工具，表示至少命中其中之一。
 */
export function buildTurnConstraintContext(input: {
  requiresAction: boolean;
  allowedTools: ToolName[];
  summary?: string;
  maxValidActions?: number;
}): Record<string, unknown> {
  const min = input.requiresAction ? 1 : 0;
  return {
    min_valid_actions: min,
    max_valid_actions: Math.max(min, Math.floor(input.maxValidActions ?? 1)),
    required_any_tools: [...input.allowedTools],
    ...(input.summary ? { summary: input.summary } : {}),
  };
}
