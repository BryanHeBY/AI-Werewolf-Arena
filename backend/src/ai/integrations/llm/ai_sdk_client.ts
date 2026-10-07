import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, jsonSchema, ToolChoiceViolationError, type LanguageModel, type ModelMessage } from "ai";

import {
  ChatMessage,
  ChatModelClient,
  ChatOptions,
  ToolSchema,
  ToolLoopCallbacks,
  ToolLoopOptions,
  ToolLoopStepTrace,
} from "./transport";

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
  reasoningEffort?: string;
  thinkingEnabled?: boolean;
}

export interface ChatResult {
  content: string;
  finishReason: string;
}

/**
 * AI SDK Core 适配器。
 *
 * 领域层依赖 transport 中的最小协议；OpenRouter 等兼容网关走 openai-compatible，
 * Claude 可直接走 Anthropic Messages provider。工具执行仍由领域层回调完成，
 * 因此不会绕过现有的合法性校验、回退和审计记录。
 */
export class AiSdkClient implements ChatModelClient {
  private readonly model: LanguageModel;
  private readonly temperature?: number;
  private readonly maxTokens: number;
  private readonly userAgent: string;
  private readonly providerType: LlmProviderType;
  private readonly providerName: string;
  private readonly reasoningEffort?: string;
  private readonly thinkingEnabled: boolean;

  constructor(options: AiSdkClientOptions) {
    if (options.providerType === "anthropic" && options.thinkingEnabled && options.temperature !== undefined) {
      throw new Error("anthropic_adaptive_thinking_does_not_support_temperature");
    }
    if (options.providerType === "anthropic" && options.reasoningEffort
      && !["low", "medium", "high"].includes(options.reasoningEffort)) {
      throw new Error("anthropic_reasoning_effort_invalid");
    }
    this.temperature = options.temperature;
    this.maxTokens = options.maxTokens ?? 1024;
    this.providerType = options.providerType ?? "openai";
    this.providerName = options.providerName?.trim() || this.providerType;
    this.reasoningEffort = options.reasoningEffort;
    this.thinkingEnabled = options.thinkingEnabled ?? false;
    this.userAgent = options.userAgent?.trim() || "AWA-Werewolf/1.0";

    if (this.providerType === "anthropic") {
      const provider = createAnthropic({
        apiKey: options.apiKey,
        baseURL: options.baseURL,
        name: this.providerName,
      });
      this.model = provider(options.model);
      return;
    }

    const provider = createOpenAICompatible({
      name: this.providerName,
      apiKey: options.apiKey,
      baseURL: options.baseURL || "https://api.openai.com/v1",
      transformRequestBody: this.thinkingEnabled
        ? (body) => this.transformOpenAICompatibleRequest(body)
        : undefined,
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
    const result = await generateText({
      model: this.model,
      messages: this.toModelMessages(messages),
      allowSystemInMessages: true,
      temperature: this.temperature,
      maxOutputTokens: this.maxTokens,
      providerOptions: this.getProviderOptions(),
      headers: { "user-agent": this.userAgent },
      maxRetries: 3,
      abortSignal: options.signal,
      // Summaries validate their own JSON. Tool inputs use schemas below.
    });
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

    const result = await generateText({
      model: this.model,
      messages: this.toModelMessages(messages),
      allowSystemInMessages: true,
      temperature: this.temperature,
      maxOutputTokens: this.maxTokens,
      providerOptions: this.getProviderOptions(),
      headers: { "user-agent": this.userAgent },
      maxRetries: 3,
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
    }).catch((error: unknown) => {
      // AI SDK 7 rejects text-only responses to required tool choice. They are
      // model non-actions, so preserve the output and let the game retry policy
      // handle them. Transport and other SDK errors still propagate.
      if (!ToolChoiceViolationError.isInstance(error)) throw error;
      const text = error.content
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("");
      const current = traces.at(-1);
      if (current) current.assistantText = text;
      return null;
    });

    return {
      finalAction,
      assistantText: result?.steps.at(-1)?.text ?? result?.text ?? traces.at(-1)?.assistantText ?? "",
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
          ? `[tool_result] ${message.content}`
          : message.content,
    })) as ModelMessage[];
  }

  private getProviderOptions() {
    if (this.providerType === "anthropic") {
      if (!this.reasoningEffort && !this.thinkingEnabled) return undefined;
      return {
        [this.providerName]: {
          ...(this.reasoningEffort ? { effort: this.reasoningEffort } : {}),
          ...(this.thinkingEnabled ? { thinking: { type: "adaptive" } } : {}),
        },
      };
    }
    if (!this.reasoningEffort) return undefined;
    const optionKey = this.providerName.replace(/[-_]([a-z0-9])/g, (_, letter: string) => letter.toUpperCase());
    return { [optionKey]: { reasoningEffort: this.reasoningEffort } };
  }

  private transformOpenAICompatibleRequest(body: Record<string, any>): Record<string, any> {
    return {
      ...body,
      extra_body: {
        ...(isRecord(body.extra_body) ? body.extra_body : {}),
        thinking: { type: "enabled" },
      },
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function stringifyToolResult(value: Record<string, unknown> | string): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}
