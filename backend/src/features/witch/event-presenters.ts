/**
 * 负责把女巫用药／跳过事件转换为终端私有分类行。输入为原 payload 与语言；
 * 输出为原用药文案，瓶型名称在 handler 内晚查翻译注册表。此贡献不自行用 _private 参数过滤事件，
 * 受众分派仍由上游拥有；不消费药瓶、判定目标或重算效果。
 */
import { text } from "@ai-werewolf-arena/game-text";
import type { ScriptLiveRenderHandlers } from "../../agents/presentation/contracts";
import { getDefaultTextLocalizationRegistry } from "../../agents/presentation/text-localization-registry";
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
