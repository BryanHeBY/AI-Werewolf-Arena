import OpenAI from "openai";
import { withRetry } from "./retry";

/**
 * 聊天消息结构。
 */
export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
}

/**
 * OpenAI 客户端配置。
 */
export interface OpenAIClientOptions {
  apiKey: string;
  baseURL?: string;
  model: string;
  userAgent?: string;
  temperature?: number;
  maxTokens?: number;
  forceJsonResponse?: boolean;
  reasoningEnabled?: boolean;
  reasoningEffort?: "low" | "medium" | "high";
  thinkingEnabled?: boolean;
}

/**
 * 聊天调用可选参数。
 */
export interface ChatOptions {
  signal?: AbortSignal;
}

/**
 * 聊天返回结构（包含 finish_reason 便于上层判断是否正常结束）。
 */
export interface ChatResult {
  content: string;
  finishReason: string;
}

/**
 * 工具 schema 定义。
 */
export interface ToolSchema {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/**
 * 工具调用实例。
 */
export interface ToolInvocation {
  id: string;
  name: string;
  args: Record<string, unknown>;
  rawArgs: string;
}

/**
 * 工具循环回调集合。
 */
export interface ToolLoopCallbacks<T> {
  onToolCall: (invocation: ToolInvocation) => Promise<{
    toolResult: Record<string, unknown> | string;
    finalAction?: T;
    stop?: boolean;
  }>;
}

/**
 * 工具循环可选参数。
 */
export interface ToolLoopOptions extends ChatOptions {
  maxSteps?: number;
  toolChoice?: "auto" | "required";
}

/**
 * 单步工具循环追踪信息。
 */
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

/**
 * OpenAI SDK 适配器：
 * 对外暴露最小 chat 能力，并统一接入重试策略。
 */
export class OpenAIClient {
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly temperature: number;
  private readonly maxTokens: number;
  private readonly forceJsonResponse: boolean;
  private readonly reasoningEnabled: boolean;
  private readonly reasoningEffort: "low" | "medium" | "high";
  private readonly thinkingEnabled: boolean;
  private reasoningSupported: boolean;

  constructor(options: OpenAIClientOptions) {
    // 兼容部分网关对 OpenAI SDK 默认 UA 的误拦截：
    // 若不覆写，可能返回 403 "Your request was blocked."。
    const userAgent =
      options.userAgent?.trim() ||
      process.env.OPENAI_USER_AGENT?.trim() ||
      "AWA-Werewolf/1.0";
    this.client = new OpenAI({
      apiKey: options.apiKey,
      baseURL: options.baseURL,
      defaultHeaders: {
        "User-Agent": userAgent,
      },
    });
    this.model = options.model;
    this.temperature = options.temperature ?? 0.7;
    this.maxTokens = options.maxTokens ?? 1024;
    this.forceJsonResponse = options.forceJsonResponse ?? true;
    this.reasoningEnabled = options.reasoningEnabled ?? true;
    this.reasoningEffort = options.reasoningEffort ?? "medium";
    this.thinkingEnabled = options.thinkingEnabled ?? false;
    this.reasoningSupported = this.reasoningEnabled;
  }

  /**
   * 执行单次聊天请求。
   */
  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
    const result = await this.chatWithMeta(messages, options);
    return result.content;
  }

  /**
   * 执行单次聊天请求并返回 finish_reason 元信息。
   */
  async chatWithMeta(
    messages: ChatMessage[],
    options: ChatOptions = {},
  ): Promise<ChatResult> {
    try {
      const completion = await this.createCompletion(
        messages,
        options.signal,
        this.forceJsonResponse,
      );
      return {
        content: completion.choices[0]?.message?.content ?? "",
        finishReason: String(completion.choices[0]?.finish_reason ?? ""),
      };
    } catch (error) {
      if (
        this.forceJsonResponse &&
        this.isResponseFormatUnsupported(error)
      ) {
        const completion = await this.createCompletion(messages, options.signal, false);
        return {
          content: completion.choices[0]?.message?.content ?? "",
          finishReason: String(completion.choices[0]?.finish_reason ?? ""),
        };
      }
      throw error;
    }
  }

