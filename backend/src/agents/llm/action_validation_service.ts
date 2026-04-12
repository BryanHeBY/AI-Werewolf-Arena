import { ActionRequest, ToolCall, ToolName } from "../../domain/model";

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
    parseToolCall: (
      raw: string,
      allowedTools: ActionRequest["allowedTools"],
      actorId: number,
    ) => ToolCall | null,
  ): InvocationValidationResult {
    if (!llmAllowedTools.includes(invocation.name as ToolName)) {
      return { ok: false, error: "tool_not_allowed_in_this_turn" };
    }

    const candidate: ToolCall = {
      name: invocation.name as ToolName,
      args: invocation.args as any,
    } as ToolCall;
    const parsed = parseToolCall(
      JSON.stringify(candidate),
      llmAllowedTools,
      request.actorId,
    );
    if (!parsed) {
      return { ok: false, error: "invalid_tool_arguments" };
    }

    return { ok: true, action: parsed };
  }
}

