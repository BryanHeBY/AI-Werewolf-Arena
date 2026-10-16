/**
 * 负责描述 Pi 的纯传输输入、输出与内存会话端口。
 * 工具回调只返回候选，领域权限与动作付款仍由上层持有；关闭必须等待底层工作真正结束。
 * text 事件按实际流增量交付，完成标记不重复携带正文；收集不受终端显示开关影响。
 * deadline 由上层调度器的 signal 表达；契约不启动计时器，取消与 close 均须等真实工作结算。
 */
import type { ToolInvocation, ToolLoopCallbacks, ToolSchema } from "../llm/transport";

export interface PiHostConfig {
  models: Record<string, unknown>;
  auth: Record<string, unknown>;
}

export type PiSessionEvent =
  | { type: "thinking" | "message"; text: string; partial: true; blockId: string }
  | { type: "thinking" | "message"; text: ""; partial: false; blockId: string }
  | { type: "tool_start"; id: string; name: string; args: Record<string, unknown> }
  | { type: "tool_end"; id: string; name: string; result: unknown; isError: boolean }
  | {
      type: "retry_start";
      attempt: number;
      maxAttempts: number;
      delayMs: number;
      errorMessage: string;
    }
  | { type: "retry_end"; success: boolean; attempt: number; finalError?: string }
  | { type: "settled"; aborted: boolean };

export interface PiToolTrace extends ToolInvocation {
  toolResult: Record<string, unknown> | string;
  stop: boolean;
  hasFinalAction: boolean;
}

export interface PiPromptResult<T> {
  finalAction: T | null;
  assistantText: string;
  thinkingText: string;
  toolCalls: PiToolTrace[];
  events: PiSessionEvent[];
}

export interface PiPromptOptions<T> extends ToolLoopCallbacks<T> {
  signal?: AbortSignal;
  maxSteps?: number;
  onEvent?: (event: PiSessionEvent) => void;
  /** SDK 在 execute 前拒绝的输入也必须交回领域拒绝计数所有者。 */
  onInvalidToolCall?: (
    invocation: ToolInvocation,
  ) => void | { stop?: boolean } | Promise<void | { stop?: boolean }>;
}

export interface PiSessionOptions {
  settings?: Record<string, unknown>;
  systemPrompt: string;
  tools: ToolSchema[];
}