  async runToolLoop<T>(
    messages: ChatMessage[],
    tools: ToolSchema[],
    callbacks: ToolLoopCallbacks<T>,
    options: ToolLoopOptions = {},
  ): Promise<{
    finalAction: T | null;
    assistantText: string;
    thinkingTrace: ToolLoopStepTrace[];
  }> {
    const maxSteps = options.maxSteps ?? 6;
    const convo: any[] = messages.map((msg) => {
      const base: any = {
        role: msg.role,
        content: msg.content,
      };
      if (msg.role === "tool" && msg.tool_call_id) {
        base.tool_call_id = msg.tool_call_id;
      }
      return base;
    });

    let lastAssistantText = "";
    const thinkingTrace: ToolLoopStepTrace[] = [];
    for (let step = 0; step < maxSteps; step++) {
      const completion = await withRetry(async () => {
        const preferredToolChoice = options.toolChoice ?? "auto";
        const payload: any = {
          model: this.model,
          temperature: this.temperature,
          max_tokens: this.maxTokens,
          messages: convo,
          tools: tools.map((tool) => ({
            type: "function",
            function: {
              name: tool.name,
              description: tool.description,
              parameters: tool.parameters,
            },
          })),
          tool_choice: preferredToolChoice,
        };
        this.attachReasoningPayload(payload);
        this.attachThinkingPayload(payload);
        return this.createChatCompletionWithToolChoiceFallback(
          payload,
          { signal: options.signal },
          preferredToolChoice,
        );
      });

      const message: any = completion.choices?.[0]?.message ?? {};
      lastAssistantText = String(message.content ?? "");
      const toolCalls: any[] = Array.isArray(message.tool_calls) ? message.tool_calls : [];
      const stepTrace: ToolLoopStepTrace = {
        assistantText: lastAssistantText,
        toolCalls: [],
      };
      thinkingTrace.push(stepTrace);

      if (toolCalls.length === 0) {
        // 仅“当前一步无工具调用”不应直接判定业务回合结束；
        // 继续在同一轮工具循环中推进，等待后续步骤给出结构化调用。
        convo.push({
          role: "assistant",
          content: message.content ?? "",
        });
        continue;
      }

      convo.push({
        role: "assistant",
        content: message.content ?? "",
        tool_calls: toolCalls,
      });

      for (const toolCall of toolCalls) {
        const id = String(toolCall.id ?? "");
        const name = String(toolCall.function?.name ?? "");
        const rawArgs = String(toolCall.function?.arguments ?? "{}");
        let args: Record<string, unknown> = {};
        try {
          const parsed = JSON.parse(rawArgs);
          args =
            parsed && typeof parsed === "object" && !Array.isArray(parsed)
              ? parsed
              : {};
        } catch {
          args = {};
        }

        const handled = await callbacks.onToolCall({
          id,
          name,
          rawArgs,
          args,
        });
        stepTrace.toolCalls.push({
          id,
          name,
          rawArgs,
          toolResult:
            typeof handled.toolResult === "string"
              ? handled.toolResult
              : JSON.stringify(handled.toolResult),
          stop: handled.stop === true,
          hasFinalAction: handled.finalAction !== undefined,
        });
        convo.push({
          role: "tool",
          tool_call_id: id,
          content:
            typeof handled.toolResult === "string"
              ? handled.toolResult
              : JSON.stringify(handled.toolResult),
        });

        if (handled.finalAction !== undefined) {
          return {
            finalAction: handled.finalAction,
            assistantText: lastAssistantText,
            thinkingTrace,
          };
        }
        if (handled.stop) {
          return {
            finalAction: null,
            assistantText: lastAssistantText,
            thinkingTrace,
          };
        }
      }
    }

    return { finalAction: null, assistantText: lastAssistantText, thinkingTrace };
  }

