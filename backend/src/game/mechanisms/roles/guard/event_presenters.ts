/** 文件说明：守卫事件的终端渲染。 */
import { ScriptLiveRenderHandlers } from "../../script/contracts";

export const GUARD_SCRIPT_LIVE_HANDLERS: ScriptLiveRenderHandlers = {
  guard_applied: (event) => {
    if (event.payload.abstain === true || event.payload.targetId === null) {
      return [{ kind: "action", text: `[live][行动][守卫] ${event.payload.actorId}号空守` }];
    }
    return [
      {
        kind: "action",
        text: `[live][行动][守卫] ${event.payload.actorId}号守护${event.payload.targetId}号`,
      },
    ];
  },
};
