export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
}

export interface ChatOptions {
  signal?: AbortSignal;
}

export interface ToolSchema {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolInvocation {
  id: string;
  name: string;
  args: Record<string, unknown>;
  rawArgs: string;
}

export interface ToolLoopCallbacks<T> {
  onToolCall: (invocation: ToolInvocation) => Promise<{
    toolResult: Record<string, unknown> | string;
    finalAction?: T;
    stop?: boolean;
  }>;
}

export interface ToolLoopOptions extends ChatOptions {
  maxSteps?: number;
  toolChoice?: "auto" | "required";
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

export interface ToolLoopResult<T> {
  finalAction: T | null;
  assistantText?: string;
  thinkingTrace?: ToolLoopStepTrace[];
}

/** Tool execution port shared by game and audit agents. */
export interface ToolLoopClient {
  runToolLoop<T>(
    messages: ChatMessage[],
    tools: ToolSchema[],
    callbacks: ToolLoopCallbacks<T>,
    options?: ToolLoopOptions,
  ): Promise<ToolLoopResult<T>>;
}

/** Chat-capable transport required by the SDK-backed game agent. */
export interface ChatModelClient extends ToolLoopClient {
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<string>;
  runToolLoop<T>(
    messages: ChatMessage[],
    tools: ToolSchema[],
    callbacks: ToolLoopCallbacks<T>,
    options?: ToolLoopOptions,
  ): Promise<ToolLoopResult<T> & { assistantText: string }>;
}
