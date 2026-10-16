/**
 * 负责编排单个原生 SDK 回合；输入为原引擎请求、提示会话与模型客户端，输出为候选工具、重试／回退和玩家记录。
 * 本 owner 持有控制器、截止计时器与待结束任务；最早期限覆盖排队和各次尝试，请求绑定仍由各机制检查。
 * 并发租约只在本回合收尾时释放；每轮取消不可逆，关闭单向封住本 owner，任务兑现不等于领域提交。
 * 取消／关闭仅收走本 provider 资源，不代替规则预检或领域 commit，不扩大 fallback 的原预算。
 */
import { inheritRequestAlias } from "../../domain/request-delivery";
import type { ErrorDiagnostic } from "@ai-werewolf-arena/replay-contract";
import { describeError, formatErrorDiagnostic } from "../../utils/error-diagnostic";
import { COMPONENT } from "../../domain/components/names";
import { RoleComponent } from "../../domain/components/role";
import { ActionRequest, ToolCall } from "../../domain";
import { World } from "../../domain/world";
import {
  FallbackActionPolicy,
  FallbackDeadlineElapsed,
  FallbackReason,
} from "./fallback-action-policy";
import { LlmObserver } from "../player/player-observer";
import { BuiltPlayerPrompt, PlayerRoundOutcome, PlayerRetryTraceEntry } from "../player/contracts";
import { ChatMessage, ChatModelClient } from "../../adapters/llm/transport";
import { PlayerPromptSession } from "./player-prompt-session";
import { PlayerRoundRecorder } from "../../app/player-round-recorder";
import { buildConstraintRetryPrompt } from "../player/prompt-templates";
import { ScopedRequestScheduler } from "../runtime/request-scheduler";
import { SdkGameToolLoop } from "./sdk-game-tool-loop";
import {
  allowsActionFallback,
  resolveTurnConstraints,
} from "../../engine/actions/turn-constraints";

interface LlmTurnOrchestratorOptions {
  world: World;
  defaultClient: ChatModelClient;
  clientResolver?: (request: ActionRequest, role?: RoleComponent) => ChatModelClient;
  timeoutMs: number;
  promptSession: PlayerPromptSession;
  scheduler: ScopedRequestScheduler;
  sdkToolLoop: SdkGameToolLoop;
  fallbackPolicy: FallbackActionPolicy;
  recorder: PlayerRoundRecorder;
  observer: LlmObserver;
}

interface NativeAttempt {
  action: ToolCall | null;
  failed: boolean;
  deadlineExceeded?: boolean;
  diagnostic?: ErrorDiagnostic;
  assistantText?: string;
  refusalReason?: string;
}

/** 以原尝试顺序编排原生工具回合，已付／已记录前缀不由本服务回滚。 */
export class LlmTurnOrchestrator {
  constructor(private readonly options: LlmTurnOrchestratorOptions) {}

  private readonly controllers = new Set<AbortController>();
  private readonly pending = new Set<Promise<ToolCall | null>>();
  private readonly closeController = new AbortController();
  private closed = false;

  get runtimeState() {
    return {
      closed: this.closed,
      turns: this.pending.size,
      scheduler: this.options.scheduler.snapshot,
    };
  }

  run(request: ActionRequest): Promise<ToolCall | null> {
    if (this.closed) return Promise.reject(new DOMException("llm_provider_closed", "AbortError"));
    const startedAt = Date.now();
    // 只取引擎原期限与本次启动预算的较早者；排队和重试共用它，不为每次模型调用重新计时。
    const bounded = {
      ...request,
      deadlineAtMs: Math.min(request.deadlineAtMs ?? Infinity, startedAt + this.options.timeoutMs),
    };
    // bounded 是新请求对象：按原机制路线继承绑定，不凭 actorId 或浅复制字段重建领域许可。
    inheritRequestAlias(request, bounded);
    const controller = new AbortController();
    this.controllers.add(controller);
    const timer = setTimeout(
      () => controller.abort(new Error("request_deadline_elapsed")),
      Math.max(0, bounded.deadlineAtMs - Date.now()),
    );
    let resolve!: (action: ToolCall | null) => void, reject!: (error: unknown) => void;
    const task = new Promise<ToolCall | null>((done, fail) => {
      resolve = done;
      reject = fail;
    });
    // 在 runTurn 的提示／客户端回调开始前登记任务，让同步重入的 close 也能看到这次回合。
    this.pending.add(task);
    void this.runTurn(bounded, controller.signal, startedAt).then(resolve, reject);
    const cleanup = () => {
      clearTimeout(timer);
      this.controllers.delete(controller);
      this.pending.delete(task);
    };
    return task.then(
      (action) => {
        cleanup();
        if (this.closed) return this.closedResult(request);
        if (
          bounded.context.action_failure_policy === "error" &&
          (controller.signal.aborted || bounded.deadlineAtMs <= Date.now())
        )
          throw new Error("action_turn_failed");
        return action;
      },
      (error) => {
        cleanup();
        throw error;
      },
    );
  }

