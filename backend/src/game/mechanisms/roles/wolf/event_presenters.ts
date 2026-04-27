/** 文件说明：狼人相关事件在不同输出通道中的渲染实现。 */
import { GameEvent } from "../../../../core/domain/model";
import {
  AgentEventLineHandler,
  AgentLineContext,
} from "../../broadcast/contracts";
import { ScriptLiveRenderHandler, ScriptChatLineHandler } from "../../script/contracts";
import { RealtimeEventHandler, RealtimeTranslateContext } from "../../session/contracts";
import {
  makePublicEvent,
  makeWolvesOnlyEvent,
} from "../../session/realtime_event_types";

/** 狼人事件 -> 玩家广播行映射。 */
export const WOLF_AGENT_EVENT_LINE_HANDLERS: Record<string, AgentEventLineHandler> = {
  wolf_self_destruct: (event) => {
    const p = event.payload as Record<string, any>;
    return `[系统][公开] ${p.wolfId}号狼人自爆`;
  },
  wolf_discussion: (event, ctx) => {
    if (!ctx.isWolf) {
      return null;
    }
    const p = event.payload as Record<string, any>;
    return `[夜聊][狼队][${p.actorId}] ${p.text}`;
  },
  wolf_discussion_ended: (event, ctx) => {
    if (!ctx.isWolf) {
      return null;
    }
    const p = event.payload as Record<string, any>;
    return `[夜聊][结束][狼队][${p.actorId}] ${p.reason ?? "未提供原因"}`;
  },
  wolf_tactical_order: (event, ctx) => {
    if (!ctx.isWolf) {
      return null;
    }
    const p = event.payload as Record<string, any>;
    return `[狼队][顺序] ${Array.isArray(p.order) ? p.order.join("->") : ""}`;
  },
  wolf_kill_vote_cast: (event, ctx) => {
    if (!ctx.isWolf) {
      return null;
    }
    const p = event.payload as Record<string, any>;
    if (p.abstain === true) {
      return `[狼刀票][狼队] ${p.actorId}号 -> 弃刀`;
    }
    return `[狼刀票][狼队] ${p.actorId}号 -> ${p.targetId}号`;
  },
};

/** 狼人事件 -> 聊天行渲染映射。 */
export const WOLF_SCRIPT_CHAT_HANDLERS: Record<string, ScriptChatLineHandler> = {
  wolf_tactical_order: (event) => {
    const p = event.payload as Record<string, any>;
    return `[狼队][顺序] ${Array.isArray(p.order) ? p.order.join("->") : ""}`;
  },
  wolf_discussion: (event) => {
    const p = event.payload as Record<string, any>;
    return `[夜聊][${p.actorId}] ${p.text}`;
  },
  wolf_discussion_ended: (event) => {
    const p = event.payload as Record<string, any>;
    return `[夜聊][结束][${p.actorId}] ${p.reason}`;
  },
};

/** 狼人事件 -> 终端 live 渲染映射。 */
export const WOLF_SCRIPT_LIVE_HANDLERS: Record<string, ScriptLiveRenderHandler> = {
  wolf_tactical_order: (event) => [
    {
      kind: "god",
      text: `[live][上帝] 狼人开始夜聊讨论，顺序：${Array.isArray(event.payload.order) ? event.payload.order.join("->") : ""}`,
    },
  ],
  wolf_discussion: (event) => [
    {
      kind: "chat",
      text: `[live][夜聊][${event.payload.actorId}] ${event.payload.text}`,
    },
  ],
  wolf_discussion_ended: (event) => [
    {
      kind: "chat",
      text: `[live][夜聊][结束][${event.payload.actorId}] ${event.payload.reason}`,
    },
  ],
  wolf_kill_vote_cast: (event) => {
    if (event.payload.abstain === true) {
      return [{ kind: "chat", text: `[live][行动][狼刀票] ${event.payload.actorId}号弃刀` }];
    }
    return [
      {
        kind: "chat",
        text: `[live][行动][狼刀票] ${event.payload.actorId}号投刀${event.payload.targetId}号`,
      },
    ];
  },
};

/** 狼人事件 -> 实时推送事件映射。 */
export const WOLF_REALTIME_EVENT_HANDLERS: Record<string, RealtimeEventHandler> = {
  wolf_tactical_order: (event) => [
    makeWolvesOnlyEvent({
      category: "agent",
      type: "agent.wolf_tactical_order",
      timestamp: event.timestamp,
      stage: "started",
      data: {
        order: Array.isArray(event.payload.order) ? event.payload.order : [],
      },
    }),
  ],
  wolf_discussion: (event) => [
    makeWolvesOnlyEvent({
      category: "agent",
      type: "agent.thinking",
      timestamp: event.timestamp,
      actorId: Number(event.payload.actorId),
      data: {
        actorId: Number(event.payload.actorId),
        text: String(event.payload.text ?? ""),
      },
    }),
  ],
  wolf_kill_vote_cast: (event) => {
    const abstain = Boolean(event.payload.abstain);
    return [
      makeWolvesOnlyEvent({
        category: "player_action",
        type: "player.action.kill",
        timestamp: event.timestamp,
        actorId: Number(event.payload.actorId),
        targetIds:
          event.payload.targetId === null || event.payload.targetId === undefined
            ? []
            : [Number(event.payload.targetId)],
        data: {
          actorId: Number(event.payload.actorId),
          targetId:
            event.payload.targetId === null || event.payload.targetId === undefined
              ? null
              : Number(event.payload.targetId),
          abstain,
        },
      }),
    ];
  },
  wolf_self_destruct: (event) => {
    const wolfId = Number(event.payload.wolfId);
    return [
      makePublicEvent({
        category: "player_state",
        type: "player.self_destructed",
        timestamp: event.timestamp,
        actorId: wolfId,
        targetIds: [wolfId],
        stage: "resolved",
        data: {
          playerId: wolfId,
          cause: "self_destruct",
        },
      }),
    ];
  },
};
