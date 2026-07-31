import { COMPONENT } from "../../../core/domain/components/names";
import { RoleComponent } from "../../../core/domain/components/role";
import {
  ActionProvider,
  ActionRequest,
  BoardConfig,
  Camp,
  EntityId,
  Phase,
  PlayerVisibleEvent,
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
import { BaselineBotActionProvider } from "../providers/action_providers";
import {
  buildConstraintRetryPrompt,
} from "./prompt_templates";
import {
  evaluateTurnConstraints,
  resolveTurnConstraints,
} from "./turn_constraints";
import { ActionValidationService } from "./action_validation_service";
import {
  WEREWOLF_GAME_TOOL_SCHEMA,
  WEREWOLF_GAME_TOOL_SPECS,
} from "../game_tool_protocol";
import { AgentBugReportService } from "../reporting/bug_report_service";
import {
  BuiltPlayerPrompt,
  ChatMessage,
  ChatModelClient,
  LlmRetryTraceEntry,
  PlayerRoundOutcome,
  ToolLoopActionResult,
  ToolSchema,
} from "./model_client";
import { ScopedRequestScheduler } from "./request_scheduler";
import { LegacyResponseInterpreter } from "./legacy_response_interpreter";
import { LlmObserver } from "./llm_observer";
import { PlayerPromptSession } from "./player_prompt_session";
import { PlayerRoundRecorder } from "./player_round_recorder";
import { FallbackActionPolicy } from "./fallback_action_policy";
import { SdkGameToolLoop } from "./sdk_game_tool_loop";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
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
  clientResolver?: (request: ActionRequest, role?: RoleComponent) => ChatModelClient;
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
  private readonly llmTimeoutMs: number;
  private readonly clientResolver?: (request: ActionRequest, role?: RoleComponent) => ChatModelClient;
  private readonly requestScheduler: ScopedRequestScheduler;
  private readonly responseInterpreter: LegacyResponseInterpreter;
  private readonly observer: LlmObserver;
  private readonly promptSession: PlayerPromptSession;
  private readonly roundRecorder: PlayerRoundRecorder;
  private readonly fallbackPolicy: FallbackActionPolicy;
  private readonly sdkToolLoop: SdkGameToolLoop;

  constructor(
    private readonly world: World,
    private readonly client: ChatModelClient,
    options: LlmActionProviderOptions = {},
  ) {
    this.llmTimeoutMs = options.llmTimeoutMs ?? 1200;
    this.clientResolver = options.clientResolver;
    const toolSpecRegistry = options.toolSpecRegistry ?? getDefaultToolSpecRegistry();
    const rolePromptRegistry = options.rolePromptRegistry ?? getDefaultRolePromptRegistry();
    const toolCallRepairRegistry = options.toolCallRepairRegistry ?? getDefaultToolCallRepairRegistry();
    const targetHintRegistry = options.targetHintRegistry ?? getDefaultTargetHintRegistry();
    const phaseStageLocalizationRegistry =
      options.phaseStageLocalizationRegistry ??
      getDefaultPhaseStageLocalizationRegistry();
    const configRenderRegistry = options.configRenderRegistry ?? getDefaultConfigRenderRegistry();
    const envMaxConcurrent = Number(process.env.LLM_MAX_CONCURRENT_REQUESTS ?? "");
    const configuredMaxConcurrent =
      options.maxConcurrentRequests ??
      (Number.isFinite(envMaxConcurrent) && envMaxConcurrent > 0
        ? envMaxConcurrent
        : undefined);
    const maxConcurrentRequests =
      typeof configuredMaxConcurrent === "number" &&
      Number.isFinite(configuredMaxConcurrent) &&
      configuredMaxConcurrent > 0
        ? Math.max(1, Math.floor(configuredMaxConcurrent))
        : Number.POSITIVE_INFINITY;
    this.observer = new LlmObserver({
      trace: options.trace ?? false,
      colorizeLogs: options.colorizeLogs,
      printLlmIo: options.printLlmIo ?? false,
      printThinking: options.printThinking ?? false,
    });
    this.requestScheduler = new ScopedRequestScheduler({
      defaultMaxConcurrentRequests: maxConcurrentRequests,
      scopeResolver: options.requestConcurrencyScopeResolver,
      limitResolver: options.maxConcurrentRequestsResolver,
      onWait: ({ request, scope, queueDepth, active, limit }) => {
        this.observer.trace(
          `request_queue_wait player=${request.actorId} phase=${request.phase} scope=${scope} queue_depth=${queueDepth} active=${active}/${limit}`,
        );
      },
    });
    this.responseInterpreter = new LegacyResponseInterpreter(
      world,
      toolCallRepairRegistry,
    );
    this.promptSession = new PlayerPromptSession(world, {
      maxPromptEvents: options.maxPromptEvents ?? 16,
      supportsNativeTools: Boolean(client.runToolLoop),
      personalityPromptResolver: options.personalityPromptResolver,
      toolSpecRegistry,
      rolePromptRegistry,
      targetHintRegistry,
      phaseStageLocalizationRegistry,
      configRenderRegistry,
      boardConfig: options.boardConfig,
    });
    const fallbackProvider = options.fallbackProvider ?? new BaselineBotActionProvider(world);
    this.roundRecorder = new PlayerRoundRecorder(
      world,
      phaseStageLocalizationRegistry,
    );
    this.fallbackPolicy = new FallbackActionPolicy(
      fallbackProvider,
      this.observer,
    );
    this.sdkToolLoop = new SdkGameToolLoop(
      world,
      this.responseInterpreter,
      this.promptSession,
      this.observer,
    );
  }

  static fromModelClient(
    world: World,
    client: ChatModelClient,
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
    const built = this.promptSession.build(request);
    const messages = built.messages;
    this.observer.trace(
      `context_window player=${request.actorId} phase=${request.phase} start=${built.contextWindowStart} end=${built.contextWindowEnd} total=${built.contextWindowTotal}`,
    );
    let raw = "";
    const startedAt = Date.now();
    const retryTrace: LlmRetryTraceEntry[] = [];
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
      this.observer.trace(
        `request_deadline_skip player=${request.actorId} phase=${request.phase}`,
      );
      const fallback = await this.fallbackPolicy.resolve(request, "deadline_skip");
      this.roundRecorder.record(request, built, {
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

    const releaseRequestSlot = await this.requestScheduler.acquire(request, roleComp);
    try {
      // 排队期间全局预算仍会流逝；进入实际请求前必须重新计算，避免用过期预算启动调用。
      effectiveTimeoutMs = this.computeEffectiveTimeout(request.deadlineAtMs);
      if (effectiveTimeoutMs <= 0) {
        const fallback = await this.fallbackPolicy.resolve(request, "deadline_skip");
        this.roundRecorder.record(request, built, {
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
      this.observer.trace(
        `request_start player=${request.actorId} phase=${request.phase} tools=${request.allowedTools.join(",")} timeout_ms=${effectiveTimeoutMs}`,
      );
      this.observer.prompt(messages, request);
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
            const result = await this.sdkToolLoop.run(
              client,
              request,
              attemptMessages,
              attemptTimeoutMs,
              built.turnId,
            );
            return {
              picked: result.action,
              failed: false,
              assistantText: result.thinkingText,
            };
          } catch (error) {
            const errorText = String(error);
            this.observer.trace(
              `request_sdk_attempt_fail player=${request.actorId} phase=${request.phase} attempt=${attempt} err=${errorText}`,
            );
            return { picked: null, failed: true, errorText };
          }
        };

        const firstAttempt = await runSdkAttempt(0, messages);
        if (firstAttempt.deadlineExceeded) {
          const fallback = await this.fallbackPolicy.resolve(request, "deadline_skip");
          this.roundRecorder.record(request, built, {
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
          const fallback = await this.fallbackPolicy.resolve(request, "runtime_error");
          this.roundRecorder.record(request, built, {
            actionMode: fallback ? "tool_call" : "none",
            toolCalls: toToolCalls(fallback),
            finalAction: fallback,
            thinkingText: firstAttempt.assistantText,
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
          this.observer.trace(
            `request_ok player=${request.actorId} phase=${request.phase} action=${picked.name} args=${JSON.stringify(picked.args)} elapsed_ms=${Date.now() - startedAt}`,
          );
          this.roundRecorder.record(request, built, {
            actionMode: "tool_call",
            toolCalls: toToolCalls(picked),
            finalAction: picked,
            thinkingText: firstAttempt.assistantText,
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
            this.observer.prompt(retryMessages, request);
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
              const fallback = await this.fallbackPolicy.resolve(request, "runtime_error");
              this.roundRecorder.record(request, built, {
                actionMode: fallback ? "tool_call" : "none",
                toolCalls: toToolCalls(fallback),
                finalAction: fallback,
                thinkingText: retryResult.assistantText,
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
              this.observer.trace(
                `request_ok_retry player=${request.actorId} phase=${request.phase} attempt=${attempt}/${maxRetries} action=${retried.name} args=${JSON.stringify(retried.args)} elapsed_ms=${Date.now() - startedAt}`,
              );
              this.roundRecorder.record(request, built, {
                actionMode: "tool_call",
                toolCalls: toToolCalls(retried),
                finalAction: retried,
                thinkingText: retryResult.assistantText,
                ...(retryTrace.length > 0 ? { retryTrace: [...retryTrace] } : {}),
              });
              return retried;
            }
          }
          if (deadlineExceeded) {
            const fallback = await this.fallbackPolicy.resolve(request, "deadline_skip");
            this.roundRecorder.record(request, built, {
              actionMode: fallback ? "tool_call" : "none",
              toolCalls: toToolCalls(fallback),
              finalAction: fallback,
              thinkingText: retryTrace.at(-1)?.assistantText,
              ...(retryTrace.length > 0 ? { retryTrace: [...retryTrace] } : {}),
              fallback: {
                used: true,
                reason: "deadline_skip",
                action: toFallbackAction(fallback),
              },
            });
            return fallback;
          }
          const fallback = await this.fallbackPolicy.resolve(
            request,
            "model_declined_required_action",
          );
          this.roundRecorder.record(request, built, {
            actionMode: fallback ? "tool_call" : "none",
            toolCalls: toToolCalls(fallback),
            finalAction: fallback,
            thinkingText: retryTrace.at(-1)?.assistantText,
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
          const fallback = await this.fallbackPolicy.resolve(request, "runtime_error");
          this.roundRecorder.record(request, built, {
            actionMode: fallback ? "tool_call" : "none",
            toolCalls: toToolCalls(fallback),
            finalAction: fallback,
            thinkingText: firstAttempt.assistantText,
            ...(retryTrace.length > 0 ? { retryTrace: [...retryTrace] } : {}),
            fallback: {
              used: true,
              reason: "runtime_error",
              action: toFallbackAction(fallback),
            },
          });
          return fallback;
        }
        this.observer.trace(
          `request_none player=${request.actorId} phase=${request.phase} elapsed_ms=${Date.now() - startedAt}`,
        );
        this.roundRecorder.record(request, built, {
          actionMode: "none",
          toolCalls: [],
          thinkingText: firstAttempt.assistantText,
        });
        return null;
      } else {
        raw = await this.chatWithTimeout(client, messages, effectiveTimeoutMs);
        this.observer.rawResponse(raw, request);
        const parsed = this.responseInterpreter.parse(
          raw,
          request.allowedTools,
          request.actorId,
        );
        if (parsed) {
          this.observer.trace(
            `request_ok player=${request.actorId} phase=${request.phase} action=${parsed.name} args=${JSON.stringify(parsed.args)} elapsed_ms=${Date.now() - startedAt}`,
          );
          this.roundRecorder.record(request, built, {
            actionMode: "tool_call",
            toolCalls: toToolCalls(parsed),
            finalAction: parsed,
            thinkingText: raw,
          });
          return parsed;
        }
        if (this.responseInterpreter.returnedNone(raw)) {
        if (this.requiresAction(request)) {
            const fallback = await this.fallbackPolicy.resolve(
              request,
              "model_declined_required_action",
            );
            this.roundRecorder.record(request, built, {
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
          this.observer.trace(
            `request_none player=${request.actorId} phase=${request.phase} elapsed_ms=${Date.now() - startedAt}`,
          );
          this.roundRecorder.record(request, built, {
            actionMode: "none",
            toolCalls: [],
            thinkingText: raw,
          });
          return null;
        }
        // 若模型已返回结构化 JSON（但工具越权或字段非法），必须走 fallback，
        // 不能被“文本恢复”逻辑改写，否则会绕过 allowedTools 约束。
        if (this.responseInterpreter.isStructuredToolJson(raw)) {
          const fallback = await this.fallbackPolicy.resolve(request, "invalid_tool_json");
          this.roundRecorder.record(request, built, {
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
        const repaired = this.responseInterpreter.recover(
          raw,
          request.allowedTools,
          request.actorId,
        );
        if (repaired) {
          this.observer.trace(
            `request_ok_repaired player=${request.actorId} phase=${request.phase} action=${repaired.name} args=${JSON.stringify((repaired as any).args ?? {})} elapsed_ms=${Date.now() - startedAt}`,
          );
          this.roundRecorder.record(request, built, {
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
        const fallback = await this.fallbackPolicy.resolve(request, "non_json_output");
        this.roundRecorder.record(request, built, {
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
      const fallback = await this.fallbackPolicy.resolve(request, "non_json_output");
      this.roundRecorder.record(request, built, {
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
          this.observer.trace(
            `request_timeout player=${request.actorId} phase=${request.phase} elapsed_ms=${Date.now() - startedAt} err=${errText}`,
          );
        } else {
          this.observer.trace(
            `request_transport_fail player=${request.actorId} phase=${request.phase} elapsed_ms=${Date.now() - startedAt} err=${errText}`,
          );
        }
      }

      const fallback = await this.fallbackPolicy.resolve(request, "runtime_error");
      this.roundRecorder.record(request, built, {
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
      releaseRequestSlot();
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

  private async chatWithTimeout(
    client: ChatModelClient,
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

  /**
   * 判断当前请求是否必须行动。
   */
  private requiresAction(request: ActionRequest): boolean {
    return resolveTurnConstraints(request).minValidActions > 0;
  }
}
