/**
 * 负责狼人战术顺序、私聊和刀票事实的脚本展示贡献。输入为原事件、终端私有输出开关与语言；
 * 输出为原聊天／God／行动分类文本，按原 join、String 与 abstain 分支读取 payload。
 * 终端消费全量事件，直播 handler 须在读取狼队秘密前检查开关；脚本聊天入口保留本地调试用途。
 * 玩家受众仍由独立投影负责，不在展示层组织讨论、计票或消费刀权。
 */
import type * as ScriptRendering from "../../agents/presentation/contracts";

import { type PlayerText } from "@ai-werewolf-arena/game-presentation";
import { text as defaultText } from "@ai-werewolf-arena/game-text";
import type {
  ScriptLiveRenderHandlers,
  ScriptChatLineHandlers,
} from "../../agents/presentation/contracts";

export const WOLF_SCRIPT_CHAT_HANDLERS: ScriptChatLineHandlers = {
  wolf_tactical_order: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    text(locale, "console.chat.wolf_order", {
      order: event.payload.order
        .map((id) => text(locale, "common.player_reference", { id }))
        .join("->"),
    }),
  wolf_discussion: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    text(locale, "console.chat.wolf", { actor: event.payload.actorId, speech: event.payload.text }),
  wolf_discussion_ended: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    text(locale, "console.chat.wolf_end", {
      actor: event.payload.actorId,
      reason: event.payload.reason,
    }),
};
export const WOLF_SCRIPT_LIVE_HANDLERS: ScriptLiveRenderHandlers = {
  wolf_tactical_order: (
    event,
    printPrivateEvents,
    locale = "zh-CN",
    text: PlayerText = defaultText,
  ) =>
    printPrivateEvents
      ? [
          {
            kind: "god",
            text: text(locale, "console.live.wolf_order", {
              order: event.payload.order
                .map((id) => text(locale, "common.player_reference", { id }))
                .join("->"),
            }),
          },
        ]
      : [],
  wolf_discussion: (event, printPrivateEvents, locale = "zh-CN", text: PlayerText = defaultText) =>
    printPrivateEvents
      ? [
          {
            kind: "chat",
            text: text(locale, "console.live.wolf", {
              actor: event.payload.actorId,
              speech: event.payload.text,
            }),
          },
        ]
      : [],
  wolf_discussion_ended: (
    event,
    printPrivateEvents,
    locale = "zh-CN",
    text: PlayerText = defaultText,
  ) =>
    printPrivateEvents
      ? [
          {
            kind: "chat",
            text: text(locale, "console.live.wolf_end", {
              actor: event.payload.actorId,
              reason: event.payload.reason,
            }),
          },
        ]
      : [],
  wolf_kill_vote_cast: (
    event,
    printPrivateEvents,
    locale = "zh-CN",
    text: PlayerText = defaultText,
  ) =>
    printPrivateEvents
      ? [
          {
            kind: "chat",
            text: event.payload.abstain
              ? text(locale, "console.live.kill_abstain", { actor: event.payload.actorId })
              : text(locale, "console.live.kill_vote", {
                  actor: event.payload.actorId,
                  target: String(event.payload.targetId),
                }),
          },
        ]
      : [],
};

export const WOLF_EVENT_STAGE_HANDLERS: ScriptRendering.ScriptReplayStageHandlers = {
  wolf_discussion: () => "wolf_discussion",
  wolf_discussion_ended: () => "wolf_discussion",
  wolf_kill_vote_cast: () => "wolf_discussion",
};
