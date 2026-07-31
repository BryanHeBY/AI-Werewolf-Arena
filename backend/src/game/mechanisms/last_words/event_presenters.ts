/** 文件说明：遗言相关事件在不同输出通道中的渲染实现。 */
import { ScriptJudgeLineHandler, ScriptLiveRenderHandler } from "../script/contracts";
import { RealtimeEventHandler } from "../session/contracts";
import { makePublicEvent } from "../session/realtime_event_types";

/** 遗言事件 -> 上帝判词渲染映射。 */
export const LAST_WORDS_SCRIPT_JUDGE_HANDLERS: Record<string, ScriptJudgeLineHandler> = {
  last_words_granted: (event) => `${event.payload.playerId}号获得遗言`,
  last_words_spoken: (event) => `${event.payload.playerId}号遗言：${event.payload.text}`,
};

/** 遗言事件 -> 终端 live 渲染映射。 */
export const LAST_WORDS_SCRIPT_LIVE_HANDLERS: Record<string, ScriptLiveRenderHandler> = {
  last_words_spoken: (event) => [
    {
      kind: "system",
      text: `[live][遗言][${event.payload.playerId}] ${event.payload.text}`,
    },
  ],
};

/** 遗言事件 -> 实时推送事件映射。 */
export const LAST_WORDS_REALTIME_EVENT_HANDLERS: Record<string, RealtimeEventHandler> = {
  last_words_spoken: (event) => [
    makePublicEvent({
      category: "system",
      type: "player.last_words_spoken",
      timestamp: event.timestamp,
      actorId: Number(event.payload.playerId),
      targetIds: [Number(event.payload.playerId)],
      data: {
        playerId: Number(event.payload.playerId),
        content: String(event.payload.text ?? ""),
      },
    }),
  ],
};
