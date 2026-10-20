/**
 * 负责三种 Agent 共用的私有输出上下文和派发；输入已归一事实，输出带玩家与传输标记的事件。
 * 这里只读上下文，不持 SDK 步骤、会话历史或录制缓冲；显示失败沿原对象交还实际 owner。
 * 生产由装配入口注入 sink；独立使用 provider 时仍保留终端默认适配。
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
import type { PlayerPromptMessage } from "./contracts";

export interface PlayerOutputObserverOptions {
  trace: boolean;
  locale?: Locale;
  colorizeLogs?: boolean;
  printLlmIo: boolean;
  printThinking: boolean;
  transport?: AgentTransport;
  outputSink?: AgentOutputSink;
}

export class PlayerOutputObserver {
  private readonly sink: AgentOutputSink;
  constructor(private readonly options: PlayerOutputObserverOptions) {
    this.sink =
      options.outputSink ?? createAgentConsoleSink({ ...options, color: options.colorizeLogs });
  }
  get locale(): Locale {
    return this.options.locale ?? "zh-CN";
  }
  emit(output: AgentOutput, context: Omit<AgentOutputContext, "transport"> = {}): void {
    this.sink({
      visibility: "private",
      context: { ...context, transport: this.options.transport ?? "llm" },
      output: structuredClone(output),
    });
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
    this.emit({ type: "trace", text: line });
  }
  prompt(messages: PlayerPromptMessage[], request: ActionRequest): void {
    this.emit(
      {
        type: "prompt",
        messages: messages.map((message) => ({ role: message.role, content: message.content })),
      },
      this.context(request),
    );
  }
}
