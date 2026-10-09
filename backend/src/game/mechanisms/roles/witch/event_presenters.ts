import { text } from "@ai-werewolf-arena/game-text";
import type { ScriptLiveRenderHandlers } from "../../script/contracts";
import { getDefaultTextLocalizationRegistry } from "../../shared/text_localization_registry";
export const WITCH_SCRIPT_LIVE_HANDLERS: ScriptLiveRenderHandlers = {
  witch_potion_used: (event, _private, locale = "zh-CN") => [
    {
      kind: "private",
      text: text(locale, "console.live.potion", {
        actor: event.payload.actorId,
        target: event.payload.targetId,
        potion: getDefaultTextLocalizationRegistry().potionType(event.payload.potionType, locale),
      }),
    },
  ],
  witch_potion_skipped: (event, _private, locale = "zh-CN") => [
    {
      kind: "private",
      text: text(locale, "console.live.potion_skip", { actor: event.payload.actorId }),
    },
  ],
};
