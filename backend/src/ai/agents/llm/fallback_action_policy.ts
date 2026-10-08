import { text } from "@ai-werewolf-arena/game-text";
import { ActionProvider, ActionRequest, ToolCall } from "../../../core/domain"
import { safeRecordLogicOp } from "../../../recording/session_recorder";
import { LlmObserver } from "../player/player_observer";
import { allowsActionFallback, resolveTurnConstraints } from "../player/turn_constraints";
import { awaitBeforeDeadline } from "../../runtime/turn_deadline";

export type FallbackReason =
  | "runtime_error"
  | "deadline_skip"
  | "model_declined_required_action";

/** Distinguishes this policy's deadline from an injected provider's error. */
export { TurnDeadlineElapsed as FallbackDeadlineElapsed } from "../../runtime/turn_deadline";

/** Strategy that keeps the game moving when the model path cannot produce a valid action. */
export class FallbackActionPolicy {
  constructor(
    private readonly provider: ActionProvider,
    private readonly observer: LlmObserver,
  ) {}

  async resolve(request: ActionRequest, reason: FallbackReason, signal?: AbortSignal): Promise<ToolCall | null> {
    // A local baseline can settle immediately at an exhausted deadline. An
    // asynchronous fallback does not receive a new budget or survive closure.
    const action = allowsActionFallback(request) ? await awaitBeforeDeadline(() => this.provider.getAction(request), request.deadlineAtMs, signal) : null;
    const actionText = action
      ? `${action.name} ${JSON.stringify((action as any).args ?? {})}`
      : "none";
    console.log(
      `[LLM_FALLBACK] player=${request.actorId} phase=${request.phase} reason=${reason} min_valid_actions=${resolveTurnConstraints(request).minValidActions} allowedTools=${request.allowedTools.join(",")} fallback=${actionText} · ${text(this.observer.locale, "runtime.fallback")}`,
    );
    if (signal?.aborted) throw signal.reason;
    safeRecordLogicOp({
      scope: "llm_action_provider",
      op: "llm_fallback",
      actorId: request.actorId,
      phase: request.phase,
      status: action ? "fallback" : "error",
      reason,
      output: action
        ? { action: action.name, args: (action as any).args ?? {} }
        : undefined,
    });
    if (signal?.aborted) throw signal.reason;
    this.observer.trace(
      action
        ? `request_recovered player=${request.actorId} phase=${request.phase} reason=${reason} fallback=${action.name} args=${JSON.stringify((action as any).args ?? {})}`
        : `request_dropped player=${request.actorId} phase=${request.phase} reason=${reason}`,
    );
    return action;
  }
}