  async close(): Promise<void> {
    this.closed = true;
    this.closeController.abort(new DOMException("llm_provider_closed", "AbortError"));
    // 队列先关闭，再中止运行任务；控制器保留首次中止原因，已授予租约仍走各回合 finally。
    this.options.scheduler.close(this.closeController.signal.reason);
    for (const controller of this.controllers) controller.abort(this.closeController.signal.reason);
    const settled = await Promise.allSettled([...this.pending]);
    // 已知关闭原因按同一对象识别，其它拒绝仍汇总；allSettled 不把传输失败抹成关闭成功。
    const failures = settled.flatMap((result) =>
      result.status === "rejected" && result.reason !== this.closeController.signal.reason
        ? [result.reason]
        : [],
    );
    if (failures.length) throw new AggregateError(failures, "llm_turns_failed_during_close");
  }

  private async runTurn(
    request: ActionRequest,
    signal: AbortSignal,
    startedAt: number,
  ): Promise<ToolCall | null> {
    const role = this.options.world.getComponent(request.actorId, COMPONENT.Role);
    const client = this.options.clientResolver?.(request, role) ?? this.options.defaultClient;
    const prompt = this.options.promptSession.build(request);
    this.options.observer.trace(
      `context_window player=${request.actorId} phase=${request.phase} start=${prompt.contextWindowStart} end=${prompt.contextWindowEnd} total=${prompt.contextWindowTotal}`,
    );
    let release: (() => void) | undefined;
    try {
      release = await this.options.scheduler.acquire(request, role, signal);
      if (this.closed) return this.closedResult(request);
      if (signal.aborted || this.effectiveTimeout(request.deadlineAtMs) <= 0) {
        return this.finishWithFallback(request, prompt, "deadline_skip");
      }
      this.options.observer.trace(
        `request_start player=${request.actorId} phase=${request.phase} tools=${request.allowedTools.join(",")} timeout_ms=${this.effectiveTimeout(request.deadlineAtMs)}`,
      );
      this.options.observer.prompt(prompt.messages, request);
      const action = await this.runNative(client, request, prompt, startedAt, signal);
      if (
        !this.closed &&
        request.context.action_failure_policy === "error" &&
        (signal.aborted || this.effectiveTimeout(request.deadlineAtMs) <= 0)
      ) {
        return this.finishWithFallback(request, prompt, "deadline_skip", {
          retryTrace: [
            {
              attempt: 0,
              status: "request_error",
              reason: "request_timeout",
              diagnostic: { code: "request_timeout" },
            },
          ],
        });
      }
      return this.closed ? this.closedResult(request) : action;
    } catch (error) {
      const diagnostic = describeError(error);
      if (this.closed && (error === this.closeController.signal.reason || error === signal.reason))
        return this.closedResult(request);
      // 原生传输失败已由 runNative 处理；回退或记录失败只传播一次，不能再次调用回退。
      if (release) throw error;
      this.options.observer.trace(
        `${diagnostic.code === "request_timeout" ? "request_timeout" : "request_transport_fail"} player=${request.actorId} phase=${request.phase} elapsed_ms=${Date.now() - startedAt} err=${formatErrorDiagnostic(error, this.options.observer.locale)}`,
      );
      return this.finishWithFallback(
        request,
        prompt,
        diagnostic.code === "request_timeout" ? "deadline_skip" : "runtime_error",
      );
    } finally {
      // 无论成功、记录／回退失败还是取消，都由取得租约的本回合释放；不在模型刚选出动作时提前放槽。
      release?.();
    }
  }

