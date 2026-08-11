/** 文件说明：狼人事件的聊天与终端渲染。 */
import { ScriptLiveRenderHandler, ScriptChatLineHandler } from "../../script/contracts";

export const WOLF_SCRIPT_CHAT_HANDLERS: Record<string, ScriptChatLineHandler> = {
  wolf_tactical_order: (event) => {
    const p = event.payload as Record<string, unknown>;
    return `[狼队][顺序] ${Array.isArray(p.order) ? p.order.join("->") : ""}`;
  },
  wolf_discussion: (event) => {
    const p = event.payload as Record<string, unknown>;
    return `[夜聊][${p.actorId}] ${p.text}`;
  },
  wolf_discussion_ended: (event) => {
    const p = event.payload as Record<string, unknown>;
    return `[夜聊][结束][${p.actorId}] ${p.reason}`;
  },
};

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
