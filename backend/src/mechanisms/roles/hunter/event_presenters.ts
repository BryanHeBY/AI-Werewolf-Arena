/** 文件说明：猎人相关事件在不同输出通道中的渲染实现。 */
import { AgentEventLineHandler } from "../../broadcast/contracts";
import { ScriptJudgeLineHandler } from "../../script/contracts";
import { RealtimeEventHandler } from "../../session/contracts";

/** 猎人事件 -> 玩家广播行映射。 */
export const HUNTER_AGENT_EVENT_LINE_HANDLERS: Record<string, AgentEventLineHandler> = {
  hunter_shot: (event) => {
    const p = event.payload as Record<string, any>;
    return `[系统][公开] ${p.hunterId}号猎人开枪带走${p.targetId}号`;
  },
};

/** 猎人事件 -> 上帝判词渲染映射。 */
export const HUNTER_SCRIPT_JUDGE_HANDLERS: Record<string, ScriptJudgeLineHandler> = {
  hunter_shot: (event) => `${event.payload.hunterId}号猎人开枪带走${event.payload.targetId}号`,
};

/** 猎人事件 -> 实时推送事件映射。 */
export const HUNTER_REALTIME_EVENT_HANDLERS: Record<string, RealtimeEventHandler> = {
  hunter_shot: (event, ctx) => {
    const hunterId = Number(event.payload.hunterId);
    const targetId = Number(event.payload.targetId);
    return [
      {
        type: "player_action",
        timestamp: event.timestamp,
        data: {
          playerId: hunterId,
          actionType: "kill",
          targetId,
        },
        visibility: { scope: "public" },
      },
      {
        type: "player_died",
        timestamp: event.timestamp,
        data: {
          playerId: targetId,
          roleType: ctx.getPlayerRole(targetId),
        },
        visibility: { scope: "public" },
      },
    ];
  },
};

