/**
 * 负责 SDK 步骤轨迹转换与单轮输出缓冲；输入模型步骤，输出公共私有事实及可取走的录制增量。
 * 缓冲按原请求弱关联，先留底再交展示；完整历史仍归提示会话，显示开关不影响收集。
 */
import type { AgentOutput, AgentOutputContext } from "@ai-werewolf-arena/replay-contract";
import type { ActionRequest } from "../../domain";
import type { ToolLoopStepTrace } from "../../adapters/llm/transport";
import { PlayerOutputObserver } from "../player/player-observer";

export class LlmOutputRecorder {
  private readonly roundOutputs = new WeakMap<ActionRequest, AgentOutput[]>();
  constructor(private readonly observer: PlayerOutputObserver) {}

  /** 宿主回执先于 SDK 收尾留底；传输随后失败也不会丢失已经提交的事实。 */
  executionResult(request: ActionRequest, output: Extract<AgentOutput, { type: "tool" }>): void {
    this.emit(output, this.observer.context(request), request);
  }

  private emit(
    output: AgentOutput,
    context: Omit<AgentOutputContext, "transport">,
    request: ActionRequest,
  ): void {
    const outputs = this.roundOutputs.get(request) ?? [];
    outputs.push(structuredClone(output));
    this.roundOutputs.set(request, outputs);
    this.observer.emit(output, context);
  }
  takeOutputs(request: ActionRequest): AgentOutput[] {
    const outputs = this.roundOutputs.get(request) ?? [];
    this.roundOutputs.delete(request);
    const facts = outputs.filter((output) => output.type === "text" || output.type === "tool");
    if (!facts.some((output) => output.type === "text")) {
      const raw = [...outputs].reverse().find((output) => output.type === "raw_response");
      if (raw?.type === "raw_response" && raw.text)
        facts.push({ type: "text", channel: "message", text: raw.text });
    }
    return facts;
  }
  rawResponse(raw: string, request: ActionRequest): void {
    this.emit({ type: "raw_response", text: raw }, this.observer.context(request), request);
  }
  thinking(trace: ToolLoopStepTrace[], request: ActionRequest): void {
    const context = this.observer.context(request);
    for (const [index, step] of trace.entries()) {
      if (step.assistantText?.trim())
        this.emit(
          { type: "text", channel: "output", text: step.assistantText, step: index + 1 },
          context,
          request,
        );
      for (const call of step.toolCalls) {
        const captured = this.roundOutputs
          .get(request)
          ?.some(
            (output) =>
              output.type === "tool" && output.status === "completed" && output.id === call.id,
          );
        let args: Record<string, unknown> = { raw: call.rawArgs };
        try {
          const parsed: unknown = JSON.parse(call.rawArgs);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
            args = parsed as Record<string, unknown>;
        } catch {
          /* 失败原文只用于私有展示，行动校验仍由原工具网关处理。 */
        }
        this.emit(
          { type: "tool", id: call.id, name: call.name, args, status: "started", step: index + 1 },
          context,
          request,
        );
        if (!captured)
          this.emit(
            {
              type: "tool",
              id: call.id,
              name: call.name,
              args,
              result: call.toolResult,
              status: "completed",
              step: index + 1,
            },
            context,
            request,
          );
      }
    }
  }

  /** 诊断摘要优先采用最终文本，否则取最后一条非空步骤文本；仅摘要截断，原始日志不由此改写。 */
  thinkingText(assistantText: string, trace: ToolLoopStepTrace[]): string | null {
    const primary = assistantText.trim();
    if (primary) return primary.length > 1200 ? `${primary.slice(0, 1200)}…` : primary;
    for (let i = trace.length - 1; i >= 0; i--) {
      const text = trace[i]?.assistantText?.trim();
      if (text) return text.length > 1200 ? `${text.slice(0, 1200)}…` : text;
    }
    return null;
  }
}
