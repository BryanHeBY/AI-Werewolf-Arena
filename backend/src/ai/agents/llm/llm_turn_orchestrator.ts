import { COMPONENT } from "../../../core/domain/components/names";
import { RoleComponent } from "../../../core/domain/components/role";
import { ActionRequest, ToolCall } from "../../../core/domain/model";
import { World } from "../../../core/domain/world";
import { FallbackActionPolicy, FallbackReason } from "./fallback_action_policy";
import { LegacyResponseInterpreter } from "./legacy_response_interpreter";
import { LlmObserver } from "./llm_observer";
import {
  BuiltPlayerPrompt,
  ChatMessage,
  ChatModelClient,
  LlmRetryTraceEntry,
  PlayerRoundOutcome,
} from "./model_client";
import { PlayerPromptSession } from "./player_prompt_session";
import { PlayerRoundRecorder } from "./player_round_recorder";
import { buildConstraintRetryPrompt } from "./prompt_templates";
import { ScopedRequestScheduler } from "./request_scheduler";
import { SdkGameToolLoop } from "./sdk_game_tool_loop";
import { resolveTurnConstraints } from "./turn_constraints";

interface LlmTurnOrchestratorOptions {
  world: World;
  defaultClient: ChatModelClient;
  clientResolver?: (request: ActionRequest, role?: RoleComponent) => ChatModelClient;
  timeoutMs: number;
  promptSession: PlayerPromptSession;
  scheduler: ScopedRequestScheduler;
  sdkToolLoop: SdkGameToolLoop;
  interpreter: LegacyResponseInterpreter;
  fallbackPolicy: FallbackActionPolicy;
  recorder: PlayerRoundRecorder;
  observer: LlmObserver;
}

interface NativeAttempt {
  action: ToolCall | null;
  failed: boolean;
  deadlineExceeded?: boolean;
  errorText?: string;
  assistantText?: string;
}

/** Application service coordinating one complete SDK or legacy LLM turn. */
export class LlmTurnOrchestrator {
  constructor(private readonly options: LlmTurnOrchestratorOptions) {}

  async run(request: ActionRequest): Promise<ToolCall | null> {
    const role = this.options.world.getComponent<RoleComponent>(request.actorId, COMPONENT.Role);
    const client = this.options.clientResolver?.(request, role) ?? this.options.defaultClient;
    const prompt = this.options.promptSession.build(request);
    const startedAt = Date.now();
    this.options.observer.trace(
      `context_window player=${request.actorId} phase=${request.phase} start=${prompt.contextWindowStart} end=${prompt.contextWindowEnd} total=${prompt.contextWindowTotal}`,
    );
    if (this.effectiveTimeout(request.deadlineAtMs) <= 0) {
      this.options.observer.trace(`request_deadline_skip player=${request.actorId} phase=${request.phase}`);
      return this.finishWithFallback(request, prompt, "deadline_skip");
    }

    const release = await this.options.scheduler.acquire(request, role);
    try {
      const timeoutMs = this.effectiveTimeout(request.deadlineAtMs);
      if (timeoutMs <= 0) return this.finishWithFallback(request, prompt, "deadline_skip");
      this.options.observer.trace(
        `request_start player=${request.actorId} phase=${request.phase} tools=${request.allowedTools.join(",")} timeout_ms=${timeoutMs}`,
      );
      this.options.observer.prompt(prompt.messages, request);
      return client.runToolLoop
        ? await this.runNative(client, request, prompt, startedAt)
        : await this.runLegacy(client, request, prompt, timeoutMs, startedAt);
    } catch (error) {
      const text = String(error);
      this.options.observer.trace(
        `${text.includes("llm_request_timeout_") ? "request_timeout" : "request_transport_fail"} player=${request.actorId} phase=${request.phase} elapsed_ms=${Date.now() - startedAt} err=${text}`,
      );
      return this.finishWithFallback(request, prompt, "runtime_error");
    } finally {
      release();
    }
  }

