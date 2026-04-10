import { COMPONENT } from "../../domain/components/names";
import { RoleComponent } from "../../domain/components/role";
import {
  ActionProvider,
  ActionRequest,
  Camp,
  EntityId,
  Phase,
  PotionType,
  Role,
  ToolCall,
  ToolName,
} from "../../domain/model";
import { World } from "../../domain/world";
import {
  getDefaultRolePromptRegistry,
  getDefaultToolCallRepairRegistry,
  getDefaultToolSpecRegistry,
  RolePromptRegistry,
  ToolCallRepairRegistry,
  ToolSpecRegistry,
} from "../../mechanisms";
import { getIdiotState } from "../../mechanisms/roles/private_state";
import { safeRecordLogicOp, SessionRecordHub } from "../../session_recording";
import { colorize, isAnsiEnabled } from "../../utils/ansi";
import { BaselineBotActionProvider } from "../providers/action_providers";
import {
  buildBoardInfoPrompt,
  buildMustActRetryPrompt,
  buildSystemPrompt,
  buildUserPrompt,
  DEFAULT_SPEAK_TEXT,
  SPEAK_TEXT_FILTER_KEYWORDS,
} from "./prompt_templates";

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
}

interface ToolSchema {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

interface ToolLoopStepTrace {
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

interface BuildMessagesResult {
  messages: ChatMessage[];
  systemPrompt: string;
  userPrompt: string;
  boardInfoPrompt?: string;
  isInitialRound: boolean;
  visibleFeedDelta: string[];
  feedCursorBefore: number;
  feedCursorAfter: number;
  contextWindowStart: number;
  contextWindowEnd: number;
  contextWindowTotal: number;
}

interface ChatLike {
  chat(messages: ChatMessage[], options?: { signal?: AbortSignal }): Promise<string>;
  runToolLoop?<T>(
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

/**
 * LLM 行为提供器配置项。
 */
export interface LlmActionProviderOptions {
  maxPromptEvents?: number;
  trace?: boolean;
  fallbackProvider?: ActionProvider;
  llmTimeoutMs?: number;
  colorizeLogs?: boolean;
  printLlmIo?: boolean;
  printThinking?: boolean;
  toolSpecRegistry?: ToolSpecRegistry;
  rolePromptRegistry?: RolePromptRegistry;
  toolCallRepairRegistry?: ToolCallRepairRegistry;
}

/**
 * 真实 LLM 行为提供器：
 * - 将当前请求上下文转换为 JSON 协议提示词；
 * - 约束模型仅返回允许的工具调用；
 * - 解析失败或越权时自动降级到 fallback，确保对局可推进。
 */
export class LlmActionProvider implements ActionProvider {
  private readonly maxPromptEvents: number;
  private readonly trace: boolean;
  private readonly llmTimeoutMs: number;
  private readonly colorizeLogs: boolean;
  private readonly printLlmIo: boolean;
  private readonly printThinking: boolean;
  private readonly fallbackProvider: ActionProvider;
  private readonly toolSpecRegistry: ToolSpecRegistry;
  private readonly rolePromptRegistry: RolePromptRegistry;
  private readonly toolCallRepairRegistry: ToolCallRepairRegistry;
  private readonly recentEvents: string[] = [];
  private readonly agentHistories = new Map<EntityId, ChatMessage[]>();
  private readonly agentBroadcastCursor = new Map<EntityId, number>();
  private readonly agentContextWindowStart = new Map<EntityId, number>();
  private readonly actorRoundCounter = new Map<EntityId, number>();
  private readonly actorLastAssistantText = new Map<EntityId, string>();

  constructor(
    private readonly world: World,
    private readonly client: ChatLike,
    options: LlmActionProviderOptions = {},
  ) {
    this.maxPromptEvents = options.maxPromptEvents ?? 16;
    this.trace = options.trace ?? false;
    this.llmTimeoutMs = options.llmTimeoutMs ?? 1200;
    this.colorizeLogs = isAnsiEnabled(options.colorizeLogs);
    this.printLlmIo = options.printLlmIo ?? false;
    this.printThinking = options.printThinking ?? false;
    this.toolSpecRegistry = options.toolSpecRegistry ?? getDefaultToolSpecRegistry();
    this.rolePromptRegistry =
      options.rolePromptRegistry ?? getDefaultRolePromptRegistry();
    this.toolCallRepairRegistry =
      options.toolCallRepairRegistry ?? getDefaultToolCallRepairRegistry();
    this.fallbackProvider =
      options.fallbackProvider ?? new BaselineBotActionProvider(world);
  }

  static fromOpenAIClient(
    world: World,
    client: ChatLike,
    options: LlmActionProviderOptions = {},
  ): LlmActionProvider {
    return new LlmActionProvider(world, client, options);
  }

  /**
   * 执行一次动作决策：优先 SDK tool loop，失败时回退基线策略。
   */
  async getAction(request: ActionRequest): Promise<ToolCall | null> {
    const built = this.buildMessages(request);
    const messages = built.messages;
    this.appendTrace(
      `context_window player=${request.actorId} phase=${request.phase} start=${built.contextWindowStart} end=${built.contextWindowEnd} total=${built.contextWindowTotal}`,
    );
    let raw = "";
    const startedAt = Date.now();
    const toToolCalls = (action?: ToolCall | null) =>
      action
        ? [
            {
              name: action.name,
              args: ((action as any).args ?? {}) as Record<string, unknown>,
              accepted: true,
            },
          ]
        : [];
    const toFallbackAction = (action?: ToolCall | null) =>
      action
        ? {
            name: action.name,
            args: ((action as any).args ?? {}) as Record<string, unknown>,
          }
        : undefined;
    const effectiveTimeoutMs = this.computeEffectiveTimeout(request.deadlineAtMs);

    if (effectiveTimeoutMs <= 0) {
      this.appendTrace(
        `request_deadline_skip player=${request.actorId} phase=${request.phase}`,
      );
      const fallback = await this.runFallback(request, "deadline_skip");
      this.recordPlayerRound(request, built, {
        actionMode: fallback ? "tool_call" : "none",
        toolCalls: toToolCalls(fallback),
        finalAction: fallback,
        fallback: {
          used: true,
          reason: "deadline_skip",
          action: toFallbackAction(fallback),
        },
      });
      return fallback;
    }

    try {
      this.appendTrace(
        `request_start player=${request.actorId} phase=${request.phase} tools=${request.allowedTools.join(",")} timeout_ms=${effectiveTimeoutMs}`,
      );
      this.dumpLlmPrompt(messages, request);
      if (this.client.runToolLoop) {
        const runSdkAttempt = async (
          attempt: number,
          attemptMessages: ChatMessage[],
        ): Promise<{
          picked: ToolCall | null;
          failed: boolean;
          errorText?: string;
        }> => {
          try {
            const picked = await this.runSdkToolLoop(
              request,
              attemptMessages,
              effectiveTimeoutMs,
            );
            return { picked, failed: false };
          } catch (error) {
            const errorText = String(error);
            this.appendTrace(
              `request_sdk_attempt_fail player=${request.actorId} phase=${request.phase} attempt=${attempt} err=${errorText}`,
            );
            return { picked: null, failed: true, errorText };
          }
        };

        const firstAttempt = await runSdkAttempt(0, messages);
        const picked = firstAttempt.picked;
        if (picked) {
          this.appendTrace(
            `request_ok player=${request.actorId} phase=${request.phase} action=${picked.name} args=${JSON.stringify(picked.args)} elapsed_ms=${Date.now() - startedAt}`,
          );
          this.recordPlayerRound(request, built, {
            actionMode: "tool_call",
            toolCalls: toToolCalls(picked),
            finalAction: picked,
            thinkingText: this.actorLastAssistantText.get(request.actorId),
          });
          return picked;
        }
        if (this.isMustAct(request)) {
          let hasRuntimeError = firstAttempt.failed;
          let retryMessages = [...messages];
          const maxRetries = 3;
          for (let attempt = 1; attempt <= maxRetries; attempt++) {
            const retryPrompt = this.buildMustActRetryPrompt(attempt, maxRetries);
            retryMessages = [
              ...retryMessages,
              {
                role: "user",
                content: retryPrompt,
              },
            ];
            console.log(
              `[LLM_RETRY] player=${request.actorId} phase=${request.phase} attempt=${attempt}/${maxRetries} reason=must_act_no_valid_action`,
            );
            this.dumpLlmPrompt(retryMessages, request);
            const retryResult = await runSdkAttempt(attempt, retryMessages);
            const retried = retryResult.picked;
            hasRuntimeError = hasRuntimeError || retryResult.failed;
            if (retried) {
              this.appendTrace(
                `request_ok_retry player=${request.actorId} phase=${request.phase} attempt=${attempt}/${maxRetries} action=${retried.name} args=${JSON.stringify(retried.args)} elapsed_ms=${Date.now() - startedAt}`,
              );
              this.recordPlayerRound(request, built, {
                actionMode: "tool_call",
                toolCalls: toToolCalls(retried),
                finalAction: retried,
                thinkingText: this.actorLastAssistantText.get(request.actorId),
              });
              return retried;
            }
          }
          if (hasRuntimeError) {
            const fallback = await this.runFallback(request, "runtime_error");
            this.recordPlayerRound(request, built, {
              actionMode: fallback ? "tool_call" : "none",
              toolCalls: toToolCalls(fallback),
              finalAction: fallback,
              thinkingText: this.actorLastAssistantText.get(request.actorId),
              fallback: {
                used: true,
                reason: "runtime_error",
                action: toFallbackAction(fallback),
              },
            });
            return fallback;
          }
          const fallback = await this.runFallback(
            request,
            "model_declined_required_action",
          );
          this.recordPlayerRound(request, built, {
            actionMode: fallback ? "tool_call" : "none",
            toolCalls: toToolCalls(fallback),
            finalAction: fallback,
            thinkingText: this.actorLastAssistantText.get(request.actorId),
            fallback: {
              used: true,
              reason: "model_declined_required_action",
              action: toFallbackAction(fallback),
            },
          });
          return fallback;
        }
        if (firstAttempt.failed) {
          const fallback = await this.runFallback(request, "runtime_error");
          this.recordPlayerRound(request, built, {
            actionMode: fallback ? "tool_call" : "none",
            toolCalls: toToolCalls(fallback),
            finalAction: fallback,
            thinkingText: this.actorLastAssistantText.get(request.actorId),
            fallback: {
              used: true,
              reason: "runtime_error",
              action: toFallbackAction(fallback),
            },
          });
          return fallback;
        }
        this.appendTrace(
          `request_none player=${request.actorId} phase=${request.phase} elapsed_ms=${Date.now() - startedAt}`,
        );
        this.recordPlayerRound(request, built, {
          actionMode: "none",
          toolCalls: [],
          thinkingText: this.actorLastAssistantText.get(request.actorId),
        });
        return null;
      } else {
        raw = await this.chatWithTimeout(messages, effectiveTimeoutMs);
        this.dumpLlmRawResponse(raw, request);
        const parsed = this.parseToolCall(
          raw,
          request.allowedTools,
          request.actorId,
        );
        if (parsed) {
          this.appendTrace(
            `request_ok player=${request.actorId} phase=${request.phase} action=${parsed.name} args=${JSON.stringify(parsed.args)} elapsed_ms=${Date.now() - startedAt}`,
          );
          this.recordPlayerRound(request, built, {
            actionMode: "tool_call",
            toolCalls: toToolCalls(parsed),
            finalAction: parsed,
            thinkingText: raw,
          });
          return parsed;
        }
        if (this.modelReturnedNone(raw)) {
          if (this.isMustAct(request)) {
            const fallback = await this.runFallback(
              request,
              "model_declined_required_action",
            );
            this.recordPlayerRound(request, built, {
              actionMode: fallback ? "tool_call" : "none",
              toolCalls: toToolCalls(fallback),
              finalAction: fallback,
              thinkingText: raw,
              fallback: {
                used: true,
                reason: "model_declined_required_action",
                action: toFallbackAction(fallback),
              },
            });
            return fallback;
          }
          this.appendTrace(
            `request_none player=${request.actorId} phase=${request.phase} elapsed_ms=${Date.now() - startedAt}`,
          );
          this.recordPlayerRound(request, built, {
            actionMode: "none",
            toolCalls: [],
            thinkingText: raw,
          });
          return null;
        }
        // 若模型已返回结构化 JSON（但工具越权或字段非法），必须走 fallback，
        // 不能被“文本恢复”逻辑改写，否则会绕过 allowedTools 约束。
        if (this.looksLikeStructuredToolJson(raw)) {
          const fallback = await this.runFallback(request, "invalid_tool_json");
          this.recordPlayerRound(request, built, {
            actionMode: fallback ? "tool_call" : "none",
            toolCalls: toToolCalls(fallback),
            finalAction: fallback,
            thinkingText: raw,
            fallback: {
              used: true,
              reason: "invalid_tool_json",
              action: toFallbackAction(fallback),
            },
          });
          return fallback;
        }
        const repaired = this.recoverFromReasoningText(raw, request);
        if (repaired) {
          this.appendTrace(
            `request_ok_repaired player=${request.actorId} phase=${request.phase} action=${repaired.name} args=${JSON.stringify((repaired as any).args ?? {})} elapsed_ms=${Date.now() - startedAt}`,
          );
          this.recordPlayerRound(request, built, {
            actionMode: "text_action",
            toolCalls: toToolCalls(repaired),
            finalAction: repaired,
            thinkingText: raw,
            textAction: {
              text: raw,
              parsed_action: {
                name: repaired.name,
                args: (repaired as any).args ?? {},
              },
            },
          });
          return repaired;
        }
        const fallback = await this.runFallback(request, "non_json_output");
        this.recordPlayerRound(request, built, {
          actionMode: fallback ? "tool_call" : "none",
          toolCalls: toToolCalls(fallback),
          finalAction: fallback,
          thinkingText: raw,
          fallback: {
            used: true,
            reason: "non_json_output",
            action: toFallbackAction(fallback),
          },
        });
        return fallback;
      }
      const fallback = await this.runFallback(request, "non_json_output");
      this.recordPlayerRound(request, built, {
        actionMode: fallback ? "tool_call" : "none",
        toolCalls: toToolCalls(fallback),
        finalAction: fallback,
        fallback: {
          used: true,
          reason: "non_json_output",
          action: toFallbackAction(fallback),
        },
      });
      return fallback;
    } catch (error) {
      const errText = String(error);
      if (errText.includes("llm_request_timeout_")) {
        this.appendTrace(
          `request_timeout player=${request.actorId} phase=${request.phase} elapsed_ms=${Date.now() - startedAt} err=${errText}`,
        );
      } else {
        this.appendTrace(
          `request_transport_fail player=${request.actorId} phase=${request.phase} elapsed_ms=${Date.now() - startedAt} err=${errText}`,
        );
      }
    }

    const fallback = await this.runFallback(request, "runtime_error");
    this.recordPlayerRound(request, built, {
      actionMode: fallback ? "tool_call" : "none",
      toolCalls: toToolCalls(fallback),
      finalAction: fallback,
      fallback: {
        used: true,
        reason: "runtime_error",
        action: toFallbackAction(fallback),
      },
    });
    return fallback;
  }

  /**
   * mustAct 回合未产出有效动作时，返回递进式重试提示词。
   */
  private buildMustActRetryPrompt(attempt: number, maxRetries: number): string {
    return buildMustActRetryPrompt(attempt, maxRetries);
  }

  /**
   * 基于全局截止时间计算当前请求可用超时预算。
   */
  private computeEffectiveTimeout(deadlineAtMs?: number): number {
    if (!deadlineAtMs) {
      return this.llmTimeoutMs;
    }
    // 给后续阶段留一点缓冲，避免临界点抖动导致“刚超时又进入下一次请求”。
    const remainingMs = deadlineAtMs - Date.now() - 40;
    if (remainingMs <= 0) {
      return 0;
    }
    return Math.max(1, Math.min(this.llmTimeoutMs, remainingMs));
  }

  private async runFallback(
    request: ActionRequest,
    reason:
      | "non_json_output"
      | "runtime_error"
      | "deadline_skip"
      | "invalid_tool_json"
      | "model_declined_required_action" = "runtime_error",
  ): Promise<ToolCall | null> {
    // 降级策略：LLM 不可用或输出不合法时，使用基线策略保证对局继续。
    const fallbackAction = await this.fallbackProvider.getAction(request);
    this.dumpFallbackReason(request, reason, fallbackAction);
    safeRecordLogicOp({
      scope: "llm_action_provider",
      op: "llm_fallback",
      actorId: request.actorId,
      phase: request.phase,
      status: fallbackAction ? "fallback" : "error",
      reason,
      output: fallbackAction
        ? {
            action: fallbackAction.name,
            args: (fallbackAction as any).args ?? {},
          }
        : undefined,
    });
    if (fallbackAction) {
      this.appendTrace(
        `request_recovered player=${request.actorId} phase=${request.phase} reason=${reason} fallback=${fallbackAction.name} args=${JSON.stringify((fallbackAction as any).args ?? {})}`,
      );
    } else {
      this.appendTrace(
        `request_dropped player=${request.actorId} phase=${request.phase} reason=${reason}`,
      );
    }
    return fallbackAction;
  }

  /**
   * 输出降级原因日志，便于在非 trace 模式快速定位“为何出现默认兜底动作”。
   */
  private dumpFallbackReason(
    request: ActionRequest,
    reason: string,
    fallbackAction: ToolCall | null,
  ): void {
    const fallbackText = fallbackAction
      ? `${fallbackAction.name} ${JSON.stringify((fallbackAction as any).args ?? {})}`
      : "none";
    console.log(
      `[LLM_FALLBACK] player=${request.actorId} phase=${request.phase} reason=${reason} mustAct=${this.isMustAct(request)} allowedTools=${request.allowedTools.join(",")} fallback=${fallbackText}`,
    );
  }

  private async chatWithTimeout(
    messages: ChatMessage[],
    timeoutMs: number,
  ): Promise<string> {
    const controller = new AbortController();
    let timer: NodeJS.Timeout | null = null;
    try {
      return await Promise.race<string>([
        this.client.chat(messages, { signal: controller.signal }),
        new Promise<string>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new Error(`llm_request_timeout_${timeoutMs}ms`));
          }, timeoutMs);
        }),
      ]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  private async runSdkToolLoop(
    request: ActionRequest,
    messages: ChatMessage[],
    timeoutMs: number,
  ): Promise<ToolCall | null> {
    if (!this.client.runToolLoop) {
      return null;
    }
    const controller = new AbortController();
    let timer: NodeJS.Timeout | null = null;
    try {
      const tools = this.buildSdkToolSchemas(
        request.allowedTools,
        this.isMustAct(request),
      );
      const loop = this.client.runToolLoop<ToolCall>(
        messages,
        tools,
        {
          onToolCall: async (invocation) => {
            if (invocation.name === "finish_turn") {
              return {
                toolResult: { ok: true, reason: "turn_finished" },
                stop: true,
              };
            }

            if (!request.allowedTools.includes(invocation.name as ToolName)) {
              return {
                toolResult: {
                  ok: false,
                  error: "tool_not_allowed_in_this_turn",
                },
              };
            }

            const candidate: ToolCall = {
              name: invocation.name as ToolName,
              args: invocation.args as any,
            } as ToolCall;
            const parsed = this.parseToolCall(
              JSON.stringify(candidate),
              request.allowedTools,
              request.actorId,
            );
            if (!parsed) {
              return {
                toolResult: {
                  ok: false,
                  error: "invalid_tool_arguments",
                },
              };
            }

            return {
              toolResult: { ok: true, accepted: true },
              finalAction: parsed,
            };
          },
        },
        {
          signal: controller.signal,
          maxSteps: 8,
          toolChoice: this.isMustAct(request) ? "required" : "auto",
        },
      );

      const withTimeout = Promise.race([
        loop,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new Error(`llm_request_timeout_${timeoutMs}ms`));
          }, timeoutMs);
        }),
      ]);

      const result = await withTimeout;
      if (result.assistantText) {
        this.appendAgentHistory(request.actorId, {
          role: "assistant",
          content: result.assistantText,
        });
      }
      this.actorLastAssistantText.set(request.actorId, result.assistantText ?? "");
      this.dumpThinkingTrace(result.thinkingTrace ?? [], request);
      this.dumpLlmRawResponse(result.assistantText ?? "", request);
      return result.finalAction ?? null;
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  /**
   * 为本回合可用工具构建 SDK 函数调用 schema。
   */
  private buildSdkToolSchemas(
    allowedTools: ToolName[],
    mustAct: boolean,
  ): ToolSchema[] {
    const tools: ToolSchema[] = allowedTools.map((tool) => {
      const schema = this.toolSpecRegistry.getLlmSchema(tool);
      if (schema) {
        return {
          name: schema.name,
          description: schema.description,
          parameters: schema.parameters,
        };
      }
      return {
        name: tool,
        description: "执行该工具动作。",
        parameters: {
          type: "object",
          properties: {},
          additionalProperties: true,
        },
      };
    });
    if (!mustAct) {
      tools.push({
        name: "finish_turn",
        description: "当你决定本回合不再继续行动时调用该工具。",
        parameters: {
          type: "object",
          properties: {},
          description: "空参数对象；调用后表示主动结束本回合。",
          additionalProperties: false,
        },
      });
    }
    return tools;
  }

  /**
   * 将可见广播增量写入对应 agent 的消息历史。
   */
  private ingestBroadcastFeed(request: ActionRequest): {
    delta: string[];
    cursorBefore: number;
    cursorAfter: number;
  } {
    const feed = this.extractBroadcastFeed(request.context);
    if (feed.length === 0) {
      const cursor = this.agentBroadcastCursor.get(request.actorId) ?? 0;
      return {
        delta: [],
        cursorBefore: cursor,
        cursorAfter: cursor,
      };
    }
    const cursor = this.agentBroadcastCursor.get(request.actorId) ?? 0;
    const delta = feed.slice(cursor);
    for (const line of delta) {
      this.appendAgentHistory(request.actorId, {
        role: "user",
        content: `【广播】${line}`,
      });
    }
    this.agentBroadcastCursor.set(request.actorId, feed.length);
    return {
      delta,
      cursorBefore: cursor,
      cursorAfter: feed.length,
    };
  }

  /**
   * 从请求上下文提取广播消息列表。
   */
  private extractBroadcastFeed(context: Record<string, unknown>): string[] {
    const source = context.broadcast_feed ?? context.public_feed;
    if (!Array.isArray(source)) {
      return [];
    }
    return source.map((item) => String(item)).filter(Boolean);
  }

  /**
   * 追加 agent 历史消息并控制上限，避免上下文无限增长。
   */
  private appendAgentHistory(actorId: EntityId, message: ChatMessage): void {
    const history = this.agentHistories.get(actorId) ?? [];
    history.push(message);
    this.agentHistories.set(actorId, history);
  }

  /**
   * 基于“窗口索引”选择本轮送模上下文：
   * - 消息历史全量保留；
   * - 仅窗口切片参与本轮推理。
   */
  private selectHistoryWindow(actorId: EntityId, fullHistory: ChatMessage[]): {
    start: number;
    end: number;
    total: number;
    history: ChatMessage[];
  } {
    const total = fullHistory.length;
    const windowCap = Math.max(1, this.maxPromptEvents * 6);
    const start = Math.max(0, total - windowCap);
    const end = total;
    this.agentContextWindowStart.set(actorId, start);
    return {
      start,
      end,
      total,
      history: fullHistory.slice(start, end),
    };
  }

  /**
   * 组装本轮发送给模型的完整消息序列。
   */
  private buildMessages(request: ActionRequest): BuildMessagesResult {
    const feedDelta = this.ingestBroadcastFeed(request);
    const roleComp = this.world.getComponent<RoleComponent>(request.actorId, COMPONENT.Role);
    const maxPlayerId = this.world.entityIds().length;
    const teammateIds =
      roleComp?.camp !== Camp.Wolf
        ? []
        : this.world
            .getAliveEntityIds()
            .filter((id) => id !== request.actorId)
            .filter((id) => {
              const otherRole = this.world.getComponent<RoleComponent>(id, COMPONENT.Role);
              return otherRole?.camp === roleComp.camp;
            })
            .sort((a, b) => a - b);
    const mustAct = this.isMustAct(request);
    const stageLabel = String(
      request.context.phase ??
        request.actionWindow ??
        request.context.window ??
        request.phase,
    );

    const fullHistory = [...(this.agentHistories.get(request.actorId) ?? [])];
    const contextWindow = this.selectHistoryWindow(request.actorId, fullHistory);
    const history = contextWindow.history;
    const isInitialRound = (this.actorRoundCounter.get(request.actorId) ?? 0) === 0;
    const boardInfoPrompt = isInitialRound ? this.buildBoardInfoPrompt() : undefined;
    const systemPrompt = buildSystemPrompt({
      actorId: request.actorId,
      role: roleComp?.role ?? "unknown",
      maxPlayerId,
      teammateIds,
      allowedTools: request.allowedTools,
      stageDirective: this.stageDirective(request),
      statusDirective: this.statusDirective(request.actorId, roleComp),
      mustAct,
      boardInfoPrompt,
    });

    const userPrompt = buildUserPrompt({
      actorId: request.actorId,
      phase: String(request.phase),
      stage: stageLabel,
      isSpeechTurn:
        request.allowedTools.includes("speak") ||
        request.allowedTools.includes("speak_to_wolves"),
      mustAct,
      allowedTools: request.allowedTools,
      toolArgHints: this.toolArgHints(request.allowedTools),
    });

    const currentTurnUser: ChatMessage = { role: "user", content: userPrompt };
    this.appendAgentHistory(request.actorId, currentTurnUser);

    return {
      messages: [
        { role: "system", content: systemPrompt },
        ...history,
        currentTurnUser,
      ],
      systemPrompt,
      userPrompt,
      ...(boardInfoPrompt ? { boardInfoPrompt } : {}),
      isInitialRound,
      visibleFeedDelta: feedDelta.delta,
      feedCursorBefore: feedDelta.cursorBefore,
      feedCursorAfter: feedDelta.cursorAfter,
      contextWindowStart: contextWindow.start,
      contextWindowEnd: contextWindow.end,
      contextWindowTotal: contextWindow.total,
    };
  }

  private recordPlayerRound(
    request: ActionRequest,
    built: BuildMessagesResult,
    extras: {
      actionMode: "tool_call" | "text_action" | "none";
      toolCalls: Array<{
        id?: string;
        name: string;
        args: Record<string, unknown>;
        accepted?: boolean;
        result?: Record<string, unknown> | string;
      }>;
      thinkingText?: string;
      textAction?: {
        text: string;
        parsed_action?: { name: string; args: Record<string, unknown> };
      };
      finalAction?: ToolCall | null;
      fallback?: {
        used: boolean;
        reason?: string;
        action?: { name: string; args: Record<string, unknown> };
      };
    },
  ): void {
    const recorder = SessionRecordHub.getActive();
    if (!recorder) {
      return;
    }
    const role = this.world.getComponent<RoleComponent>(request.actorId, COMPONENT.Role);
    const prev = this.actorRoundCounter.get(request.actorId) ?? 0;
    const next = prev + 1;
    this.actorRoundCounter.set(request.actorId, next);
    const day = Number(request.context.day ?? request.context.current_day ?? 0);
    const phaseLabel = String(request.phase);
    const stageLabel = String(
      request.context.phase ??
        request.actionWindow ??
        request.context.window ??
        request.phase,
    );
    recorder.recordPlayerRound({
      playerId: request.actorId,
      role: role?.role ?? "unknown",
      camp: role?.camp ?? "unknown",
      day,
      phase: phaseLabel,
      stage: stageLabel,
      requestId: `${day}-${phaseLabel}-${request.actorId}-${next}`,
      timestampMs: Date.now(),
      visibleFeedDelta: built.visibleFeedDelta,
      feedCursorBefore: built.feedCursorBefore,
      feedCursorAfter: built.feedCursorAfter,
      // 复盘时间线仅保留当轮核心送模消息，避免与广播流和历史上下文重复堆叠。
      llmRequestMessages: [
        { role: "system", content: built.systemPrompt },
        { role: "user", content: built.userPrompt },
      ],
      promptSystem: built.systemPrompt,
      ...(built.isInitialRound
        ? {
            initialPromptSystem: built.systemPrompt,
            initialBoardInfo: built.boardInfoPrompt,
          }
        : {}),
      promptUserDelta: [
        `context_window=${built.contextWindowStart}-${built.contextWindowEnd}/${built.contextWindowTotal}`,
        built.userPrompt,
      ],
      thinkingText: extras.thinkingText,
      actionMode: extras.actionMode,
      toolCalls: extras.toolCalls,
      textAction: extras.textAction,
      finalAction: extras.finalAction ?? null,
      fallback: extras.fallback,
    });
  }

  /**
   * 首轮提示词中的板子信息：角色构成 + 技能简介。
   */
  private buildBoardInfoPrompt(): string {
    const counts = new Map<Role, number>();
    for (const id of this.world.entityIds()) {
      const roleComp = this.world.getComponent<RoleComponent>(id, COMPONENT.Role);
      if (!roleComp) {
        continue;
      }
      counts.set(roleComp.role, (counts.get(roleComp.role) ?? 0) + 1);
    }

    return buildBoardInfoPrompt({
      totalPlayers: this.world.entityIds().length,
      roleCounts: counts,
      roleLabel: (role) => this.rolePromptRegistry.label(role),
      roleSkillBrief: (role) => this.rolePromptRegistry.skillBrief(role),
    });
  }

  /**
   * 针对关键子阶段给出强约束指令，减少“狼聊阶段误当投票阶段”等误解。
   */
  private stageDirective(request: ActionRequest): string {
    return (
      this.toolSpecRegistry.getStageDirective(request.allowedTools) ??
      "请严格区分当前阶段职责，只执行本轮工具对应动作。"
    );
  }

  /**
   * 角色运行时状态补充提示：用于减少“已翻牌白痴却自称被投出局”等表述漂移。
   */
  private statusDirective(
    actorId: EntityId,
    roleComp: RoleComponent | undefined,
  ): string | undefined {
    if (!roleComp || roleComp.role !== Role.Idiot) {
      return undefined;
    }
    const idiotState = getIdiotState(roleComp);
    if (!idiotState?.revealed) {
      return undefined;
    }
    return `状态提醒：你已在先前放逐中翻牌为白痴并存活，当前仍在场上发言；你已失去投票权。`;
  }

  /**
   * 生成可用工具参数提示文本。
   */
  private toolArgHints(allowedTools: string[]): string {
    const hints = allowedTools
      .map((name) => this.toolSpecRegistry.getArgHint(name as ToolName))
      .filter((item): item is string => Boolean(item));
    return `工具参数提示=${hints.join("; ")}`;
  }

  private parseToolCall(
    raw: string,
    allowedTools: ActionRequest["allowedTools"],
    actorId: EntityId,
  ): ToolCall | null {
    const json = this.extractJson(raw);
    if (!json) {
      return null;
    }

    let parsed: any;
    try {
      parsed = JSON.parse(json);
    } catch {
      return null;
    }

    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    if (parsed.name === "none") {
      return null;
    }
    if (typeof parsed.name !== "string" || !allowedTools.includes(parsed.name)) {
      return null;
    }
    const rawArgs =
      parsed.args && typeof parsed.args === "object"
        ? (parsed.args as Record<string, unknown>)
        : {};
    const coerced = this.toolCallRepairRegistry.coerceArgs(
      parsed.name as ToolName,
      rawArgs,
      { actorId },
    );
    if (!coerced) {
      return null;
    }
    return {
      name: parsed.name,
      args: coerced as any,
    } as ToolCall;
  }

  /**
   * 从模型原始文本中提取最可能的工具调用 JSON 片段。
   */
  private extractJson(raw: string): string | null {
    const trimmed = raw.trim();
    if (!trimmed) {
      return null;
    }

    const withoutThink = trimmed.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    const candidates = [trimmed, withoutThink];
    for (const text of candidates) {
      // 允许模型偶发输出 ```json ... ```，这里提取代码块内部 JSON。
      const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (fenceMatch?.[1]) {
        const fenced = fenceMatch[1].trim();
        if (fenced.includes('"name"')) {
          return fenced;
        }
      }

      const braceCandidates = this.collectBalancedJsonObjects(text);
      for (const candidate of braceCandidates) {
        if (candidate.includes('"name"') && candidate.includes('"args"')) {
          return candidate;
        }
      }
    }

    return null;
  }

  /**
   * 判断响应是否为结构化工具 JSON（即使内容非法）。
   */
  private looksLikeStructuredToolJson(raw: string): boolean {
    const json = this.extractJson(raw);
    if (!json) {
      return false;
    }
    try {
      const parsed = JSON.parse(json);
      return (
        parsed &&
        typeof parsed === "object" &&
        typeof parsed.name === "string" &&
        parsed.args !== undefined
      );
    } catch {
      return false;
    }
  }

  /**
   * 判断模型是否显式返回 `none`。
   */
  private modelReturnedNone(raw: string): boolean {
    const json = this.extractJson(raw);
    if (!json) {
      return false;
    }
    try {
      const parsed = JSON.parse(json);
      return parsed?.name === "none";
    } catch {
      return false;
    }
  }

  /**
   * 判断当前请求是否必须行动。
   */
  private isMustAct(request: ActionRequest): boolean {
    return request.context.must_act === true;
  }

  /**
   * 收集文本中括号平衡的 JSON 对象候选。
   */
  private collectBalancedJsonObjects(text: string): string[] {
    const out: string[] = [];
    const stack: number[] = [];
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === "{") {
        stack.push(i);
      } else if (ch === "}") {
        const start = stack.pop();
        if (start !== undefined) {
          out.push(text.slice(start, i + 1));
        }
      }
    }
    // 优先返回后出现的对象，通常更接近模型最终答案。
    return out.reverse();
  }

  /**
   * 当模型输出 <think> 或自然语言而非 JSON 时，
   * 尝试按“当前允许工具”进行恢复解析，尽量避免直接判定失败。
   */
  private recoverFromReasoningText(
    raw: string,
    request: ActionRequest,
  ): ToolCall | null {
    const cleaned = raw
      .replace(/<think>/gi, "")
      .replace(/<\/think>/gi, "")
      .replace(/```[\s\S]*?```/g, "")
      .trim();
    if (!cleaned) {
      return null;
    }

    const allowed = request.allowedTools;
    if (allowed.length !== 1) {
      return null;
    }

    return this.toolCallRepairRegistry.recover(
      allowed[0],
      cleaned,
      {
        actorId: request.actorId,
        world: this.world,
        toSpeakText: (text) => this.toSpeakText(text),
      },
    );
  }

  /**
   * 清洗并规范化发言文本，过滤提示词回显污染。
   */
  private toSpeakText(text: string): string {
    const withoutMetaLines = text
      .split(/\r?\n/)
      .filter((line) => {
        const lower = line.trim().toLowerCase();
        if (!lower) {
          return false;
        }
        // 过滤掉模型把提示词原样复述成发言内容的污染行。
        return !SPEAK_TEXT_FILTER_KEYWORDS.some((keyword) =>
          lower.includes(keyword),
        );
      })
      .join(" ");

    const cleaned = withoutMetaLines
      .replace(/<think>/gi, "")
      .replace(/<\/think>/gi, "")
      .replace(/```[\s\S]*?```/g, "")
      .replace(/\{[\s\S]{20,}\}/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const lower = cleaned.toLowerCase();
    const seemsPromptEcho =
      lower.includes("actorid") ||
      lower.includes("allowedtools") ||
      lower.includes("actionwindow") ||
      lower.includes("可用工具") ||
      lower.includes("行动窗口") ||
      lower.includes("阶段上下文") ||
      lower.includes("json") ||
      lower.includes("tool");

    if (!cleaned || cleaned.length < 4 || seemsPromptEcho) {
      return DEFAULT_SPEAK_TEXT;
    }
    return cleaned.slice(0, 120);
  }


  /**
   * 记录并输出 provider 追踪日志。
   */
  private appendTrace(line: string): void {
    this.recentEvents.push(line);
    if (this.recentEvents.length > 80) {
      this.recentEvents.shift();
    }
    if (this.trace) {
      console.log(this.decorateTrace(line));
    }
  }

  /**
   * 按日志类型为 trace 添加颜色与前缀。
   */
  private decorateTrace(line: string): string {
    const prefix = "[LLMActionProvider]";
    if (!this.colorizeLogs) {
      return `${prefix} ${line}`;
    }
    if (line.includes("request_ok")) {
      return `${colorize(prefix, "ok", true)} ${colorize(line, "ok", true)}`;
    }
    if (line.includes("request_recovered")) {
      return `${colorize(prefix, "warn", true)} ${colorize(line, "warn", true)}`;
    }
    if (line.includes("request_timeout")) {
      return `${colorize(prefix, "warn", true)} ${colorize(line, "warn", true)}`;
    }
    if (line.includes("request_transport_fail")) {
      return `${colorize(prefix, "error", true)} ${colorize(line, "error", true)}`;
    }
    if (line.includes("request_start")) {
      return `${colorize(prefix, "info", true)} ${colorize(line, "info", true)}`;
    }
    return `${colorize(prefix, "muted", true)} ${colorize(line, "muted", true)}`;
  }

  /**
   * 在 `printLlmIo` 打开时输出提示词内容。
   */
  private dumpLlmPrompt(messages: ChatMessage[], request: ActionRequest): void {
    if (!this.printLlmIo) {
      return;
    }
    const prefix = colorize("[LLM_IO]", "accent", this.colorizeLogs);
    const marker = `player=${request.actorId} phase=${request.phase}`;
    console.log(`${prefix} prompt_start ${marker}`);
    for (const msg of messages) {
      const roleTag = msg.role === "system" ? "system" : msg.role === "user" ? "user" : "assistant";
      console.log(`${prefix} prompt_${roleTag}: ${msg.content}`);
    }
    console.log(`${prefix} prompt_end ${marker}`);
  }

  /**
   * 在 `printLlmIo` 打开时输出模型原始响应。
   */
  private dumpLlmRawResponse(raw: string, request: ActionRequest): void {
    if (!this.printLlmIo) {
      return;
    }
    const prefix = colorize("[LLM_IO]", "accent", this.colorizeLogs);
    const marker = `player=${request.actorId} phase=${request.phase}`;
    console.log(`${prefix} raw_response_start ${marker}`);
    console.log(`${prefix} raw_response: ${raw}`);
    console.log(`${prefix} raw_response_end ${marker}`);
  }

  private dumpThinkingTrace(
    trace: ToolLoopStepTrace[],
    request: ActionRequest,
  ): void {
    if (!this.printThinking || trace.length === 0) {
      return;
    }
    const prefix = colorize("[THINKING]", "muted", this.colorizeLogs);
    const marker = `player=${request.actorId} phase=${request.phase}`;
    console.log(`${prefix} start ${marker}`);
    for (const [stepIndex, step] of trace.entries()) {
      if (step.assistantText && step.assistantText.trim().length > 0) {
        console.log(
          `${prefix} assistant step=${stepIndex + 1}: ${step.assistantText}`,
        );
      }
      for (const call of step.toolCalls) {
        console.log(
          `${prefix} tool_call step=${stepIndex + 1} id=${call.id} name=${call.name} args=${call.rawArgs}`,
        );
        console.log(
          `${prefix} tool_result step=${stepIndex + 1} id=${call.id} result=${call.toolResult}`,
        );
      }
    }
    console.log(`${prefix} end ${marker}`);
  }
}