  private async runNative(
    client: ChatModelClient,
    request: ActionRequest,
    prompt: BuiltPlayerPrompt,
    startedAt: number,
    signal: AbortSignal,
  ): Promise<ToolCall | null> {
    const retryTrace: PlayerRetryTraceEntry[] = [];
    // 每次尝试使用同一 bounded 请求的剩余期限；迟到结果在原检查点复核关闭／错误策略。
    const attempt = async (messages: ChatMessage[]): Promise<NativeAttempt> => {
      const timeoutMs = this.effectiveTimeout(request.deadlineAtMs);
      if (signal.aborted || timeoutMs <= 0) {
        return {
          action: null,
          failed: false,
          deadlineExceeded: true,
          diagnostic: { code: "request_timeout" },
        };
      }
      try {
        const result = await this.options.sdkToolLoop.run(
          client,
          request,
          messages,
          timeoutMs,
          prompt.turnId,
          signal,
        );
        if (
          request.context.action_failure_policy === "error" &&
          (signal.aborted || this.effectiveTimeout(request.deadlineAtMs) <= 0)
        ) {
          return {
            action: null,
            failed: false,
            deadlineExceeded: true,
            diagnostic: { code: "request_timeout" },
          };
        }
        return {
          action: result.action,
          failed: result.failureCode !== undefined,
          refusalReason: result.failureCode,
          assistantText: result.thinkingText,
        };
      } catch (error) {
        const diagnostic = describeError(error);
        this.options.observer.trace(
          `request_sdk_attempt_fail player=${request.actorId} phase=${request.phase} err=${formatErrorDiagnostic(error, this.options.observer.locale)}`,
        );
        return { action: null, failed: true, diagnostic };
      }
    };

    const first = await attempt(prompt.messages);
    if (this.closed) return this.closedResult(request);
    if (first.deadlineExceeded)
      return this.finishWithFallback(request, prompt, "deadline_skip", {
        ...(request.context.action_failure_policy === "error"
          ? {
              retryTrace: [
                {
                  attempt: 0,
                  status: "request_error" as const,
                  reason: "request_timeout",
                  diagnostic: first.diagnostic ?? { code: "request_timeout" as const },
                },
              ],
            }
          : {}),
      });
    if (first.failed) {
      retryTrace.push({
        attempt: 0,
        status: first.refusalReason ? "no_valid_action" : "request_error",
        reason: first.refusalReason ?? first.diagnostic?.code,
        diagnostic: first.diagnostic,
        assistantText: first.assistantText,
      });
      return this.finishWithFallback(
        request,
        prompt,
        first.refusalReason ? "model_declined_required_action" : "runtime_error",
        {
          thinkingText: first.assistantText,
          retryTrace,
        },
      );
    }
    if (first.action)
      return this.finishWithAction(request, prompt, first.action, startedAt, {
        thinkingText: first.assistantText,
      });
    if (!this.requiresAction(request)) {
      this.options.observer.trace(
        `request_none player=${request.actorId} phase=${request.phase} elapsed_ms=${Date.now() - startedAt}`,
      );
      this.options.recorder.record(request, prompt, {
        actionMode: "none",
        toolCalls: [],
        thinkingText: first.assistantText,
      });
      return null;
    }

    retryTrace.push({
      attempt: 0,
      status: "no_valid_action",
      reason: "turn_constraints_no_valid_action",
      assistantText: first.assistantText,
    });
    let messages = [...prompt.messages];
    for (let attemptNumber = 1; attemptNumber <= 3; attemptNumber++) {
      const retryPrompt = buildConstraintRetryPrompt(
        attemptNumber,
        3,
        this.options.world.locale,
        this.requiresAction(request),
      );
      messages = [...messages, { role: "user", content: retryPrompt }];
      this.options.observer.emit(
        {
          type: "retry",
          attempt: attemptNumber,
          maxAttempts: 3,
          reason: "turn_constraints_no_valid_action",
        },
        this.options.observer.context(request),
      );
      const trace: PlayerRetryTraceEntry = {
        attempt: attemptNumber,
        status: "no_valid_action",
        reason: "turn_constraints_no_valid_action",
        retryPrompt,
      };
      retryTrace.push(trace);
      this.options.observer.prompt(messages, request);
      const result = await attempt(messages);
      if (this.closed) return this.closedResult(request);
      trace.assistantText = result.assistantText;
      if (result.deadlineExceeded) {
        trace.reason = result.diagnostic?.code;
        trace.diagnostic = result.diagnostic;
        return this.finishWithFallback(request, prompt, "deadline_skip", {
          thinkingText: result.assistantText,
          retryTrace,
        });
      }
      if (result.failed) {
        trace.status = result.refusalReason ? "no_valid_action" : "request_error";
        trace.reason = result.refusalReason ?? result.diagnostic?.code;
        trace.diagnostic = result.diagnostic;
        return this.finishWithFallback(
          request,
          prompt,
          result.refusalReason ? "model_declined_required_action" : "runtime_error",
          {
            thinkingText: result.assistantText,
            retryTrace,
          },
        );
      }
      if (result.action) {
        return this.finishWithAction(request, prompt, result.action, startedAt, {
          thinkingText: result.assistantText,
          retryTrace,
          retryAttempt: attemptNumber,
        });
      }
    }
    return this.finishWithFallback(request, prompt, "model_declined_required_action", {
      thinkingText: retryTrace.at(-1)?.assistantText,
      retryTrace,
    });
  }

