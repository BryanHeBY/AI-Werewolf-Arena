/**
 * 负责将领域完成事实经过现有玩家投影后交回工具。输入为真实请求、已选行动和机制反馈，输出为只含本人授权知识的回执。
 * 不读取真实底牌、不绕过事件可见性，不消费资源或推算未来伤害。没有绑定执行通道时保留旧选择回执。
 */
import type { ActionExecutionReceipt } from "@ai-werewolf-arena/game-contract";
import type { ActionRequest, ToolCall } from "../../domain/actions";
import type { World } from "../../domain/world";
import { awaitActionExecution } from "../../domain/action-execution";
import { buildAgentVisibleEventFeed } from "../observation/event-feed";
import type { ActionReceipt } from "./action-turn";

export async function actionFeedback(
  world: World,
  request: ActionRequest,
  action: ToolCall,
  receipt: ActionReceipt,
  signal?: AbortSignal,
): Promise<ActionReceipt | ActionExecutionReceipt> {
  const pending = awaitActionExecution(request, action, signal);
  if (!pending) return receipt;
  const facts = await pending;
  const events = buildAgentVisibleEventFeed(world, [...facts.events], request.actorId).map(
    ({ type, payload }) => ({ type, payload }),
  );
  const rejected = events.some(
    ({ payload }) => payload.reason === "invalid_action" || payload.reason === "no_action",
  );
  const applied = events.length > 0 && !rejected;
  return {
    ok: true,
    accepted: true,
    action: action.name,
    applied: facts.interrupted || !events.length ? null : applied,
    status: facts.interrupted
      ? "interrupted"
      : applied
        ? facts.kind
        : rejected
          ? "not_applied"
          : "unavailable",
    feedback: { version: 1, events },
  };
}
