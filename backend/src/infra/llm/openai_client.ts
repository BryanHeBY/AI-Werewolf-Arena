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
  temperature?: number;
  maxTokens?: number;
  forceJsonResponse?: boolean;
}

/**
 * 聊天调用可选参数。
 */
export interface ChatOptions {
  signal?: AbortSignal;
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

  constructor(options: OpenAIClientOptions) {
    // 兼容部分网关对 OpenAI SDK 默认 UA 的误拦截：
    // 若不覆写，可能返回 403 "Your request was blocked."。
    const userAgent =
      process.env.OPENAI_USER_AGENT?.trim() || "AWA-Werewolf/1.0";
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
  }

  /**
   * 执行单次聊天请求。
   */
  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
    try {
      const completion = await this.createCompletion(
        messages,
        options.signal,
        this.forceJsonResponse,
      );
      return completion.choices[0]?.message?.content ?? "";
    } catch (error) {
      if (
        this.forceJsonResponse &&
        this.isResponseFormatUnsupported(error)
      ) {
        const completion = await this.createCompletion(messages, options.signal, false);
        return completion.choices[0]?.message?.content ?? "";
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
          tool_choice: options.toolChoice ?? "auto",
        };
        return this.client.chat.completions.create(payload, {
          signal: options.signal,
        });
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
        return {
          finalAction: null,
          assistantText: lastAssistantText,
          thinkingTrace,
        };
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

      return this.client.chat.completions.create(payload, { signal });
    });
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
}
