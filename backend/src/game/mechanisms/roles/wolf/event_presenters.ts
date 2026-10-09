import { text } from "@ai-werewolf-arena/game-text";
import type { ScriptLiveRenderHandlers, ScriptChatLineHandlers } from "../../script/contracts";

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
