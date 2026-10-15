/**
 * 负责把守卫已应用事件转换为终端行动行。输入为原事件和语言；输出为守护或放弃的原本地化文本。
 * 只按原 abstain／null 分支展示，不查目标生命、执行保护、登记标记或扩大受众。
 */
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
