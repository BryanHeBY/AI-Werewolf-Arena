/**
 * 负责把守卫已应用事件转换为终端行动行。输入为原事件、私有输出开关和语言；输出为守护或放弃的本地化文本。
 * 终端消费全量事件，关闭私有输出时不读取守护目标；玩家受众投影独立处理，不在这里执行保护或登记标记。
 */
import { text } from "@ai-werewolf-arena/game-text";
import type { ScriptLiveRenderHandlers } from "../../agents/presentation/contracts";
export const GUARD_SCRIPT_LIVE_HANDLERS: ScriptLiveRenderHandlers = {
  guard_applied: (event, printPrivateEvents, locale = "zh-CN") =>
    printPrivateEvents
      ? [
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
        ]
      : [],
};
