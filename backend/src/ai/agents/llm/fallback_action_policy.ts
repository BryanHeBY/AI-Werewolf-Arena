import { ActionProvider, ActionRequest, ToolCall } from "../../../core/domain/model";
import { safeRecordLogicOp } from "../../../observability";
import { LlmObserver } from "./llm_observer";
import { resolveTurnConstraints } from "./turn_constraints";

export type FallbackReason =
  | "runtime_error"
  | "deadline_skip"
  | "model_declined_required_action";

/** Strategy that keeps the game moving when the model path cannot produce a valid action. */
export class FallbackActionPolicy {
  constructor(
    private readonly provider: ActionProvider,
    private readonly observer: LlmObserver,
  ) {}

  async resolve(request: ActionRequest, reason: FallbackReason): Promise<ToolCall | null> {
    const action = await this.provider.getAction(request);
    const text = action
      ? `${action.name} ${JSON.stringify((action as any).args ?? {})}`
      : "none";
    console.log(
      `[LLM_FALLBACK] player=${request.actorId} phase=${request.phase} reason=${reason} min_valid_actions=${resolveTurnConstraints(request).minValidActions} allowedTools=${request.allowedTools.join(",")} fallback=${text}`,
    );
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
    this.observer.trace(
      action
        ? `request_recovered player=${request.actorId} phase=${request.phase} reason=${reason} fallback=${action.name} args=${JSON.stringify((action as any).args ?? {})}`
        : `request_dropped player=${request.actorId} phase=${request.phase} reason=${reason}`,
    );
    return action;
  }
}
