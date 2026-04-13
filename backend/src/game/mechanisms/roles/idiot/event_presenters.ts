/** 文件说明：白痴翻牌相关事件在不同输出通道中的渲染实现。 */
import { AgentEventLineHandler } from "../../broadcast/contracts";
import { ScriptJudgeLineHandler } from "../../script/contracts";
import { RealtimeEventHandler } from "../../session/contracts";

/** 白痴事件 -> 玩家广播行映射。 */
export const IDIOT_AGENT_EVENT_LINE_HANDLERS: Record<string, AgentEventLineHandler> = {
  idiot_revealed: (event) => {
    const p = event.payload as Record<string, any>;
    return `[系统][公开] ${p.targetId}号翻牌为白痴，免于放逐并失去投票权`;
  },
};

/** 白痴事件 -> 上帝判词渲染映射。 */
export const IDIOT_SCRIPT_JUDGE_HANDLERS: Record<string, ScriptJudgeLineHandler> = {
  idiot_revealed: (event) =>
    `${event.payload.targetId}号翻牌为白痴，免于放逐并失去投票权`,
};

/** 白痴事件 -> 实时推送事件映射。 */
export const IDIOT_REALTIME_EVENT_HANDLERS: Record<string, RealtimeEventHandler> = {
  idiot_revealed: (event) => [
    {
      type: "idiot_revealed",
      timestamp: event.timestamp,
      data: {
        targetId: Number(event.payload.targetId),
        survived: true,
        canVote: false,
      },
      visibility: { scope: "public" },
    },
  ],
};

