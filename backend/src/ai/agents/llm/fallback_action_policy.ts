/**
 * 负责模型路径失败后的原回退调用、期限等待与记录；输入为原请求、失败原因和取消信号。
 * 输出为原回退候选或 null；是否允许回退由游戏约束决定，已注入 provider 仍按原期限调用。
 * 本模块不新增时间预算、读取角色库存或提交领域动作；取消在原记录前后重检，保留失败前缀。
 */
import { text } from "@ai-werewolf-arena/game-text";
import { ActionProvider, ActionRequest, ToolCall } from "../../../domain";
import { safeRecordLogicOp } from "../../../recording/session_recorder";
import { LlmObserver } from "../player/player_observer";
import { allowsActionFallback, resolveTurnConstraints } from "../../../game/gateway/turn-constraints";
import { awaitBeforeDeadline } from "../../runtime/turn_deadline";

export type FallbackReason = "runtime_error" | "deadline_skip" | "model_declined_required_action";

/** 区分本政策的期限错误与注入 provider 自己抛出的错误，原错误身份保持。 */
export { TurnDeadlineElapsed as FallbackDeadlineElapsed } from "../../runtime/turn_deadline";

/** 模型不能提供合法候选时消费已装配的回退策略；不扩大请求许可。 */
export class FallbackActionPolicy {
  constructor(
    private readonly provider: ActionProvider,
    private readonly observer: LlmObserver,
  ) {}

  async resolve(
    request: ActionRequest,
    reason: FallbackReason,
    signal?: AbortSignal,
  ): Promise<ToolCall | null> {
    // 本地同步策略仍可在耗尽期限时立即返回；异步回退不获得新预算，也不能跨过关闭继续执行。
    const action = allowsActionFallback(request)
      ? await awaitBeforeDeadline(
          () => this.provider.getAction(request),
          request.deadlineAtMs,
          signal,
        )
      : null;
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
      output: action ? { action: action.name, args: (action as any).args ?? {} } : undefined,
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
