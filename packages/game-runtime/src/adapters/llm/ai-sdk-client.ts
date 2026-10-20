/**
 * 负责将 AI SDK 的网络文本／工具生成适配到游戏与审计共用传输契约。
 * 输入为已解析 provider 配置、调用方消息、工具 schema 和领域回调；输出文本、结束原因、步骤记录与拒绝工具索引。
 * 取消只透传调用方 AbortSignal，期限与计时器由上层管理；每次生成仍用原 SDK 重试预算和工具步数政策。
 * 工具合法性、重复提交、原体与库存写权由领域回调拥有；本适配器不打开游戏窗口或提交领域动作。
 * 仅工具选择违规保留文本交上层重试，其它网络／SDK 异常传播；回调或编码失败不回滚已经发生的效果。
 */
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import {
  generateText,
  jsonSchema,
  ToolChoiceViolationError,
  type LanguageModel,
  type ModelMessage,
} from "ai";

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
  /** 私有传输依赖用于本机注入；不属于可序列化运行配置字段。 */
  fetch?: typeof fetch;
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

  /** 在创建 provider 前检查原 Anthropic 参数冲突；构造只装配模型依赖，不建立新的回合期限。 */
  constructor(options: AiSdkClientOptions) {
    if (
      options.providerType === "anthropic" &&
      options.thinkingEnabled &&
      options.temperature !== undefined
    ) {
      throw new Error("anthropic_adaptive_thinking_does_not_support_temperature");
    }
    if (
      options.providerType === "anthropic" &&
      options.reasoningEffort &&
      !["low", "medium", "high"].includes(options.reasoningEffort)
    ) {
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
        fetch: options.fetch,
      });
      this.model = provider(options.model);
      return;
    }

    const provider = createOpenAICompatible({
      name: this.providerName,
      apiKey: options.apiKey,
      fetch: options.fetch,
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

  async chatWithMeta(messages: ChatMessage[], options: ChatOptions = {}): Promise<ChatResult> {
    const result = await generateText({
      model: this.model,
      messages: this.toModelMessages(messages),
      allowSystemInMessages: true,
      temperature: this.temperature,
      maxOutputTokens: this.maxTokens,
      providerOptions: this.getProviderOptions(),
      headers: { "user-agent": this.userAgent },
      maxRetries: options.maxRetries ?? 3,
      abortSignal: options.signal,
      // 摘要调用方自行校验结果JSON；本普通文本调用不套用下方工具输入schema。
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
    failedToolInvocations: Array<{ name: string; id: string }>;
  }> {
    let finalAction: T | null = null;
    let stopped = false;
    // 每次调用独立持有传输记录；finalAction只是领域回调给出的候选，不代表已付款或已应用。
    const traces: ToolLoopStepTrace[] = [];
    const failedToolInvocations: Array<{ name: string; id: string }> = [];
    const toolDefinitions: Record<string, any> = {};

    // 按工具名建当前SDK索引；同名后项仍覆盖前项，不新增注册或重复命名拒绝政策。
    for (const schema of schemas) {
      toolDefinitions[schema.name] = {
        description: schema.description,
        inputSchema: jsonSchema(schema.parameters as any),
        execute: async (args: unknown, execution: { toolCallId: string }) => {
          const safeArgs = isRecord(args) ? args : {};
          // 重复候选由领域回合所有者拒绝；这里只在回调明确stop后拦截后续执行。
          // 返回finalAction本身不会置stopped，后续SDK调用仍须经过原领域回调。
          if (stopped) {
            return { ignored: true, reason: "domain_turn_already_finished" };
          }
          const handled = await callbacks.onToolCall({
            id: execution.toolCallId,
            name: schema.name,
            args: safeArgs,
            rawArgs: JSON.stringify(safeArgs),
          });
          // 回调先完成，再编码结果并写追踪；编码失败保留回调效果，不写后续候选或停止标记。
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
          // 保原null哨兵：仅当前值为null时接纳回调候选，不在传输层重新验证或应用动作。
          if (handled.finalAction !== undefined && finalAction === null) {
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
      // 以已有候选、明确stop或原步数预算停止；取消及最早期限仍来自上层signal。
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
        // SDK输入拒绝可能未执行工具回调；仅记工具名和ID，不复制原输入或错误对象。
        for (const call of step.toolCalls)
          if ("invalid" in call && call.invalid === true)
            failedToolInvocations.push({ name: call.toolName, id: call.toolCallId });
        const current = traces.at(-1);
        if (current) {
          current.assistantText = step.text;
        }
      },
    }).catch((error: unknown) => {
      // required工具选择下的纯文本被SDK拒绝时，保留文本作为未行动证据交上层重试。
      // 只捕获该具名错误；其它传输／SDK失败仍原样抛出，不清空已有候选或回调效果。
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
      assistantText:
        result?.steps.at(-1)?.text ?? result?.text ?? traces.at(-1)?.assistantText ?? "",
      thinkingTrace: traces,
      failedToolInvocations,
    };
  }

  private toModelMessages(messages: ChatMessage[]): ModelMessage[] {
    // 消息正文保调用方原文本；此映射不把tool_call_id填入provider消息，也不自行过滤玩家可见性。
    // tool项沿原协议降为带前缀的user文本，不凭这些文字重建provider调用关系。
    return messages.map((message) => ({
      role: message.role === "tool" ? "user" : message.role,
      content: message.role === "tool" ? `[tool_result] ${message.content}` : message.content,
    })) as ModelMessage[];
  }

  /** Anthropic与兼容网关各按原名称键传参数；不自动推测模型能力或改变调用方配置。 */
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
    const optionKey = this.providerName.replace(/[-_]([a-z0-9])/g, (_, letter: string) =>
      letter.toUpperCase(),
    );
    return { [optionKey]: { reasoningEffort: this.reasoningEffort } };
  }

  /** 原顶层字段与已有extra_body先保留，再覆盖thinking；只在构造时启用的兼容provider上调用。 */
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

/** 字符串保持原文，记录用JSON编码；异常交原调用链，不替换成假成功工具结果。 */
function stringifyToolResult(value: Record<string, unknown> | string): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}
