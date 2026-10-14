/**
 * 负责 SDK 审计工具循环。输入为指定任务上下文、locale 与超时；输出为正式工具提交或 null。
 * 每次调用拥有原 registry 和计时器，工具先按 session／turn／模式校验，再决定停止循环；
 * AbortSignal 交 transport 配合取消，原循环上限六步，不承诺强制回收底层请求或进程。
 * 本模块不解析纯文本为提交，不更改证据、游戏状态或持久化；close 是原无操作接口。
 */
import { toolFailure } from "@ai-werewolf-arena/game-text";
import { ToolLoopClient } from "../integrations/llm/transport";
import { AgentTurnOptions } from "../runtime/agent_turn_executor";
import { AuditAgentExecutor } from "./contracts";
import { auditSystemPrompt, auditTurnPrompt } from "./prompts";
import {
  auditToolProtocol,
  AuditSubmission,
  AuditToolContext,
  AuditToolResult,
  AuditToolTurnRegistry,
} from "./audit_tool_protocol";
/** 只作已有对象的类型视图，不复制、冻结或增加错误／证据校验。 */
function asToolRecord(result: AuditToolResult | object): Record<string, unknown> {
  return result as Record<string, unknown>;
}

/** 使用原同一审计工具协议；每个任务独立 turn，client 的传输资源由其实际实现拥有。 */
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
    // 上下文不嵌入提示文本；原工具 get_context 在已开放的 session／turn 下读取同 payload。
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
              // 只有协议确认提交成功才取得同一 turn 结果并停循环；拒绝回包仍交原工具循环。
              const finalAction = toolResult.ok ? await turn.result : undefined;
              return {
                toolResult: asToolRecord(toolResult),
                ...(finalAction ? { finalAction, stop: true } : {}),
              };
            }
            if (invocation.name === "submit_audit_summary") {
              const toolResult = registry.submitSummary(sessionId, invocation.args);
              // 只有协议确认提交成功才取得同一 turn 结果并停循环；拒绝回包仍交原工具循环。
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
      // 原循环异常降为无正式提交，重试与失败任务名单由外层审计编排决定。
      return null;
    } finally {
      clearTimeout(timer);
      registry.closeTurn();
    }
  }

  /** 原无操作收尾；不取消正在运行的 turn，也不能据此声称 SDK 请求池或进程已回收。 */
  async close(): Promise<void> {}
}
