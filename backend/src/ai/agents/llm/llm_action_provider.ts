import { COMPONENT } from "../../../core/domain/components/names";
import { RoleComponent } from "../../../core/domain/components/role";
import {
  ActionProvider,
  ActionRequest,
  BoardConfig,
  Camp,
  EntityId,
  Phase,
  PotionType,
  Role,
  ToolCall,
  ToolName,
} from "../../../core/domain/model";
import { World } from "../../../core/domain/world";
import {
  getDefaultTargetHintRegistry,
  getDefaultRolePromptRegistry,
  getDefaultConfigRenderRegistry,
  getDefaultToolCallRepairRegistry,
  getDefaultToolSpecRegistry,
  ConfigRenderRegistry,
  RolePromptRegistry,
  TargetHintRegistry,
  ToolCallRepairRegistry,
  ToolSpecRegistry,
  ToolValidationRuleRegistry,
  PhaseStageLocalizationRegistry,
  getDefaultPhaseStageLocalizationRegistry,
  getDefaultToolValidationRuleRegistry,
} from "../../../game/mechanisms";
import { getIdiotState } from "../../../game/mechanisms/roles/private_state";
import { safeRecordLogicOp, SessionRecordHub } from "../../../observability";
import { colorize, isAnsiEnabled } from "../../../utils/ansi";
import { BaselineBotActionProvider } from "../providers/action_providers";
import {
  buildBoardInfoPrompt,
  buildConstraintRetryPrompt,
  buildSystemPrompt,
  buildUserPrompt,
  DEFAULT_SPEAK_TEXT,
  SPEAK_TEXT_FILTER_KEYWORDS,
} from "./prompt_templates";
import {
  evaluateTurnConstraints,
  renderTurnConstraintUserHint,
  resolveTurnConstraints,
} from "./turn_constraints";
import { ActionValidationService } from "./action_validation_service";

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

type DebugBugCategory = "flow" | "rule" | "state" | "logging" | "other";
type DebugBugSeverity = "low" | "medium" | "high" | "critical";

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
  configPrompt?: string;
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
  clientResolver?: (request: ActionRequest, role?: RoleComponent) => ChatLike;
  requestConcurrencyScopeResolver?: (
    request: ActionRequest,
    role?: RoleComponent,
  ) => string | undefined;
  maxConcurrentRequestsResolver?: (
    request: ActionRequest,
    role?: RoleComponent,
  ) => number | undefined;
  personalityPromptResolver?: (request: ActionRequest, role?: RoleComponent) => string | undefined;
  toolSpecRegistry?: ToolSpecRegistry;
  rolePromptRegistry?: RolePromptRegistry;
  toolCallRepairRegistry?: ToolCallRepairRegistry;
  targetHintRegistry?: TargetHintRegistry;
  phaseStageLocalizationRegistry?: PhaseStageLocalizationRegistry;
  boardConfig?: BoardConfig;
  configRenderRegistry?: ConfigRenderRegistry;
  maxConcurrentRequests?: number;
}

/**
 * 真实 LLM 行为提供器：
 * - 将当前请求上下文转换为 JSON 协议提示词；
 * - 约束模型仅返回允许的工具调用；
 * - 解析失败或越权时自动降级到 fallback，确保对局可推进。
 */
