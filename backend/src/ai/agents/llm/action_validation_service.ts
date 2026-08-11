import { ActionRequest, ToolCall, ToolName } from "../../../core/domain/model";

export type ToolInvocationInput = {
  name: string;
  args: Record<string, unknown>;
};

export type InvocationValidationResult =
  | { ok: true; action: ToolCall }
  | { ok: false; error: "tool_not_allowed_in_this_turn" | "invalid_tool_arguments" };

/**
 * 回合内动作校验服务：
 * - 独立于 LLM loop 编排层，统一处理工具可用性与参数合法性；
 * - 仅返回结构化结果，不承担状态修改职责。
 */
export class ActionValidationService {
  validateToolInvocation(
    request: ActionRequest,
    llmAllowedTools: ToolName[],
    invocation: ToolInvocationInput,
    coerceArgs: (
      tool: ToolName,
      rawArgs: Record<string, unknown>,
      actorId: number,
    ) => Record<string, unknown> | null,
  ): InvocationValidationResult {
    if (!llmAllowedTools.includes(invocation.name as ToolName)) {
      return { ok: false, error: "tool_not_allowed_in_this_turn" };
    }

    const name = invocation.name as ToolName;
    const args = coerceArgs(name, invocation.args, request.actorId);
    if (!args) {
      return { ok: false, error: "invalid_tool_arguments" };
    }
    return { ok: true, action: { name, args } as ToolCall };
  }
}