  private async createCompletion(
    messages: ChatMessage[],
    signal: AbortSignal | undefined,
    forceJsonResponse: boolean,
  ) {
    return withRetry(async () => {
      const payload: any = {
        model: this.model,
        temperature: this.temperature,
        max_tokens: this.maxTokens,
        messages,
      };
      if (forceJsonResponse) {
        payload.response_format = { type: "json_object" };
      }
      this.attachReasoningPayload(payload);
      this.attachThinkingPayload(payload);
      return this.createChatCompletionWithReasoningFallback(payload, { signal });
    });
  }

  private attachReasoningPayload(payload: Record<string, unknown>): void {
    if (!this.reasoningEnabled || !this.reasoningSupported) {
      return;
    }
    payload.reasoning = { effort: this.reasoningEffort };
  }

  private attachThinkingPayload(payload: Record<string, unknown>): void {
    if (!this.thinkingEnabled) {
      return;
    }
    const rawExtraBody = payload.extra_body;
    const extraBody =
      rawExtraBody && typeof rawExtraBody === "object"
        ? (rawExtraBody as Record<string, unknown>)
        : {};
    payload.extra_body = {
      ...extraBody,
      thinking: { type: "enabled" },
    };
  }

  private async createChatCompletionWithReasoningFallback(
    payload: any,
    options: { signal?: AbortSignal },
  ) {
    try {
      return await this.client.chat.completions.create(payload, options);
    } catch (error) {
      if (
        this.reasoningSupported &&
        payload.reasoning &&
        this.isReasoningUnsupported(error)
      ) {
        this.reasoningSupported = false;
        console.warn(
          `[openai_client] reasoning parameter unsupported by current gateway/model; fallback to non-reasoning requests (model=${this.model}, effort=${this.reasoningEffort})`,
        );
        const downgradedPayload = { ...payload };
        delete downgradedPayload.reasoning;
        return this.client.chat.completions.create(downgradedPayload, options);
      }
      throw error;
    }
  }

  /**
   * 某些网关在“thinking 模式”下不接受 tool_choice=required。
   * 这里做一次自动降级，避免上层必须按 provider 写分支。
   */
  private async createChatCompletionWithToolChoiceFallback(
    payload: any,
    options: { signal?: AbortSignal },
    preferredToolChoice: "auto" | "required",
  ) {
    try {
      return await this.createChatCompletionWithReasoningFallback(payload, options);
    } catch (error) {
      if (
        preferredToolChoice === "required" &&
        this.isToolChoiceRequiredUnsupported(error)
      ) {
        console.warn(
          `[openai_client] tool_choice=required unsupported by current gateway/model; fallback to tool_choice=auto (model=${this.model})`,
        );
        const downgradedPayload = { ...payload, tool_choice: "auto" };
        return this.createChatCompletionWithReasoningFallback(
          downgradedPayload,
          options,
        );
      }
      throw error;
    }
  }

  /**
   * 判断错误是否为 response_format 不兼容导致。
   */
  private isResponseFormatUnsupported(error: unknown): boolean {
    const text = String(error).toLowerCase();
    return (
      text.includes("response_format") &&
      (text.includes("unsupported") ||
        text.includes("unknown") ||
        text.includes("not support") ||
        text.includes("invalid"))
    );
  }

  /**
   * 判断错误是否由网关/模型不支持 reasoning 参数导致。
   */
  private isReasoningUnsupported(error: unknown): boolean {
    const text = String(error).toLowerCase();
    return (
      text.includes("reasoning") &&
      (text.includes("unsupported") ||
        text.includes("unknown") ||
        text.includes("not support") ||
        text.includes("invalid"))
    );
  }

  /**
   * 判断错误是否由 tool_choice=required 不兼容导致。
   */
  private isToolChoiceRequiredUnsupported(error: unknown): boolean {
    const text = String(error).toLowerCase();
    return (
      text.includes("tool_choice") &&
      text.includes("required") &&
      (text.includes("not support") ||
        text.includes("does not support") ||
        text.includes("invalidparameter") ||
        text.includes("invalid parameter") ||
        text.includes("invalid"))
    );
  }
}
