/** 文件说明：女巫事件的终端渲染。 */
import { ScriptLiveRenderHandler } from "../../script/contracts";
import { getDefaultTextLocalizationRegistry } from "../../shared/text_localization_registry";

export const WITCH_SCRIPT_LIVE_HANDLERS: Record<string, ScriptLiveRenderHandler> = {
  witch_potion_used: (event) => [
    {
      kind: "private",
      text: `[live][行动][女巫] ${event.payload.actorId}号对${event.payload.targetId}号使用${getDefaultTextLocalizationRegistry().potionType(String(event.payload.potionType ?? ""))}`,
    },
  ],
  witch_potion_skipped: (event) => [
    {
      kind: "private",
      text: `[live][行动][女巫] ${event.payload.actorId}号本夜未用药`,
    },
  ],
};
