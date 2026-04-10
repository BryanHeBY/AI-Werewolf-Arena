/** 文件说明：遗言相关事件在不同输出通道中的渲染实现。 */
import { AgentEventLineHandler } from "../broadcast/contracts";
import { ScriptJudgeLineHandler } from "../script/contracts";
import { RealtimeEventHandler } from "../session/contracts";

/** 遗言事件 -> 玩家广播行映射。 */
export const LAST_WORDS_AGENT_EVENT_LINE_HANDLERS: Record<string, AgentEventLineHandler> = {
  last_words_granted: (event) => {
    const p = event.payload as Record<string, any>;
    return `[系统][公开] ${p.playerId}号可以发表遗言`;
  },
  last_words_spoken: (event) => {
    const p = event.payload as Record<string, any>;
    return `[遗言][公开][${p.playerId}] ${p.text}`;
  },
};

/** 遗言事件 -> 上帝判词渲染映射。 */
export const LAST_WORDS_SCRIPT_JUDGE_HANDLERS: Record<string, ScriptJudgeLineHandler> = {
  last_words_granted: (event) => `${event.payload.playerId}号获得遗言`,
  last_words_spoken: (event) => `${event.payload.playerId}号遗言：${event.payload.text}`,
};

/** 遗言事件 -> 实时推送事件映射。 */
export const LAST_WORDS_REALTIME_EVENT_HANDLERS: Record<string, RealtimeEventHandler> = {
  last_words_spoken: (event) => [
    {
      type: "last_words_spoken",
      timestamp: event.timestamp,
      data: {
        playerId: Number(event.payload.playerId),
        content: String(event.payload.text ?? ""),
      },
      visibility: { scope: "public" },
    },
  ],
};