export class LlmActionProvider implements ActionProvider {
  private static readonly REPORT_BUG_MAX_PER_ACTOR_PER_DAY = 3;
  private readonly maxPromptEvents: number;
  private readonly trace: boolean;
  private readonly llmTimeoutMs: number;
  private readonly colorizeLogs: boolean;
  private readonly printLlmIo: boolean;
  private readonly printThinking: boolean;
  private readonly fallbackProvider: ActionProvider;
  private readonly clientResolver?: (request: ActionRequest, role?: RoleComponent) => ChatLike;
  private readonly requestConcurrencyScopeResolver?: (
    request: ActionRequest,
    role?: RoleComponent,
  ) => string | undefined;
  private readonly maxConcurrentRequestsResolver?: (
    request: ActionRequest,
    role?: RoleComponent,
  ) => number | undefined;
  private readonly personalityPromptResolver?: (request: ActionRequest, role?: RoleComponent) => string | undefined;
  private readonly toolSpecRegistry: ToolSpecRegistry;
  private readonly rolePromptRegistry: RolePromptRegistry;
  private readonly toolCallRepairRegistry: ToolCallRepairRegistry;
  private readonly toolValidationRuleRegistry: ToolValidationRuleRegistry;
  private readonly targetHintRegistry: TargetHintRegistry;
  private readonly phaseStageLocalizationRegistry: PhaseStageLocalizationRegistry;
  private readonly boardConfig?: BoardConfig;
  private readonly configRenderRegistry: ConfigRenderRegistry;
  private readonly maxConcurrentRequests: number;
  private readonly activeRequestCountByScope = new Map<string, number>();
  private readonly requestWaitQueueByScope = new Map<string, Array<() => void>>();
  private readonly recentEvents: string[] = [];
  private readonly agentHistories = new Map<EntityId, ChatMessage[]>();
  private readonly agentBroadcastCursor = new Map<EntityId, number>();
  private readonly agentContextWindowStart = new Map<EntityId, number>();
  private readonly actorRoundCounter = new Map<EntityId, number>();
  private readonly actorLastAssistantText = new Map<EntityId, string>();
  private readonly actorSystemPrompt = new Map<EntityId, string>();
  private readonly reportBugAcceptedScope = new Set<string>();
  private readonly reportBugAcceptedMessage = new Set<string>();
  private readonly reportBugAcceptedCountByActorDay = new Map<string, number>();
  private static readonly REPORT_BUG_TOOL: ToolName = "report_bug";
  private readonly actionValidationService = new ActionValidationService();

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
    this.clientResolver = options.clientResolver;
    this.requestConcurrencyScopeResolver = options.requestConcurrencyScopeResolver;
    this.maxConcurrentRequestsResolver = options.maxConcurrentRequestsResolver;
    this.personalityPromptResolver = options.personalityPromptResolver;
    this.toolSpecRegistry = options.toolSpecRegistry ?? getDefaultToolSpecRegistry();
    this.rolePromptRegistry =
      options.rolePromptRegistry ?? getDefaultRolePromptRegistry();
    this.toolCallRepairRegistry =
      options.toolCallRepairRegistry ?? getDefaultToolCallRepairRegistry();
    this.toolValidationRuleRegistry = getDefaultToolValidationRuleRegistry();
    this.targetHintRegistry =
      options.targetHintRegistry ?? getDefaultTargetHintRegistry();
    this.phaseStageLocalizationRegistry =
      options.phaseStageLocalizationRegistry ??
      getDefaultPhaseStageLocalizationRegistry();
    this.boardConfig = options.boardConfig;
    this.configRenderRegistry =
      options.configRenderRegistry ?? getDefaultConfigRenderRegistry();
    const envMaxConcurrent = Number(process.env.LLM_MAX_CONCURRENT_REQUESTS ?? "");
    const configuredMaxConcurrent =
      options.maxConcurrentRequests ??
      (Number.isFinite(envMaxConcurrent) && envMaxConcurrent > 0
        ? envMaxConcurrent
        : undefined);
    this.maxConcurrentRequests =
      typeof configuredMaxConcurrent === "number" &&
      Number.isFinite(configuredMaxConcurrent) &&
      configuredMaxConcurrent > 0
        ? Math.max(1, Math.floor(configuredMaxConcurrent))
        : Number.POSITIVE_INFINITY;
    this.fallbackProvider =
      options.fallbackProvider ?? new BaselineBotActionProvider(world);
  }

  static fromModelClient(
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
    const roleComp = this.world.getComponent<RoleComponent>(request.actorId, COMPONENT.Role);
    const client = this.clientResolver?.(request, roleComp) ?? this.client;
    const built = this.buildMessages(request, Boolean(client.runToolLoop));
    const messages = built.messages;
    this.appendTrace(
      `context_window player=${request.actorId} phase=${request.phase} start=${built.contextWindowStart} end=${built.contextWindowEnd} total=${built.contextWindowTotal}`,
    );
    let raw = "";
    const startedAt = Date.now();
    const retryTrace: Array<{
      attempt: number;
      status: "request_error" | "no_valid_action";
      reason?: string;
      retryPrompt?: string;
      assistantText?: string;
    }> = [];
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
    let effectiveTimeoutMs = this.computeEffectiveTimeout(request.deadlineAtMs);

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

    const requestConcurrencyScope = this.resolveRequestConcurrencyScope(
      request,
      roleComp,
    );
    const requestMaxConcurrent = this.resolveMaxConcurrentRequests(
      request,
      roleComp,
    );
    await this.acquireRequestSlot(
      request,
      requestConcurrencyScope,
      requestMaxConcurrent,
    );
    try {
      // 排队期间全局预算仍会流逝；进入实际请求前必须重新计算，避免用过期预算启动调用。
      effectiveTimeoutMs = this.computeEffectiveTimeout(request.deadlineAtMs);
      if (effectiveTimeoutMs <= 0) {
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
      if (client.runToolLoop) {
        const runSdkAttempt = async (
          attempt: number,
          attemptMessages: ChatMessage[],
        ): Promise<{
          picked: ToolCall | null;
          failed: boolean;
          deadlineExceeded?: boolean;
          errorText?: string;
          assistantText?: string;
        }> => {
          const attemptTimeoutMs = this.computeEffectiveTimeout(request.deadlineAtMs);
          if (attemptTimeoutMs <= 0) {
            return {
              picked: null,
              failed: false,
              deadlineExceeded: true,
              errorText: "request_deadline_elapsed",
            };
          }
          try {
            const picked = await this.runSdkToolLoop(
              client,
              request,
              attemptMessages,
              attemptTimeoutMs,
            );
            return {
              picked,
              failed: false,
              assistantText: this.actorLastAssistantText.get(request.actorId),
            };
          } catch (error) {
            const errorText = String(error);
            this.appendTrace(
              `request_sdk_attempt_fail player=${request.actorId} phase=${request.phase} attempt=${attempt} err=${errorText}`,
            );
            return { picked: null, failed: true, errorText };
          }
        };

        const firstAttempt = await runSdkAttempt(0, messages);
        if (firstAttempt.deadlineExceeded) {
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
        if (firstAttempt.failed) {
          retryTrace.push({
            attempt: 0,
            status: "request_error",
            reason: firstAttempt.errorText,
            assistantText: firstAttempt.assistantText,
          });
          // 传输/超时错误与“模型未调用工具”不同；后者可用提示词纠正，前者
          // 重复等待只会线性放大一名玩家的阻塞时间。
          const fallback = await this.runFallback(request, "runtime_error");
          this.recordPlayerRound(request, built, {
            actionMode: fallback ? "tool_call" : "none",
            toolCalls: toToolCalls(fallback),
            finalAction: fallback,
            thinkingText: this.actorLastAssistantText.get(request.actorId),
            retryTrace: [...retryTrace],
            fallback: {
              used: true,
              reason: "runtime_error",
              action: toFallbackAction(fallback),
            },
          });
          return fallback;
        }
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
        if (this.requiresAction(request)) {
          let deadlineExceeded = false;
          let retryMessages = [...messages];
          const maxRetries = 3;
          if (!firstAttempt.failed) {
            retryTrace.push({
              attempt: 0,
              status: "no_valid_action",
              reason: "turn_constraints_no_valid_action",
              assistantText: firstAttempt.assistantText,
            });
          }
          for (let attempt = 1; attempt <= maxRetries; attempt++) {
            const retryPrompt = this.buildConstraintRetryPrompt(
              attempt,
              maxRetries,
            );
            retryMessages = [
              ...retryMessages,
              {
                role: "user",
                content: retryPrompt,
              },
            ];
            console.log(
              `[LLM_RETRY] player=${request.actorId} phase=${request.phase} attempt=${attempt}/${maxRetries} reason=turn_constraints_no_valid_action`,
            );
            const retryTraceEntry: {
              attempt: number;
              status: "request_error" | "no_valid_action";
              reason?: string;
              retryPrompt?: string;
              assistantText?: string;
            } = {
              attempt,
              status: "no_valid_action",
              reason: "turn_constraints_no_valid_action",
              retryPrompt,
            };
            retryTrace.push(retryTraceEntry);
            this.dumpLlmPrompt(retryMessages, request);
            const retryResult = await runSdkAttempt(attempt, retryMessages);
            const retried = retryResult.picked;
            if (retryResult.deadlineExceeded) {
              deadlineExceeded = true;
              retryTraceEntry.reason = retryResult.errorText;
              break;
            }
            retryTraceEntry.assistantText = retryResult.assistantText;
            if (retryResult.failed) {
              retryTraceEntry.status = "request_error";
              retryTraceEntry.reason = retryResult.errorText;
              const fallback = await this.runFallback(request, "runtime_error");
              this.recordPlayerRound(request, built, {
                actionMode: fallback ? "tool_call" : "none",
                toolCalls: toToolCalls(fallback),
                finalAction: fallback,
                thinkingText: this.actorLastAssistantText.get(request.actorId),
                retryTrace: [...retryTrace],
                fallback: {
                  used: true,
                  reason: "runtime_error",
                  action: toFallbackAction(fallback),
                },
              });
              return fallback;
            }
            if (retried) {
              this.appendTrace(
                `request_ok_retry player=${request.actorId} phase=${request.phase} attempt=${attempt}/${maxRetries} action=${retried.name} args=${JSON.stringify(retried.args)} elapsed_ms=${Date.now() - startedAt}`,
              );
              this.recordPlayerRound(request, built, {
                actionMode: "tool_call",
                toolCalls: toToolCalls(retried),
                finalAction: retried,
                thinkingText: this.actorLastAssistantText.get(request.actorId),
                ...(retryTrace.length > 0 ? { retryTrace: [...retryTrace] } : {}),
              });
              return retried;
            }
          }
          if (deadlineExceeded) {
            const fallback = await this.runFallback(request, "deadline_skip");
            this.recordPlayerRound(request, built, {
              actionMode: fallback ? "tool_call" : "none",
              toolCalls: toToolCalls(fallback),
              finalAction: fallback,
              thinkingText: this.actorLastAssistantText.get(request.actorId),
              ...(retryTrace.length > 0 ? { retryTrace: [...retryTrace] } : {}),
              fallback: {
                used: true,
                reason: "deadline_skip",
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
            ...(retryTrace.length > 0 ? { retryTrace: [...retryTrace] } : {}),
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
            ...(retryTrace.length > 0 ? { retryTrace: [...retryTrace] } : {}),
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
        raw = await this.chatWithTimeout(client, messages, effectiveTimeoutMs);
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
        if (this.requiresAction(request)) {
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
    } finally {
      this.releaseRequestSlot(requestConcurrencyScope);
    }
  }

  private resolveRequestConcurrencyScope(
    request: ActionRequest,
    role?: RoleComponent,
  ): string {
    const fromResolver = this.requestConcurrencyScopeResolver?.(request, role)?.trim();
    if (fromResolver) {
      return fromResolver;
    }
    return "default";
  }

  private async acquireRequestSlot(
    request: ActionRequest,
    scope: string,
    maxConcurrentRequests: number,
  ): Promise<void> {
    if (!Number.isFinite(maxConcurrentRequests) || maxConcurrentRequests <= 0) {
      const active = this.activeRequestCountByScope.get(scope) ?? 0;
      this.activeRequestCountByScope.set(scope, active + 1);
      return;
    }
    const active = this.activeRequestCountByScope.get(scope) ?? 0;
    if (active < maxConcurrentRequests) {
      this.activeRequestCountByScope.set(scope, active + 1);
      return;
    }
    const queue = this.requestWaitQueueByScope.get(scope) ?? [];
    this.requestWaitQueueByScope.set(scope, queue);
    const queueDepth = queue.length + 1;
    this.appendTrace(
      `request_queue_wait player=${request.actorId} phase=${request.phase} scope=${scope} queue_depth=${queueDepth} active=${active}/${maxConcurrentRequests}`,
    );
    await new Promise<void>((resolve) => {
      queue.push(resolve);
    });
    const resumedActive = this.activeRequestCountByScope.get(scope) ?? 0;
    this.activeRequestCountByScope.set(scope, resumedActive + 1);
  }

  private resolveMaxConcurrentRequests(
    request: ActionRequest,
    role?: RoleComponent,
  ): number {
    const fromResolver = this.maxConcurrentRequestsResolver?.(request, role);
    if (typeof fromResolver === "number" && Number.isFinite(fromResolver)) {
      return Math.max(1, Math.floor(fromResolver));
    }
    return this.maxConcurrentRequests;
  }

  private releaseRequestSlot(scope: string): void {
    const active = this.activeRequestCountByScope.get(scope) ?? 0;
    if (active <= 1) {
      this.activeRequestCountByScope.delete(scope);
    } else {
      this.activeRequestCountByScope.set(scope, active - 1);
    }

    const queue = this.requestWaitQueueByScope.get(scope);
    const next = queue?.shift();
    if (queue && queue.length === 0) {
      this.requestWaitQueueByScope.delete(scope);
    }
    if (next) {
      next();
    }
  }

  /**
   * 回合约束未满足且未产出有效动作时，返回递进式重试提示词。
   */
  private buildConstraintRetryPrompt(attempt: number, maxRetries: number): string {
    return buildConstraintRetryPrompt(attempt, maxRetries);
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
      `[LLM_FALLBACK] player=${request.actorId} phase=${request.phase} reason=${reason} min_valid_actions=${resolveTurnConstraints(request).minValidActions} allowedTools=${request.allowedTools.join(",")} fallback=${fallbackText}`,
    );
  }

  private async chatWithTimeout(
    client: ChatLike,
    messages: ChatMessage[],
    timeoutMs: number,
  ): Promise<string> {
    const controller = new AbortController();
    let timer: NodeJS.Timeout | null = null;
    try {
      return await Promise.race<string>([
        client.chat(messages, { signal: controller.signal }),
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
    client: ChatLike,
    request: ActionRequest,
    messages: ChatMessage[],
    timeoutMs: number,
  ): Promise<ToolCall | null> {
    if (!client.runToolLoop) {
      return null;
    }
    const controller = new AbortController();
    let timer: NodeJS.Timeout | null = null;
    try {
      const llmAllowedTools = this.buildLlmAllowedTools(request.allowedTools);
      const turnConstraints = resolveTurnConstraints(request);
      const tools = this.buildSdkToolSchemas(llmAllowedTools);
      // 同回合多工具交互：先缓冲有效动作，finish_turn 时统一做约束校验并决定是否落地。
      const validActions: ToolCall[] = [];
      let selectedAction: ToolCall | null = null;
      const loop = client.runToolLoop<ToolCall>(
        messages,
        tools,
        {
          onToolCall: async (invocation) => {
            if (invocation.name === "finish_turn") {
              // 结束回合由约束判定层把关，不满足则继续留在当前 tool loop。
              const evaluation = evaluateTurnConstraints(
                { validActions },
                turnConstraints,
              );
              if (!evaluation.ok) {
                return {
                  toolResult: {
                    ok: false,
                    error: "turn_constraints_not_satisfied",
                    details: evaluation.errors,
                  },
                };
              }
              if (selectedAction) {
                return {
                  toolResult: {
                    ok: true,
                    reason: "turn_finished_with_action",
                  },
                  finalAction: selectedAction,
                };
              }
              return {
                toolResult: { ok: true, reason: "turn_finished" },
                stop: true,
              };
            }

            if (invocation.name === LlmActionProvider.REPORT_BUG_TOOL) {
              return {
                toolResult: this.handleReportBugToolCall(request, invocation.args),
              };
            }

            const validatedInvocation =
              this.actionValidationService.validateToolInvocation(
                request,
                llmAllowedTools,
                {
                  name: invocation.name,
                  args: invocation.args,
                },
                (raw, allowedTools, actorId) =>
                  this.parseToolCall(raw, allowedTools, actorId),
              );
            if (!validatedInvocation.ok) {
              return {
                toolResult: {
                  ok: false,
                  error: validatedInvocation.error,
                },
              };
            }
            const parsed = validatedInvocation.action;

            // `use_potion` 的资源余量会直接影响动作是否合法。提前在 tool loop
            // 中校验，可将“解药已用”等结果反馈给模型，避免把会被夜间流水线拒绝的
            // 动作记录为本回合最终行动。
            if (parsed.name === "use_potion") {
              const role = this.world.getComponent<RoleComponent>(
                request.actorId,
                COMPONENT.Role,
              );
              const stateError = role
                ? this.toolValidationRuleRegistry.validate({
                    world: this.world,
                    actorId: request.actorId,
                    role,
                    toolCall: parsed,
                    phase: request.phase,
                    actionWindow: request.actionWindow,
                  })
                : "非法操作，玩家角色不存在";
              if (stateError) {
                return {
                  toolResult: { ok: false, error: stateError },
                };
              }
            }

            if (validActions.length >= turnConstraints.maxValidActions) {
              return {
                toolResult: {
                  ok: false,
                  error: "turn_constraints_max_actions_exceeded",
                  details: [
                    `本轮最多允许${turnConstraints.maxValidActions}次有效行动。`,
                  ],
                },
              };
            }

            validActions.push(parsed);
            selectedAction = parsed;

            return {
              toolResult: {
                ok: true,
                accepted: true,
                buffered_action: parsed.name,
                buffered_count: validActions.length,
              },
            };
          },
        },
        {
          signal: controller.signal,
          maxSteps: 8,
          // 必须行动的窗口强制模型先提交一个工具调用，避免模型仅输出
          // assistant 思考文本后结束生成，再触发无意义的整轮重试。
          // 可选窗口继续使用 auto，以允许 finish_turn / 无动作结束。
          toolChoice:
            turnConstraints.minValidActions > 0 ? "required" : "auto",
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
      const derivedThinkingText = this.buildThinkingTraceText(
        result.assistantText ?? "",
        result.thinkingTrace ?? [],
      );
      if (result.assistantText) {
        this.appendAgentHistory(request.actorId, {
          role: "assistant",
          content: result.assistantText,
        });
      }
      this.actorLastAssistantText.set(
        request.actorId,
        derivedThinkingText ?? result.assistantText ?? "",
      );
      this.dumpThinkingTrace(result.thinkingTrace ?? [], request);
      this.dumpLlmRawResponse(result.assistantText ?? "", request);
      if (result.finalAction) {
        return result.finalAction;
      }
      if (selectedAction) {
        const evaluation = evaluateTurnConstraints(
          { validActions },
          turnConstraints,
        );
        if (evaluation.ok) {
          return selectedAction;
        }
      }
      return null;
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
    tools.push({
      name: "finish_turn",
      description: "申请结束当前回合。系统会先校验回合约束，满足后才真正结束。",
      parameters: {
        type: "object",
        properties: {},
        description: "空参数对象；调用后表示主动结束本回合。",
        additionalProperties: false,
      },
    });
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
  private buildMessages(
    request: ActionRequest,
    supportsFinishTurn: boolean = Boolean(this.client.runToolLoop),
  ): BuildMessagesResult {
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
    const turnConstraints = resolveTurnConstraints(request);
    const requiresAction = turnConstraints.minValidActions > 0;
    const stageLabel = String(
      request.context.phase ??
        request.actionWindow ??
        request.context.window ??
        request.phase,
    );
    const localizedPhaseLabel = this.phaseStageLocalizationRegistry.phaseName(
      String(request.phase),
    );
    const localizedStageLabel = this.phaseStageLocalizationRegistry.stageName(
      stageLabel,
    );

    const fullHistory = [...(this.agentHistories.get(request.actorId) ?? [])];
    const contextWindow = this.selectHistoryWindow(request.actorId, fullHistory);
    const history = contextWindow.history;
    const isInitialRound = (this.actorRoundCounter.get(request.actorId) ?? 0) === 0;
    const boardInfoPrompt = isInitialRound ? this.buildBoardInfoPrompt() : undefined;
    const configPrompt =
      isInitialRound && this.boardConfig
        ? this.configRenderRegistry.renderBoardConfigPrompt(this.boardConfig)
        : undefined;
    const llmAllowedTools = this.buildLlmAllowedTools(request.allowedTools);
    const promptAllowedTools = supportsFinishTurn
      ? [...llmAllowedTools, "finish_turn"]
      : llmAllowedTools;
    const effectiveActionTools = llmAllowedTools.filter(
      (tool) => tool !== LlmActionProvider.REPORT_BUG_TOOL,
    );
    const cachedSystemPrompt = this.actorSystemPrompt.get(request.actorId);
    const systemPrompt =
      cachedSystemPrompt ??
      buildSystemPrompt({
        actorId: request.actorId,
        role: roleComp?.role ?? "unknown",
        maxPlayerId,
        teammateIds,
        boardInfoPrompt,
        configPrompt,
        personalityPrompt: this.personalityPromptResolver?.(request, roleComp),
        supportsFinishTurn,
        supportsDebugReporting: llmAllowedTools.includes(
          LlmActionProvider.REPORT_BUG_TOOL,
        ),
      });
    if (!cachedSystemPrompt) {
      this.actorSystemPrompt.set(request.actorId, systemPrompt);
    }

    const userPrompt = buildUserPrompt({
      actorId: request.actorId,
      phase: localizedPhaseLabel,
      stage: localizedStageLabel,
      isSpeechTurn:
        llmAllowedTools.includes("speak") ||
        llmAllowedTools.includes("speak_to_wolves"),
      stageDirective: this.stageDirective(request, supportsFinishTurn),
      statusDirective: this.statusDirective(request.actorId, roleComp),
      requiresAction,
      turnConstraintHint: renderTurnConstraintUserHint(turnConstraints),
      allowedTools: promptAllowedTools,
      effectiveActionTools,
      toolArgHints: [
        this.toolArgHints(llmAllowedTools),
        ...(supportsFinishTurn ? ["finish_turn args: {}"] : []),
      ]
        .filter(Boolean)
        .join("; "),
      toolUsageHints: this.toolUsageHints(llmAllowedTools),
      stageContextHint: this.stageContextHint(request, supportsFinishTurn),
      actionableIdsHint: this.targetHintRegistry.buildActionableIdsHint({
        actorId: request.actorId,
        actorRole: roleComp?.role,
        allowedTools: llmAllowedTools,
        world: this.world,
      }),
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
      ...(configPrompt ? { configPrompt } : {}),
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
      retryTrace?: Array<{
        attempt: number;
        status: "request_error" | "no_valid_action";
        reason?: string;
        retryPrompt?: string;
        assistantText?: string;
      }>;
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
    const localizedPhaseLabel = this.phaseStageLocalizationRegistry.phaseName(
      phaseLabel,
    );
    const localizedStageLabel = this.phaseStageLocalizationRegistry.stageName(
      stageLabel,
    );
    recorder.recordPlayerRound({
      playerId: request.actorId,
      role: role?.role ?? "unknown",
      camp: role?.camp ?? "unknown",
      day,
      phase: localizedPhaseLabel,
      stage: localizedStageLabel,
      requestId: `${day}-${phaseLabel}-${request.actorId}-${next}`,
      timestampMs: Date.now(),
      visibleFeedDelta: built.visibleFeedDelta,
      feedCursorBefore: built.feedCursorBefore,
      feedCursorAfter: built.feedCursorAfter,
      // 复盘时间线仅保留当轮核心送模消息，避免与广播流和历史上下文重复堆叠。
      llmRequestMessages: [
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
      ],
      retryTrace: extras.retryTrace,
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
   * 构建阶段上下文提示（如女巫可见刀口），减少关键行动前的信息缺失。
   */
  private stageContextHint(
    request: ActionRequest,
    supportsFinishTurn: boolean = Boolean(this.client.runToolLoop),
  ): string | undefined {
    const stage = String(
      request.context.phase ?? request.actionWindow ?? request.context.window ?? "",
    );
    if (stage !== "witch") {
      const onlySelfDestructWindow =
        stage === "on_pre_vote" &&
        request.allowedTools.every(
          (tool) =>
            tool === "self_destruct" || tool === LlmActionProvider.REPORT_BUG_TOOL,
        );
      if (onlySelfDestructWindow) {
        return supportsFinishTurn
          ? "当前为放逐前自爆窗口：唯一会改变局面的动作是 self_destruct；禁止发言、投票和其他行动。若选择不自爆，请调用 finish_turn 结束本回合；report_bug 仅用于上报问题。"
          : "当前为放逐前自爆窗口：唯一会改变局面的动作是 self_destruct；禁止发言、投票和其他行动。report_bug 仅用于上报问题。";
      }
      return undefined;
    }
    const wolfTargetRaw = request.context.wolf_target;
    if (typeof wolfTargetRaw === "number") {
      return `当前已知昨夜刀口是${wolfTargetRaw}号。`;
    }
    if (wolfTargetRaw === null) {
      return "当前已知昨夜刀口为空（可能空刀或平票）。";
    }
    return "当前未获得明确刀口信息。";
  }

  /**
   * 针对关键子阶段给出强约束指令，减少“狼聊阶段误当投票阶段”等误解。
   */
  private stageDirective(
    request: ActionRequest,
    supportsFinishTurn: boolean = Boolean(this.client.runToolLoop),
  ): string {
    const directive =
      this.toolSpecRegistry.getStageDirective(request.allowedTools) ??
      "请严格区分当前阶段职责，只执行本轮工具对应动作。";
    return supportsFinishTurn
      ? directive
      : directive.replace("；若选择不自爆，请调用 finish_turn 结束回合。", "");
  }

  /**
   * 构建 LLM 可见工具列表：在当前阶段工具之外追加可选调试上报工具。
   */
  private buildLlmAllowedTools(allowedTools: ToolName[]): ToolName[] {
    const out = [...allowedTools];
    if (
      this.client.runToolLoop &&
      !out.includes(LlmActionProvider.REPORT_BUG_TOOL)
    ) {
      out.push(LlmActionProvider.REPORT_BUG_TOOL);
    }
    return out;
  }

  /**
   * report_bug 仅做记录，不改变主行动。
   */
  private handleReportBugToolCall(
    request: ActionRequest,
    args: Record<string, unknown>,
  ): Record<string, unknown> {
    const parsed = this.parseDebugReportArgs(args);
    if (!parsed.ok) {
      safeRecordLogicOp({
        scope: "llm_action_provider",
        op: "report_bug_rejected",
        actorId: request.actorId,
        phase: request.phase,
        status: "rejected",
        reason: parsed.error,
        input: { args },
      });
      return { ok: false, error: parsed.error };
    }

    const day = Number(request.context.day ?? request.context.current_day ?? 0);
    const stage = String(
      request.context.phase ??
        request.actionWindow ??
        request.context.window ??
        request.phase,
    );
    const actorDayKey = `${request.actorId}|${day}`;
    const scopeKey = `${request.actorId}|${day}|${request.phase}|${stage}`;
    const normalizedMessage = this.normalizeReportBugMessage(parsed.value.message);
    const duplicateKey = `${actorDayKey}|${parsed.value.category}|${parsed.value.severity}|${normalizedMessage}`;
    const acceptedCount = this.reportBugAcceptedCountByActorDay.get(actorDayKey) ?? 0;

    if (acceptedCount >= LlmActionProvider.REPORT_BUG_MAX_PER_ACTOR_PER_DAY) {
      safeRecordLogicOp({
        scope: "llm_action_provider",
        op: "report_bug_dropped",
        actorId: request.actorId,
        phase: request.phase,
        status: "fallback",
        reason: "report_bug_actor_day_rate_limited",
        input: {
          day,
          stage,
          limit: LlmActionProvider.REPORT_BUG_MAX_PER_ACTOR_PER_DAY,
        },
      });
      return {
        ok: true,
        accepted: false,
        dropped: true,
        reason: "report_bug_actor_day_rate_limited",
      };
    }
    if (this.reportBugAcceptedScope.has(scopeKey)) {
      safeRecordLogicOp({
        scope: "llm_action_provider",
        op: "report_bug_dropped",
        actorId: request.actorId,
        phase: request.phase,
        status: "fallback",
        reason: "report_bug_scope_rate_limited",
        input: {
          day,
          stage,
        },
      });
      return {
        ok: true,
        accepted: false,
        dropped: true,
        reason: "report_bug_scope_rate_limited",
      };
    }
    if (this.reportBugAcceptedMessage.has(duplicateKey)) {
      safeRecordLogicOp({
        scope: "llm_action_provider",
        op: "report_bug_dropped",
        actorId: request.actorId,
        phase: request.phase,
        status: "fallback",
        reason: "report_bug_duplicate_message",
        input: {
          day,
          stage,
        },
      });
      return {
        ok: true,
        accepted: false,
        dropped: true,
        reason: "report_bug_duplicate_message",
      };
    }

    const role = this.world.getComponent<RoleComponent>(request.actorId, COMPONENT.Role);
    const recorder = SessionRecordHub.getActive();
    const reportId =
      recorder?.recordDebugReport({
        timestampMs: Date.now(),
        day,
        phase: String(request.phase),
        stage,
        actorId: request.actorId,
        actorRole: role?.role ?? "unknown",
        actorCamp: role?.camp ?? "unknown",
        category: parsed.value.category,
        severity: parsed.value.severity,
        message: parsed.value.message,
      }) ?? "rb-no-recorder";
    this.reportBugAcceptedScope.add(scopeKey);
    this.reportBugAcceptedMessage.add(duplicateKey);
    this.reportBugAcceptedCountByActorDay.set(actorDayKey, acceptedCount + 1);

    safeRecordLogicOp({
      scope: "llm_action_provider",
      op: "report_bug_recorded",
      actorId: request.actorId,
      phase: request.phase,
      status: "ok",
      output: {
        report_id: reportId,
        category: parsed.value.category,
        severity: parsed.value.severity,
      },
    });
    const compactMsg =
      parsed.value.message.length > 120
        ? `${parsed.value.message.slice(0, 120)}...`
        : parsed.value.message;
    console.log(
      `[LLM_BUG] player=${request.actorId} phase=${request.phase} stage=${String(
        request.context.phase ?? request.actionWindow ?? request.context.window ?? request.phase,
      )} severity=${parsed.value.severity} category=${parsed.value.category} report_id=${reportId} message=${compactMsg}`,
    );
    return { ok: true, accepted: true, report_id: reportId };
  }

  private normalizeReportBugMessage(message: string): string {
    return message.toLowerCase().replace(/\s+/g, " ").trim();
  }

  private parseDebugReportArgs(args: Record<string, unknown>):
    | {
        ok: true;
        value: {
          category: DebugBugCategory;
          severity: DebugBugSeverity;
          message: string;
        };
      }
    | { ok: false; error: string } {
    const category = String(args.category ?? "");
    const severity = String(args.severity ?? "");
    const message = typeof args.message === "string" ? args.message.trim() : "";
    const validCategories: DebugBugCategory[] = [
      "flow",
      "rule",
      "state",
      "logging",
      "other",
    ];
    const validSeverities: DebugBugSeverity[] = [
      "low",
      "medium",
      "high",
      "critical",
    ];
    if (!validCategories.includes(category as DebugBugCategory)) {
      return { ok: false, error: "invalid_report_bug_category" };
    }
    if (!validSeverities.includes(severity as DebugBugSeverity)) {
      return { ok: false, error: "invalid_report_bug_severity" };
    }
    if (!message) {
      return { ok: false, error: "invalid_report_bug_message_empty" };
    }
    if (message.length > 300) {
      return { ok: false, error: "invalid_report_bug_message_too_long" };
    }
    return {
      ok: true,
      value: {
        category: category as DebugBugCategory,
        severity: severity as DebugBugSeverity,
        message,
      },
    };
  }

  /**
   * 角色运行时状态补充提示：用于减少“已翻牌白痴却自称被投出局”等表述漂移。
   */
  private statusDirective(
    actorId: EntityId,
    roleComp: RoleComponent | undefined,
  ): string | undefined {
    const lines: string[] = [];
    const privateState = roleComp?.renderPrompt?.().trim();
    if (privateState) {
      lines.push(`你的私有状态：${privateState}`);
    }
    if (roleComp?.role === Role.Idiot) {
      const idiotState = getIdiotState(roleComp);
      if (idiotState?.revealed) {
        lines.push("状态提醒：你已在先前放逐中翻牌为白痴并存活，当前仍在场上发言；你已失去投票权。");
      }
    }
    return lines.length > 0 ? lines.join(" ") : undefined;
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

  private toolUsageHints(allowedTools: string[]): string[] {
    return this.toolSpecRegistry.getApplicableUserPromptHints(
      allowedTools as ToolName[],
    );
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
  private requiresAction(request: ActionRequest): boolean {
    return resolveTurnConstraints(request).minValidActions > 0;
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

  private buildThinkingTraceText(
    assistantText: string,
    trace: ToolLoopStepTrace[],
  ): string | null {
    const primary = assistantText.trim();
    if (primary.length > 0) {
      return primary.length > 1200 ? `${primary.slice(0, 1200)}…` : primary;
    }

    // 回退到最后一条 assistant 文本，不再拼接 tool_call/tool_result 细节，
    // 避免玩家视角被工具执行日志噪声污染。
    for (let i = trace.length - 1; i >= 0; i--) {
      const text = trace[i]?.assistantText?.trim();
      if (text) {
        return text.length > 1200 ? `${text.slice(0, 1200)}…` : text;
      }
    }

    if (!primary) {
      return null;
    }
    return null;
  }
}
