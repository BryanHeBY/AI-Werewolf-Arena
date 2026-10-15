/**
 * 负责狼人战术顺序、私聊和刀票事实的脚本展示贡献。输入为原事件与语言；
 * 输出为原聊天／God／行动分类文本，按原 join、String 与 abstain 分支读取 payload。
 * 这些 handler 不自行依据 _private 过滤输入；上游分派拥有受众，不在展示层组织讨论、计票或消费刀权。
 */
import { text } from "@ai-werewolf-arena/game-text";
import type {
  ScriptLiveRenderHandlers,
  ScriptChatLineHandlers,
} from "../../agents/presentation/contracts";

export const WOLF_SCRIPT_CHAT_HANDLERS: ScriptChatLineHandlers = {
  wolf_tactical_order: (event, locale = "zh-CN") =>
    text(locale, "console.chat.wolf_order", { order: event.payload.order.join("->") }),
  wolf_discussion: (event, locale = "zh-CN") =>
    text(locale, "console.chat.wolf", { actor: event.payload.actorId, speech: event.payload.text }),
  wolf_discussion_ended: (event, locale = "zh-CN") =>
    text(locale, "console.chat.wolf_end", {
      actor: event.payload.actorId,
      reason: event.payload.reason,
    }),
};
export const WOLF_SCRIPT_LIVE_HANDLERS: ScriptLiveRenderHandlers = {
  wolf_tactical_order: (event, _private, locale = "zh-CN") => [
    {
      kind: "god",
      text: text(locale, "console.live.wolf_order", { order: event.payload.order.join("->") }),
    },
  ],
  wolf_discussion: (event, _private, locale = "zh-CN") => [
    {
      kind: "chat",
      text: text(locale, "console.live.wolf", {
        actor: event.payload.actorId,
        speech: event.payload.text,
      }),
    },
  ],
  wolf_discussion_ended: (event, _private, locale = "zh-CN") => [
    {
      kind: "chat",
      text: text(locale, "console.live.wolf_end", {
        actor: event.payload.actorId,
        reason: event.payload.reason,
      }),
    },
  ],
  wolf_kill_vote_cast: (event, _private, locale = "zh-CN") => [
    {
      kind: "chat",
      text: event.payload.abstain
        ? text(locale, "console.live.kill_abstain", { actor: event.payload.actorId })
        : text(locale, "console.live.kill_vote", {
            actor: event.payload.actorId,
            target: String(event.payload.targetId),
          }),
    },
  ],
};
