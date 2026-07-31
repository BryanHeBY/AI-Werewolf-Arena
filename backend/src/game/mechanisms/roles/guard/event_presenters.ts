/** 文件说明：守卫相关事件在不同输出通道中的渲染实现。 */
import { ScriptLiveRenderHandler } from "../../script/contracts";
import { RealtimeEventHandler } from "../../session/contracts";
import { makePrivateTargetsEvent } from "../../session/realtime_event_types";

/** 守卫事件 -> 终端 live 渲染映射。 */
export const GUARD_SCRIPT_LIVE_HANDLERS: Record<string, ScriptLiveRenderHandler> = {
  guard_applied: (event) => {
    if (event.payload.abstain === true || event.payload.targetId === null) {
      return [{ kind: "action", text: `[live][行动][守卫] ${event.payload.actorId}号空守` }];
    }
    return [
      {
        kind: "action",
        text: `[live][行动][守卫] ${event.payload.actorId}号守护${event.payload.targetId}号`,
      },
    ];
  },
};

/** 守卫事件 -> 实时推送事件映射。 */
export const GUARD_REALTIME_EVENT_HANDLERS: Record<string, RealtimeEventHandler> = {
  guard_applied: (event) => {
    const actorId = Number(event.payload.actorId);
    const abstain = Boolean(event.payload.abstain);
    return [
      makePrivateTargetsEvent({
        category: "player_action",
        type: "player.action.guard",
        timestamp: event.timestamp,
        actorId,
        targetIds:
          event.payload.targetId === null || event.payload.targetId === undefined
            ? []
            : [Number(event.payload.targetId)],
        data: {
          actorId,
          targetId:
            event.payload.targetId === null || event.payload.targetId === undefined
              ? null
              : Number(event.payload.targetId),
          abstain,
        },
        targetPlayerIds: [actorId],
      }),
    ];
  },
};