  private async finishWithAction(
    request: ActionRequest,
    prompt: BuiltPlayerPrompt,
    action: ToolCall,
    startedAt: number,
    extras: {
      thinkingText?: string;
      retryTrace?: PlayerRetryTraceEntry[];
      retryAttempt?: number;
    } = {},
  ): Promise<ToolCall | null> {
    if (this.closed) return this.closedResult(request);
    this.options.observer.trace(
      `${extras.retryAttempt ? "request_ok_retry" : "request_ok"} player=${request.actorId} phase=${request.phase}${extras.retryAttempt ? ` attempt=${extras.retryAttempt}/3` : ""} action=${action.name} args=${JSON.stringify((action as any).args ?? {})} elapsed_ms=${Date.now() - startedAt}`,
    );
    if (this.closed) return this.closedResult(request);
    this.options.recorder.record(request, prompt, {
      actionMode: "tool_call",
      toolCalls: this.toToolCalls(action),
      finalAction: action,
      thinkingText: extras.thinkingText,
      ...(extras.retryTrace?.length ? { retryTrace: [...extras.retryTrace] } : {}),
    });
    return this.closed ? this.closedResult(request) : action;
  }

  private async finishWithFallback(
    request: ActionRequest,
    prompt: BuiltPlayerPrompt,
    reason: FallbackReason,
    extras: Pick<PlayerRoundOutcome, "thinkingText" | "retryTrace"> = {},
  ): Promise<ToolCall | null> {
    if (this.closed) return this.closedResult(request);
    let action: ToolCall | null;
    try {
      action = await this.options.fallbackPolicy.resolve(
        request,
        reason,
        this.closeController.signal,
      );
    } catch (error) {
      if (error === this.closeController.signal.reason) return this.closedResult(request);
      if (!(error instanceof FallbackDeadlineElapsed)) throw error;
      action = null;
      reason = "deadline_skip";
    }
    if (this.closed) return this.closedResult(request);
    this.options.recorder.record(request, prompt, {
      actionMode: action ? "tool_call" : "none",
      toolCalls: this.toToolCalls(action),
      finalAction: action,
      ...extras,
      fallback: {
        used: allowsActionFallback(request),
        reason,
        ...(action ? { action: { name: action.name, args: (action as any).args ?? {} } } : {}),
      },
    });
    if (!this.closed && request.context.action_failure_policy === "error" && !action)
      throw new Error("action_turn_failed");
    return this.closed ? this.closedResult(request) : action;
  }

  private toToolCalls(action?: ToolCall | null) {
    return action
      ? [
          {
            name: action.name,
            args: ((action as any).args ?? {}) as Record<string, unknown>,
            accepted: true,
          },
        ]
      : [];
  }

  private requiresAction(request: ActionRequest): boolean {
    return resolveTurnConstraints(request).minValidActions > 0;
  }
  private closedResult(request: ActionRequest): null {
    if (request.context.action_failure_policy === "error") throw this.closeController.signal.reason;
    return null;
  }

  private effectiveTimeout(deadlineAtMs?: number): number {
    if (!deadlineAtMs) return this.options.timeoutMs;
    const remaining = deadlineAtMs - Date.now();
    return remaining <= 0 ? 0 : Math.max(1, Math.min(this.options.timeoutMs, remaining));
  }
}
