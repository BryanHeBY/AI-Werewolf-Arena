/** 文件说明：预言家事件的终端渲染。 */
import { ScriptLiveRenderHandler } from "../../script/contracts";

export const SEER_SCRIPT_LIVE_HANDLERS: Record<string, ScriptLiveRenderHandler> = {
  seer_checked: (event, printPrivateEvents) => {
    if (!printPrivateEvents) return [];
    return [
      {
        kind: "private",
        text: `[live][查验结果] ${event.payload.actorId}号查验${event.payload.targetId}号 => ${event.payload.isWerewolf ? "狼人" : "好人"}`,
      },
    ];
  },
};
