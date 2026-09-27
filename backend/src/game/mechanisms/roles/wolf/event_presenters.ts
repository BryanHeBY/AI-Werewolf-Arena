/** 文件说明：狼人事件的聊天与终端渲染。 */
import { ScriptLiveRenderHandlers, ScriptChatLineHandlers } from "../../script/contracts";

export const WOLF_SCRIPT_CHAT_HANDLERS: ScriptChatLineHandlers = {
  wolf_tactical_order: (event) => {
    return `[狼队][顺序] ${event.payload.order.join("->")}`;
  },
  wolf_discussion: (event) => {
    return `[夜聊][${event.payload.actorId}] ${event.payload.text}`;
  },
  wolf_discussion_ended: (event) => {
    return `[夜聊][结束][${event.payload.actorId}] ${event.payload.reason}`;
  },
};

export const WOLF_SCRIPT_LIVE_HANDLERS: ScriptLiveRenderHandlers = {
  wolf_tactical_order: (event) => [
    {
      kind: "god",
      text: `[live][上帝] 狼人开始夜聊讨论，顺序：${event.payload.order.join("->")}`,
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
