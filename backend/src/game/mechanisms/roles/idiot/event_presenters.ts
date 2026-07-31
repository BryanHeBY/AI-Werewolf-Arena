/** 文件说明：白痴翻牌相关事件在不同输出通道中的渲染实现。 */
import { ScriptJudgeLineHandler } from "../../script/contracts";
import { RealtimeEventHandler } from "../../session/contracts";
import { makePublicEvent } from "../../session/realtime_event_types";

/** 白痴事件 -> 上帝判词渲染映射。 */
export const IDIOT_SCRIPT_JUDGE_HANDLERS: Record<string, ScriptJudgeLineHandler> = {
  idiot_revealed: (event) =>
    `${event.payload.targetId}号翻牌为白痴，免于放逐并失去投票权`,
};

/** 白痴事件 -> 实时推送事件映射。 */
export const IDIOT_REALTIME_EVENT_HANDLERS: Record<string, RealtimeEventHandler> = {
  idiot_revealed: (event) => [
    makePublicEvent({
      category: "player_state",
      type: "player.idiot_revealed",
      timestamp: event.timestamp,
      targetIds: [Number(event.payload.targetId)],
      data: {
        targetId: Number(event.payload.targetId),
        survived: true,
        canVote: false,
      },
    }),
  ],
};
