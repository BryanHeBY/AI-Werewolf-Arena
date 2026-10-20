/**
 * 负责本机制已有事件的脚本行、终端分类及阶段标签贡献。输入为原GameEvent、语言和私有输出开关，输出原文案与展示阶段。
 * 不提交行动、重算规则或扩大受众；私有分支保留原短路与payload读取顺序。
 */
import type * as ScriptRendering from "../../agents/presentation/contracts";
import { text as defaultText } from "@ai-werewolf-arena/game-text";
import { type PlayerText } from "@ai-werewolf-arena/game-presentation";

export const WHITE_WOLF_KING_EVENT_JUDGE_HANDLERS: ScriptRendering.ScriptJudgeLineHandlers = {
  white_wolf_king_self_destruct: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    event.payload.targetId === null
      ? text(locale, "console.white_wolf_king.blast_none", { actor: event.payload.actorId })
      : text(locale, "console.white_wolf_king.blast", {
          actor: event.payload.actorId,
          target: event.payload.targetId,
        }),
};

export const WHITE_WOLF_KING_EVENT_LIVE_HANDLERS: ScriptRendering.ScriptLiveRenderHandlers = {
  white_wolf_king_self_destruct: (
    event,
    _private,
    locale = "zh-CN",
    text: PlayerText = defaultText,
  ) => [
    {
      kind: "system",
      text:
        event.payload.targetId === null
          ? text(locale, "console.white_wolf_king.blast_none", { actor: event.payload.actorId })
          : text(locale, "console.white_wolf_king.blast", {
              actor: event.payload.actorId,
              target: event.payload.targetId,
            }),
    },
  ],
};
