/** 文件说明：预言家相关事件在不同输出通道中的渲染实现。 */
import { AgentEventLineHandler } from "../../broadcast/contracts";
import { ScriptLiveRenderHandler } from "../../script/contracts";
import { RealtimeEventHandler } from "../../session/contracts";
import { RealtimeGameEvent } from "../../session/realtime_event_types";

/** 预言家事件 -> 玩家广播行映射。 */
export const SEER_AGENT_EVENT_LINE_HANDLERS: Record<string, AgentEventLineHandler> = {
  seer_checked: (event, ctx) => {
    const p = event.payload as Record<string, any>;
    if (Number(p.actorId) !== ctx.actorId) {
      return null;
    }
    return `[查验结果] ${p.actorId}号查验${p.targetId}号 => ${p.isWerewolf ? "狼人" : "好人"}`;
  },
};

/** 预言家事件 -> 终端 live 渲染映射。 */
export const SEER_SCRIPT_LIVE_HANDLERS: Record<string, ScriptLiveRenderHandler> = {
  seer_checked: (event, printPrivateEvents) => {
    if (!printPrivateEvents) {
      return [];
    }
    return [
      {
        kind: "private",
        text: `[live][查验结果] ${event.payload.actorId}号查验${event.payload.targetId}号 => ${event.payload.isWerewolf ? "狼人" : "好人"}`,
      },
    ];
  },
};

function privateTargetsEvent(
  type: string,
  data: Record<string, unknown>,
  targetPlayerIds: number[],
  timestamp: number,
): RealtimeGameEvent {
  return {
    type,
    timestamp,
    data,
    visibility: {
      scope: "private_targets",
      targetPlayerIds,
    },
  };
}

/** 预言家事件 -> 实时推送事件映射。 */
export const SEER_REALTIME_EVENT_HANDLERS: Record<string, RealtimeEventHandler> = {
  seer_checked: (event) => {
    const actorId = Number(event.payload.actorId);
    return [
      privateTargetsEvent(
        "seer_checked",
        {
          actorId,
          targetId: Number(event.payload.targetId),
          isWerewolf: Boolean(event.payload.isWerewolf),
        },
        [actorId],
        event.timestamp,
      ),
    ];
  },
};
