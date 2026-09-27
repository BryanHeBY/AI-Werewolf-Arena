import { ToolLoopClient } from "../integrations/llm/transport";
import { AgentTurnOptions } from "../runtime/agent_turn_executor";
import { AuditAgentExecutor } from "./contracts";
import { auditTurnPrompt } from "./prompts";
import { AUDIT_TOOL_SPECS, AuditSubmission, AuditToolContext, AuditToolResult, AuditToolTurnRegistry } from "./audit_tool_protocol";
function auditSystemPrompt(): string {
  return [
    "你是狼人杀复盘审计智能体。唯一职责是从被授权的结构化上下文中发现可验证的问题。",
    "先调用 get_audit_context 读取当前任务；不要猜测或读取本地文件、终端和其他任务。",
    "inspect 模式必须以 submit_audit_findings 结束；summarize 模式必须以 submit_audit_summary 结束。",
    "普通 assistant 文本仅视为思考，不会成为审计结果。证据序号必须来自当前上下文。",
  ].join("\n");
}
function asToolRecord(result: AuditToolResult | object): Record<string, unknown> {
  return result as Record<string, unknown>;
}

/** AI SDK function-tools 适配器。 */
export class SdkAuditAgentExecutor implements AuditAgentExecutor {
  private nextSession = 0;

  constructor(private readonly client: ToolLoopClient) {}

  async runTurn(
    context: AuditToolContext,
    options: AgentTurnOptions,
  ): Promise<AuditSubmission | null> {
    const registry = new AuditToolTurnRegistry();
    const sessionId = `sdk-audit-${++this.nextSession}`;
    const turn = registry.openTurn(context, sessionId);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs);
    try {
      const result = await this.client.runToolLoop<AuditSubmission>(
        [
          { role: "system", content: auditSystemPrompt() },
          { role: "user", content: auditTurnPrompt(turn.turnId, context.mode) },
        ],
        AUDIT_TOOL_SPECS,
        {
          onToolCall: async (invocation) => {
            if (invocation.name === "get_audit_schema") {
              return { toolResult: asToolRecord(registry.getSchema()) };
            }
            if (invocation.name === "get_audit_context") {
              return { toolResult: asToolRecord(registry.getContext(sessionId, invocation.args)) };
            }
            if (invocation.name === "submit_audit_findings") {
              const toolResult = registry.submitFindings(sessionId, invocation.args);
              const finalAction = toolResult.ok ? await turn.result : undefined;
              return {
                toolResult: asToolRecord(toolResult),
                ...(finalAction ? { finalAction, stop: true } : {}),
              };
            }
            if (invocation.name === "submit_audit_summary") {
              const toolResult = registry.submitSummary(sessionId, invocation.args);
              const finalAction = toolResult.ok ? await turn.result : undefined;
              return {
                toolResult: asToolRecord(toolResult),
                ...(finalAction ? { finalAction, stop: true } : {}),
              };
            }
            return { toolResult: { ok: false, error: "unknown_audit_tool" } };
          },
        },
        { signal: controller.signal, maxSteps: 6, toolChoice: "required" },
      );
      return result.finalAction;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
      registry.closeTurn();
    }
  }

  async close(): Promise<void> {}
}
