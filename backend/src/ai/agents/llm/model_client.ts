import { ToolCall } from "../../../core/domain/model";

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
}

export interface ToolSchema {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolLoopStepTrace {
  assistantText: string;
  toolCalls: Array<{
    id: string;
    name: string;
    rawArgs: string;
    toolResult: string;
    stop?: boolean;
    hasFinalAction?: boolean;
  }>;
}

/** LLM transport port shared by the provider and concrete SDK adapters. */
export interface ChatModelClient {
  chat(messages: ChatMessage[], options?: { signal?: AbortSignal }): Promise<string>;
  runToolLoop<T>(
    messages: ChatMessage[],
    tools: ToolSchema[],
    callbacks: {
      onToolCall: (invocation: {
        id: string;
        name: string;
        args: Record<string, unknown>;
        rawArgs: string;
      }) => Promise<{
        toolResult: Record<string, unknown> | string;
        finalAction?: T;
        stop?: boolean;
      }>;
    },
    options?: {
      signal?: AbortSignal;
      maxSteps?: number;
      toolChoice?: "auto" | "required";
    },
  ): Promise<{
    finalAction: T | null;
    assistantText: string;
    thinkingTrace?: ToolLoopStepTrace[];
  }>;
}

export interface BuiltPlayerPrompt {
  messages: ChatMessage[];
  systemPrompt: string;
  userPrompt: string;
  boardInfoPrompt?: string;
  configPrompt?: string;
  isInitialRound: boolean;
  eventCursorBefore: number;
  eventCursorAfter: number;
  contextWindowStart: number;
  contextWindowEnd: number;
  contextWindowTotal: number;
  turnId: string;
  auditMetadata?: string[];
}

export interface LlmRetryTraceEntry {
  attempt: number;
  status: "request_error" | "no_valid_action";
  reason?: string;
  retryPrompt?: string;
  assistantText?: string;
}

export interface ToolLoopActionResult {
  action: ToolCall | null;
  thinkingText?: string;
}

export interface PlayerRoundOutcome {
  actionMode: "tool_call" | "none";
  toolCalls: Array<{
    id?: string;
    name: string;
    args: Record<string, unknown>;
    accepted?: boolean;
    result?: Record<string, unknown> | string;
  }>;
  thinkingText?: string;
  finalAction?: ToolCall | null;
  fallback?: {
    used: boolean;
    reason?: string;
    action?: { name: string; args: Record<string, unknown> };
  };
  retryTrace?: LlmRetryTraceEntry[];
}
