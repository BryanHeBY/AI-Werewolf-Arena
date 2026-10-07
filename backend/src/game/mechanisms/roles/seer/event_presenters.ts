import { term, text } from "@ai-werewolf-arena/game-text";
import type { ScriptLiveRenderHandlers } from "../../script/contracts";
export const SEER_SCRIPT_LIVE_HANDLERS: ScriptLiveRenderHandlers = {
  seer_checked: (event, printPrivateEvents, locale = "zh-CN") => printPrivateEvents ? [{ kind: "private", text: text(locale, "console.live.check", { actor: event.payload.actorId, target: event.payload.targetId, camp: term("camp", event.payload.isWerewolf ? "wolf" : "good", locale) }) }] : [],
};
