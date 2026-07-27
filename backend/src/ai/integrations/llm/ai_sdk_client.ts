import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, jsonSchema, type ModelMessage } from "ai";
import { withRetry } from "./retry";

/** 运行时所需的最小消息协议，避免领域层依赖某个 SDK 的消息类型。 */
export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
}

export type LlmProviderType = "openai" | "anthropic";

/** AI SDK provider 与模型配置。`openai` 指任意 OpenAI Chat Completions 兼容网关。 */
export interface AiSdkClientOptions {
  providerType?: LlmProviderType;
  providerName?: string;
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

export interface ChatOptions {
  signal?: AbortSignal;
}

export interface ChatResult {
  content: string;
  finishReason: string;
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

/**
 * AI SDK Core 适配器。
 *
 * 领域层仍只依赖上述最小协议；OpenRouter 等兼容网关走 openai-compatible，
 * Claude 可直接走 Anthropic Messages provider。工具执行仍由领域层回调完成，
 * 因此不会绕过现有的合法性校验、回退和审计记录。
 */
export class AiSdkClient {
  private readonly model: any;
  private readonly temperature: number;
  private readonly maxTokens: number;
  private readonly forceJsonResponse: boolean;
  private readonly providerType: LlmProviderType;
  private readonly providerName: string;
  private readonly reasoningEnabled: boolean;
  private readonly reasoningEffort: "low" | "medium" | "high";
  private readonly thinkingEnabled: boolean;

  constructor(options: AiSdkClientOptions) {
    this.temperature = options.temperature ?? 0.7;
    this.maxTokens = options.maxTokens ?? 1024;
    this.forceJsonResponse = options.forceJsonResponse ?? true;
    this.providerType = options.providerType ?? "openai";
    this.providerName = options.providerName?.trim() || this.providerType;
    this.reasoningEnabled = options.reasoningEnabled ?? true;
    this.reasoningEffort = options.reasoningEffort ?? "medium";
    this.thinkingEnabled = options.thinkingEnabled ?? false;
    const userAgent =
      options.userAgent?.trim() ||
      process.env.OPENAI_USER_AGENT?.trim() ||
      "AWA-Werewolf/1.0";

    if (this.providerType === "anthropic") {
      const provider = createAnthropic({
        apiKey: options.apiKey,
        baseURL: options.baseURL,
        headers: { "User-Agent": userAgent },
        name: this.providerName,
      });
      this.model = provider(options.model);
      return;
    }

    const provider = createOpenAICompatible({
      name: this.providerName,
      apiKey: options.apiKey,
      baseURL: options.baseURL || "https://api.openai.com/v1",
      headers: { "User-Agent": userAgent },
      transformRequestBody: (body) => this.transformOpenAICompatibleRequest(body),
    });
    this.model = provider(options.model);
  }

  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
    return (await this.chatWithMeta(messages, options)).content;
  }

  async chatWithMeta(
    messages: ChatMessage[],
    options: ChatOptions = {},
  ): Promise<ChatResult> {
    const result = await withRetry(() =>
      generateText({
        model: this.model,
        messages: this.toModelMessages(messages),
        allowSystemInMessages: true,
        temperature: this.temperature,
        maxOutputTokens: this.maxTokens,
        abortSignal: options.signal,
        // JSON mode is intentionally not forced here: summaries already validate
        // their JSON at the caller, while OpenAI-compatible gateways vary widely
        // in response_format support. Tool inputs remain schema-constrained below.
      }),
    );
    return { content: result.text, finishReason: result.finishReason };
  }

  async runToolLoop<T>(
    messages: ChatMessage[],
    schemas: ToolSchema[],
    callbacks: ToolLoopCallbacks<T>,
    options: ToolLoopOptions = {},
  ): Promise<{
    finalAction: T | null;
    assistantText: string;
    thinkingTrace: ToolLoopStepTrace[];
  }> {
    let finalAction: T | null = null;
    let stopped = false;
    const traces: ToolLoopStepTrace[] = [];
    const toolDefinitions: Record<string, any> = {};

    for (const schema of schemas) {
      toolDefinitions[schema.name] = {
        description: schema.description,
        inputSchema: jsonSchema(schema.parameters as any),
        execute: async (args: unknown, execution: { toolCallId: string }) => {
          const safeArgs = isRecord(args) ? args : {};
          // AI SDK may finish a step with several calls. Once the domain accepted
          // an action, ignore later calls rather than allowing another mutation.
          if (finalAction !== null || stopped) {
            return { ignored: true, reason: "domain_turn_already_finished" };
          }
          const handled = await callbacks.onToolCall({
            id: execution.toolCallId,
            name: schema.name,
            args: safeArgs,
            rawArgs: JSON.stringify(safeArgs),
          });
          const toolResult = stringifyToolResult(handled.toolResult);
          const current = traces.at(-1);
          current?.toolCalls.push({
            id: execution.toolCallId,
            name: schema.name,
            rawArgs: JSON.stringify(safeArgs),
            toolResult,
            stop: handled.stop === true,
            hasFinalAction: handled.finalAction !== undefined,
          });
          if (handled.finalAction !== undefined) {
            finalAction = handled.finalAction;
          }
          if (handled.stop) {
            stopped = true;
          }
          return handled.toolResult;
        },
      };
    }

    const result = await withRetry(() =>
      generateText({
        model: this.model,
        messages: this.toModelMessages(messages),
        allowSystemInMessages: true,
        temperature: this.temperature,
        maxOutputTokens: this.maxTokens,
        abortSignal: options.signal,
        tools: toolDefinitions,
        toolChoice: options.toolChoice ?? "auto",
        stopWhen: [
          ({ steps }) => finalAction !== null || stopped || steps.length >= (options.maxSteps ?? 6),
        ],
        onStepStart: () => {
          traces.push({
            assistantText: "",
            toolCalls: [],
          });
        },
        onStepFinish: (step) => {
          const current = traces.at(-1);
          if (current) {
            current.assistantText = step.text;
          }
        },
      }),
    );

    return {
      finalAction,
      assistantText: result.steps.at(-1)?.text ?? result.text,
      thinkingTrace: traces,
    };
  }

  private toModelMessages(messages: ChatMessage[]): ModelMessage[] {
    // Existing history deliberately stores only projected, per-player text. Keep
    // tool messages textual because no raw provider tool-call ids are persisted.
    return messages.map((message) => ({
      role: message.role === "tool" ? "user" : message.role,
      content:
        message.role === "tool"
          ? `[上一步工具结果] ${message.content}`
          : message.content,
    })) as ModelMessage[];
  }

  private transformOpenAICompatibleRequest(body: Record<string, any>): Record<string, any> {
    const next = { ...body };
    if (this.reasoningEnabled) {
      next.reasoning = { effort: this.reasoningEffort };
    }
    if (this.thinkingEnabled) {
      next.extra_body = {
        ...(isRecord(next.extra_body) ? next.extra_body : {}),
        thinking: { type: "enabled" },
      };
    }
    return next;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function stringifyToolResult(value: Record<string, unknown> | string): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}
