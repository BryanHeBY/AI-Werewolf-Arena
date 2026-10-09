import { text } from "@ai-werewolf-arena/game-text";
import type { ScriptLiveRenderHandlers } from "../../script/contracts";
export const GUARD_SCRIPT_LIVE_HANDLERS: ScriptLiveRenderHandlers = {
  guard_applied: (event, _private, locale = "zh-CN") => [
    {
      kind: "action",
      text:
        event.payload.abstain || event.payload.targetId === null
          ? text(locale, "console.live.guard_skip", { actor: event.payload.actorId })
          : text(locale, "console.live.guard", {
              actor: event.payload.actorId,
              target: event.payload.targetId,
            }),
    },
  ],
};
