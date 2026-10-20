/**
 * 负责本机制已有事件的脚本行、终端分类及阶段标签贡献。输入为原GameEvent、语言和私有输出开关，输出原文案与展示阶段。
 * 不提交行动、重算规则或扩大受众；私有分支保留原短路与payload读取顺序。
 */
import type * as ScriptRendering from "../../agents/presentation/contracts";
import { text as defaultText, roleName } from "@ai-werewolf-arena/game-text";
import { type PlayerText } from "@ai-werewolf-arena/game-presentation";
import { getDefaultTextLocalizationRegistry } from "../../agents/presentation/text-localization-registry";

export const INITIAL_IDENTITY_EVENT_JUDGE_HANDLERS: ScriptRendering.ScriptJudgeLineHandlers = {
  player_role_revealed: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    text(locale, "console.role_revealed", {
      actor: event.payload.playerId,
      role: roleName(event.payload.role, locale),
    }),
};

export const INITIAL_IDENTITY_EVENT_LIVE_HANDLERS: ScriptRendering.ScriptLiveRenderHandlers = {
  god_private_game_info: (
    event,
    printPrivateEvents,
    locale = "zh-CN",
    text: PlayerText = defaultText,
  ) =>
    printPrivateEvents
      ? [
          {
            kind: "god",
            text: text(locale, "console.live.initial", {
              roles: event.payload.players
                .map(
                  (item) =>
                    `${text(locale, "common.player_reference", { id: item.id })}:${getDefaultTextLocalizationRegistry().roleName(item.role, locale)}`,
                )
                .join(", "),
            }),
          },
        ]
      : [],
};
