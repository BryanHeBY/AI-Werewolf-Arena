/**
 * 负责定义游戏与审计共用的聊天／工具传输数据契约，供 SDK 适配器与上层 loop 消费。
 * 输入为文本消息、工具schema、回调及取消signal；输出为候选、文本步骤和拒绝工具的名称／ID。
 * 本文件仅定义类型，不执行网络、工具或会话关闭；期限计时、取消传播、领域权限各由实际调用方负责。
 * 传输记录不是领域库存、原体许可或统一归档格式，工具结果也不等于游戏动作已应用。
 */
/** tool_call_id保留为可选兼容字段；具体SDK适配仍将tool项转成带前缀的文本。 */
export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
}

export interface ChatOptions {
  signal?: AbortSignal;
  /** 普通文本探测可关闭重试；省略时保留既有游戏／审计预算。 */
  maxRetries?: number;
}

export interface ToolSchema {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/** args与其原JSON文本供回调处理；不能据此绕过领域schema、turn或当前性检查。 */
export interface ToolInvocation {
  id: string;
  name: string;
  args: Record<string, unknown>;
  rawArgs: string;
}

/** 回调拥有工具处理；候选与明确stop分开返回，领域动作的应用仍由具体所有者决定。 */
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

/** 每个生成步骤的文本／工具记录，字段名沿原协议；不表示所有provider的隐藏思考内容。 */
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
  /** SDK输入拒绝可能先于执行回调；这里只记录工具名／ID，不复制原输入或错误。 */
  failedToolInvocations?: Array<{ name: string; id: string }>;
}

/** 游戏与审计Agent共用工具执行端口；权限和具体工具副作用仍由各自回调负责。 */
export interface ToolLoopClient {
  runToolLoop<T>(
    messages: ChatMessage[],
    tools: ToolSchema[],
    callbacks: ToolLoopCallbacks<T>,
    options?: ToolLoopOptions,
  ): Promise<ToolLoopResult<T>>;
}

/** SDK游戏Agent需要的聊天能力；工具调用返回文本字段必填，不增加领域行动写权。 */
export interface ChatModelClient extends ToolLoopClient {
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<string>;
  runToolLoop<T>(
    messages: ChatMessage[],
    tools: ToolSchema[],
    callbacks: ToolLoopCallbacks<T>,
    options?: ToolLoopOptions,
  ): Promise<ToolLoopResult<T> & { assistantText: string }>;
}
