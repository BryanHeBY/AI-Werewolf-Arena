/** 文件说明：预言家相关事件在不同输出通道中的渲染实现。 */
import { ScriptLiveRenderHandler } from "../../script/contracts";
import { RealtimeEventHandler } from "../../session/contracts";
import { makePrivateTargetsEvent } from "../../session/realtime_event_types";

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

/** 预言家事件 -> 实时推送事件映射。 */
export const SEER_REALTIME_EVENT_HANDLERS: Record<string, RealtimeEventHandler> = {
  seer_checked: (event) => {
    const actorId = Number(event.payload.actorId);
    return [
      makePrivateTargetsEvent({
        category: "player_action",
        type: "player.action.check",
        timestamp: event.timestamp,
        actorId,
        targetIds: [Number(event.payload.targetId)],
        data: {
          actorId,
          targetId: Number(event.payload.targetId),
          isWerewolf: Boolean(event.payload.isWerewolf),
        },
        targetPlayerIds: [actorId],
      }),
    ];
  },
};
