/**
 * 负责把 Agent 已结束的一轮决策转为当前会话的玩家录制输入。输入为原请求、提示和选择结果，
 * 输出为原时间线字段；应用适配持有 World 与每位玩家的计数，AI 只调用记录入口。
 * 先取走 SDK 当轮输出，有无录制作用域都清除该缓存；有作用域时先读取当前角色，再递增计数，随后读取日次和阶段，
 * 不缓存 actorId、不回滚已递增计数，原字段 getter 与录制失败前缀保持。
 * 接受工具或记录 finalAction 不表示领域付款、生效或判胜；会话聚合和文件持久化仍归记录器。
 */
import { COMPONENT } from "../domain/components/names";
import type { RoleComponent } from "../domain/components/role";
import type { ActionRequest, EntityId } from "@ai-werewolf-arena/game-contract";
import { getActionRequestDay, getActionRequestStage } from "../domain/action-request-context";
import type { World } from "../domain/world";
import { getSessionRecorder } from "../recording/session/context";
import type { BuiltPlayerPrompt, PlayerRoundOutcome } from "../agents/player/contracts";
import { splitPlayerRecordText, type AgentOutput } from "@ai-werewolf-arena/replay-contract";
import type { PlayerPromptMessage } from "../agents/player/contracts";

/**
 * 实际输入增量按玩家档案的单消息上限分片，拼接保持原字符串且不切断 Unicode 代理对。
 * 没有派发的轮次保留空输入，不把拟发送提示补成真实请求。
 */
function recordedRequestChunks(messages: readonly PlayerPromptMessage[]): PlayerPromptMessage[] {
  return messages.flatMap((message) =>
    splitPlayerRecordText(message.content).map((content) => ({ ...message, content })),
  );
}

/** 唯一拥有本适配实例的玩家计数；记录失败保留已递增前缀，不另建第二份计数账本。 */
export class PlayerRoundRecorder {
  // 在原字段位置创建 Map；多个玩家共享此适配实例时仍分别连续计数。
  private readonly roundCounters = new Map<EntityId, number>();

  constructor(
    private readonly world: World,
    private readonly takeOutputs?: (request: ActionRequest) => readonly AgentOutput[],
  ) {}

  record(request: ActionRequest, prompt: BuiltPlayerPrompt, outcome: PlayerRoundOutcome): void {
    const outputs = this.takeOutputs?.(request);
    const recorder = getSessionRecorder();
    if (!recorder) return;
    const role = this.world.getComponent(request.actorId, COMPONENT.Role);
    const round = (this.roundCounters.get(request.actorId) ?? 0) + 1;
    this.roundCounters.set(request.actorId, round);
    // 计数已更新才读取请求元数据；实际Camp到记录字段才查询，后续 getter／录制错误不恢复旧计数。
    const day = getActionRequestDay(request);
    const phase = String(request.phase);
    const stage = getActionRequestStage(request);
    recorder.recordPlayerRound({
      playerId: request.actorId,
      role: role?.role ?? "unknown",
      camp: (role && this.world.getComponent(request.actorId, COMPONENT.Camp)?.camp) ?? "unknown",
      day,
      phase,
      stage,
      requestId: `${day}-${phase}-${request.actorId}-${round}`,
      timestampMs: Date.now(),
      llmRequestMessages: recordedRequestChunks(outcome.inputs.flatMap((input) => input.messages)),
      ...(outcome.deltaMessages ? { deltaMessages: outcome.deltaMessages } : {}),
      ...(outcome.agentOutputs || outputs?.length
        ? { agentOutputs: outcome.agentOutputs ?? outputs }
        : {}),
      promptSystem: prompt.systemPrompt,
      ...(round === 1
        ? {
            initialPromptSystem: prompt.systemPrompt,
            initialBoardInfo: prompt.boardInfoPrompt,
          }
        : {}),
      promptUserDelta: [
        ...(prompt.auditMetadata ?? [
          prompt.context.kind === "history_window"
            ? `context_window=${prompt.context.start}-${prompt.context.end}/${prompt.context.total};event_cursor=${prompt.eventCursorBefore}->${prompt.eventCursorAfter}`
            : `history_owner=${prompt.context.transport};event_cursor=${prompt.eventCursorBefore}->${prompt.eventCursorAfter}`,
        ]),
        `input_dispatches=${outcome.inputs.length};input_modes=${[...new Set(outcome.inputs.map((input) => input.mode))].join(",")}`,
      ],
      retryTrace: outcome.retryTrace,
      thinkingText: outcome.thinkingText,
      actionMode: outcome.actionMode,
      toolCalls: outcome.toolCalls,
      finalAction: outcome.finalAction ?? null,
      fallback: outcome.fallback,
    });
  }
}
