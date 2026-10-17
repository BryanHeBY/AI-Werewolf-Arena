/**
 * 负责本机制已有事件的脚本行、终端分类及阶段标签贡献。输入为原GameEvent、语言和私有输出开关，输出原文案与展示阶段。
 * 不提交行动、重算规则或扩大受众；私有分支保留原短路与payload读取顺序。
 */
import type * as ScriptRendering from "../../agents/presentation/contracts";
import { text as defaultText } from "@ai-werewolf-arena/game-text";
import { type PlayerText } from "@ai-werewolf-arena/game-presentation";

export const BEAR_EVENT_JUDGE_HANDLERS: ScriptRendering.ScriptJudgeLineHandlers = {
  bear_roared: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    text(locale, "console.bear.report", {
      day: event.payload.day,
      result: text(locale, event.payload.roared ? "bear.roar" : "bear.quiet"),
    }),
};

export const BEAR_EVENT_STAGE_HANDLERS: ScriptRendering.ScriptReplayStageHandlers = {
  bear_roared: () => "bear_roared",
};

export const BEAR_EVENT_LIVE_HANDLERS: ScriptRendering.ScriptLiveRenderHandlers = {
  bear_roared: (event, _private, locale = "zh-CN", text: PlayerText = defaultText) => [
    {
      kind: "system",
      text: text(locale, "console.bear.report", {
        day: event.payload.day,
        result: text(locale, event.payload.roared ? "bear.roar" : "bear.quiet"),
      }),
    },
  ],
};
