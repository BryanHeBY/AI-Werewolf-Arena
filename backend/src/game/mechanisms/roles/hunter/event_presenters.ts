/** 文件说明：猎人相关事件在不同输出通道中的渲染实现。 */
import { ScriptJudgeLineHandler } from "../../script/contracts";
import { RealtimeEventHandler } from "../../session/contracts";
import { makePublicEvent } from "../../session/realtime_event_types";

/** 猎人事件 -> 上帝判词渲染映射。 */
export const HUNTER_SCRIPT_JUDGE_HANDLERS: Record<string, ScriptJudgeLineHandler> = {
  hunter_shot: (event) => `${event.payload.hunterId}号猎人开枪带走${event.payload.targetId}号`,
};

/** 猎人事件 -> 实时推送事件映射。 */
export const HUNTER_REALTIME_EVENT_HANDLERS: Record<string, RealtimeEventHandler> = {
  hunter_shot: (event) => {
    const hunterId = Number(event.payload.hunterId);
    const targetId = Number(event.payload.targetId);
    return [
      makePublicEvent({
        category: "player_action",
        type: "player.action.kill",
        timestamp: event.timestamp,
        actorId: hunterId,
        targetIds: [targetId],
        data: {
          targetId,
        },
      }),
    ];
  },
};
