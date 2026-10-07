import { toolFailure } from "@ai-werewolf-arena/game-text";
import { ToolLoopClient } from "../integrations/llm/transport";
import { AgentTurnOptions } from "../runtime/agent_turn_executor";
import { AuditAgentExecutor } from "./contracts";
import { auditSystemPrompt, auditTurnPrompt } from "./prompts";
import { auditToolProtocol, AuditSubmission, AuditToolContext, AuditToolResult, AuditToolTurnRegistry } from "./audit_tool_protocol";
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
    const registry = new AuditToolTurnRegistry(context.locale);
    const protocol = auditToolProtocol(registry.locale);
    const sessionId = `sdk-audit-${++this.nextSession}`;
    const turn = registry.openTurn(context, sessionId);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs);
    try {
      const result = await this.client.runToolLoop<AuditSubmission>(
        [
          { role: "system", content: auditSystemPrompt(registry.locale) },
          { role: "user", content: auditTurnPrompt(turn.turnId, context.mode, registry.locale) },
        ],
        protocol.specs,
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
            return { toolResult: toolFailure(registry.locale, "unknown_audit_tool") };
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
