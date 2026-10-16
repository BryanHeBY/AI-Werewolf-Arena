/**
 * 将编排器的提示、回应、工具和生命周期事实转换为共同私有输出，不包含终端格式或颜色。
 * 生产运行由入口注入输出端；直接使用 provider 时保留默认终端适配，显示错误仍交还调用方。
 * 原始模型与工具数据保持原文，输出端不会取得回合许可或改变行动接收结果。
 */
import type { Locale } from "@ai-werewolf-arena/game-text";
import type {
  AgentOutput,
  AgentOutputContext,
  AgentOutputSink,
  AgentTransport,
} from "@ai-werewolf-arena/replay-contract";
import type { ActionRequest } from "../../domain";
import { createAgentConsoleSink } from "../../adapters/console/agent-console-presenter";
import type { ChatMessage, ToolLoopStepTrace } from "../../adapters/llm/transport";

export interface LlmObserverOptions {
  trace: boolean;
  locale?: Locale;
  colorizeLogs?: boolean;
  printLlmIo: boolean;
  printThinking: boolean;
  transport?: AgentTransport;
  outputSink?: AgentOutputSink;
}

export class LlmObserver {
  private readonly recentEvents: string[] = [];
  // 仅 SDK 路径在完成记录时取走当轮事实；弱键不把请求或完整会话历史变成第二份持久状态。
  private readonly roundOutputs = new WeakMap<ActionRequest, AgentOutput[]>();
  private readonly sink: AgentOutputSink;
  constructor(private readonly options: LlmObserverOptions) {
    this.sink =
      options.outputSink ?? createAgentConsoleSink({ ...options, color: options.colorizeLogs });
  }
  get locale(): Locale {
    return this.options.locale ?? "zh-CN";
  }
  emit(
    output: AgentOutput,
    context: Omit<AgentOutputContext, "transport"> = {},
    request?: ActionRequest,
  ): void {
    if (
      request &&
      (this.options.transport ?? "llm") === "llm" &&
      ["text", "tool", "raw_response"].includes(output.type)
    ) {
      const outputs = this.roundOutputs.get(request) ?? [];
      outputs.push(structuredClone(output));
      this.roundOutputs.set(request, outputs);
    }
    this.sink({
      visibility: "private",
      context: { ...context, transport: this.options.transport ?? "llm" },
      output: structuredClone(output),
    });
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
  context(request: ActionRequest): Omit<AgentOutputContext, "transport"> {
    return {
      playerId: request.actorId,
      phase: request.phase,
      day: request.context.day,
      stage: request.context.stage,
    };
  }
  trace(line: string): void {
    this.recentEvents.push(line);
    if (this.recentEvents.length > 80) this.recentEvents.shift();
    this.emit({ type: "trace", text: line });
  }
  prompt(messages: ChatMessage[], request: ActionRequest): void {
    this.emit(
      {
        type: "prompt",
        messages: messages.map((message) => ({ role: message.role, content: message.content })),
      },
      this.context(request),
      request,
    );
  }
  rawResponse(raw: string, request: ActionRequest): void {
    this.emit({ type: "raw_response", text: raw }, this.context(request), request);
  }
  thinking(trace: ToolLoopStepTrace[], request: ActionRequest): void {
    const context = this.context(request);
    for (const [index, step] of trace.entries()) {
      if (step.assistantText?.trim())
        this.emit(
          { type: "text", channel: "output", text: step.assistantText, step: index + 1 },
          context,
          request,
        );
      for (const call of step.toolCalls) {
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
        this.emit(
          {
            type: "tool",
            id: call.id,
            name: call.name,
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
