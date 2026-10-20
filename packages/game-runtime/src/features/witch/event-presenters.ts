/**
 * 负责把女巫用药／跳过事件转换为终端私有分类行。输入为原事件、私有输出开关与语言；
 * 关闭私有输出时不显示行动者、药型或目标；开启后才读取本地化药型。不消费药瓶、判定目标或重算效果，
 * 终端开关不改变独立的玩家受众投影。
 */
import type * as ScriptRendering from "../../agents/presentation/contracts";

import { type PlayerText } from "@ai-werewolf-arena/game-presentation";
import { text as defaultText } from "@ai-werewolf-arena/game-text";
import type { ScriptLiveRenderHandlers } from "../../agents/presentation/contracts";
import { getDefaultTextLocalizationRegistry } from "../../agents/presentation/text-localization-registry";
export const WITCH_SCRIPT_LIVE_HANDLERS: ScriptLiveRenderHandlers = {
  witch_potion_used: (
    event,
    printPrivateEvents,
    locale = "zh-CN",
    text: PlayerText = defaultText,
  ) =>
    printPrivateEvents
      ? [
          {
            kind: "private",
            text: text(locale, "console.live.potion", {
              actor: event.payload.actorId,
              target: event.payload.targetId,
              potion: getDefaultTextLocalizationRegistry().potionType(
                event.payload.potionType,
                locale,
              ),
            }),
          },
        ]
      : [],
  witch_potion_skipped: (
    event,
    printPrivateEvents,
    locale = "zh-CN",
    text: PlayerText = defaultText,
  ) =>
    printPrivateEvents
      ? [
          {
            kind: "private",
            text: text(locale, "console.live.potion_skip", { actor: event.payload.actorId }),
          },
        ]
      : [],
};

export const WITCH_EVENT_STAGE_HANDLERS: ScriptRendering.ScriptReplayStageHandlers = {
  witch_potion_used: () => "witch",
  witch_potion_skipped: () => "witch",
};