  private async runNative(
    client: ChatModelClient,
    request: ActionRequest,
    prompt: BuiltPlayerPrompt,
    startedAt: number,
  ): Promise<ToolCall | null> {
    const retryTrace: LlmRetryTraceEntry[] = [];
    const attempt = async (messages: ChatMessage[]): Promise<NativeAttempt> => {
      const timeoutMs = this.effectiveTimeout(request.deadlineAtMs);
      if (timeoutMs <= 0) {
        return { action: null, failed: false, deadlineExceeded: true, errorText: "request_deadline_elapsed" };
      }
      try {
        const result = await this.options.sdkToolLoop.run(
          client,
          request,
          messages,
          timeoutMs,
          prompt.turnId,
        );
        return { action: result.action, failed: false, assistantText: result.thinkingText };
      } catch (error) {
        const errorText = String(error);
        this.options.observer.trace(
          `request_sdk_attempt_fail player=${request.actorId} phase=${request.phase} err=${errorText}`,
        );
        return { action: null, failed: true, errorText };
      }
    };

    const first = await attempt(prompt.messages);
    if (first.deadlineExceeded) return this.finishWithFallback(request, prompt, "deadline_skip");
    if (first.failed) {
      retryTrace.push({
        attempt: 0,
        status: "request_error",
        reason: first.errorText,
        assistantText: first.assistantText,
      });
      return this.finishWithFallback(request, prompt, "runtime_error", {
        thinkingText: first.assistantText,
        retryTrace,
      });
    }
    if (first.action) return this.finishWithAction(request, prompt, first.action, startedAt, {
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
      const retryPrompt = buildConstraintRetryPrompt(attemptNumber, 3);
      messages = [...messages, { role: "user", content: retryPrompt }];
      console.log(
        `[LLM_RETRY] player=${request.actorId} phase=${request.phase} attempt=${attemptNumber}/3 reason=turn_constraints_no_valid_action`,
      );
      const trace: LlmRetryTraceEntry = {
        attempt: attemptNumber,
        status: "no_valid_action",
        reason: "turn_constraints_no_valid_action",
        retryPrompt,
      };
      retryTrace.push(trace);
      this.options.observer.prompt(messages, request);
      const result = await attempt(messages);
      trace.assistantText = result.assistantText;
      if (result.deadlineExceeded) {
        trace.reason = result.errorText;
        return this.finishWithFallback(request, prompt, "deadline_skip", {
          thinkingText: result.assistantText,
          retryTrace,
        });
      }
      if (result.failed) {
        trace.status = "request_error";
        trace.reason = result.errorText;
        return this.finishWithFallback(request, prompt, "runtime_error", {
          thinkingText: result.assistantText,
          retryTrace,
        });
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

  private async runLegacy(
    client: ChatModelClient,
    request: ActionRequest,
    prompt: BuiltPlayerPrompt,
    timeoutMs: number,
    startedAt: number,
  ): Promise<ToolCall | null> {
    const raw = await this.chatWithTimeout(client, prompt.messages, timeoutMs);
    this.options.observer.rawResponse(raw, request);
    const parsed = this.options.interpreter.parse(raw, request.allowedTools, request.actorId);
    if (parsed) return this.finishWithAction(request, prompt, parsed, startedAt, { thinkingText: raw });
    if (this.options.interpreter.returnedNone(raw)) {
      if (this.requiresAction(request)) {
        return this.finishWithFallback(request, prompt, "model_declined_required_action", { thinkingText: raw });
      }
      this.options.observer.trace(
        `request_none player=${request.actorId} phase=${request.phase} elapsed_ms=${Date.now() - startedAt}`,
      );
      this.options.recorder.record(request, prompt, {
        actionMode: "none",
        toolCalls: [],
        thinkingText: raw,
      });
      return null;
    }
    if (this.options.interpreter.isStructuredToolJson(raw)) {
      return this.finishWithFallback(request, prompt, "invalid_tool_json", { thinkingText: raw });
    }
    const repaired = this.options.interpreter.recover(raw, request.allowedTools, request.actorId);
    if (repaired) {
      this.options.observer.trace(
        `request_ok_repaired player=${request.actorId} phase=${request.phase} action=${repaired.name} args=${JSON.stringify((repaired as any).args ?? {})} elapsed_ms=${Date.now() - startedAt}`,
      );
      this.options.recorder.record(request, prompt, {
        actionMode: "text_action",
        toolCalls: this.toToolCalls(repaired),
        finalAction: repaired,
        thinkingText: raw,
        textAction: {
          text: raw,
          parsed_action: { name: repaired.name, args: (repaired as any).args ?? {} },
        },
      });
      return repaired;
    }
    return this.finishWithFallback(request, prompt, "non_json_output", { thinkingText: raw });
  }

  private async finishWithAction(
    request: ActionRequest,
    prompt: BuiltPlayerPrompt,
    action: ToolCall,
    startedAt: number,
    extras: { thinkingText?: string; retryTrace?: LlmRetryTraceEntry[]; retryAttempt?: number } = {},
  ): Promise<ToolCall> {
    this.options.observer.trace(
      `${extras.retryAttempt ? "request_ok_retry" : "request_ok"} player=${request.actorId} phase=${request.phase}${extras.retryAttempt ? ` attempt=${extras.retryAttempt}/3` : ""} action=${action.name} args=${JSON.stringify((action as any).args ?? {})} elapsed_ms=${Date.now() - startedAt}`,
    );
    this.options.recorder.record(request, prompt, {
      actionMode: "tool_call",
      toolCalls: this.toToolCalls(action),
      finalAction: action,
      thinkingText: extras.thinkingText,
      ...(extras.retryTrace?.length ? { retryTrace: [...extras.retryTrace] } : {}),
    });
    return action;
  }

  private async finishWithFallback(
    request: ActionRequest,
    prompt: BuiltPlayerPrompt,
    reason: FallbackReason,
    extras: Pick<PlayerRoundOutcome, "thinkingText" | "retryTrace"> = {},
  ): Promise<ToolCall | null> {
    const action = await this.options.fallbackPolicy.resolve(request, reason);
    this.options.recorder.record(request, prompt, {
      actionMode: action ? "tool_call" : "none",
      toolCalls: this.toToolCalls(action),
      finalAction: action,
      ...extras,
      fallback: {
        used: true,
        reason,
        ...(action ? { action: { name: action.name, args: (action as any).args ?? {} } } : {}),
      },
    });
    return action;
  }

  private toToolCalls(action?: ToolCall | null) {
    return action
      ? [{ name: action.name, args: ((action as any).args ?? {}) as Record<string, unknown>, accepted: true }]
      : [];
  }

  private requiresAction(request: ActionRequest): boolean {
    return resolveTurnConstraints(request).minValidActions > 0;
  }

  private effectiveTimeout(deadlineAtMs?: number): number {
    if (!deadlineAtMs) return this.options.timeoutMs;
    const remaining = deadlineAtMs - Date.now() - 40;
    return remaining <= 0 ? 0 : Math.max(1, Math.min(this.options.timeoutMs, remaining));
  }

  private async chatWithTimeout(
    client: ChatModelClient,
    messages: ChatMessage[],
    timeoutMs: number,
  ): Promise<string> {
    const controller = new AbortController();
    let timer: NodeJS.Timeout | null = null;
    try {
      return await Promise.race([
        client.chat(messages, { signal: controller.signal }),
        new Promise<string>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new Error(`llm_request_timeout_${timeoutMs}ms`));
          }, timeoutMs);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
