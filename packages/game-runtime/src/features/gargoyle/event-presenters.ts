/**
 * 负责本机制已有事件的脚本行、终端分类及阶段标签贡献。输入为原GameEvent、语言和私有输出开关，输出原文案与展示阶段。
 * 不提交行动、重算规则或扩大受众；私有分支保留原短路与payload读取顺序。
 */
import type * as ScriptRendering from "../../agents/presentation/contracts";
import { text as defaultText } from "@ai-werewolf-arena/game-text";
import { type PlayerText } from "@ai-werewolf-arena/game-presentation";

export const GARGOYLE_EVENT_JUDGE_HANDLERS: ScriptRendering.ScriptJudgeLineHandlers = {
  gargoyle_awakened: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    text(locale, "console.gargoyle.awakened", {
      actor: event.payload.actorId,
      day: event.payload.day,
    }),
};

export const GARGOYLE_EVENT_STAGE_HANDLERS: ScriptRendering.ScriptReplayStageHandlers = {
  gargoyle_awakened: () => "gargoyle_awakened",
};

export const GARGOYLE_EVENT_LIVE_HANDLERS: ScriptRendering.ScriptLiveRenderHandlers = {
  gargoyle_awakened: (event, privateEvents, locale = "zh-CN", text: PlayerText = defaultText) =>
    privateEvents
      ? [
          {
            kind: "private",
            text: text(locale, "console.gargoyle.awakened", {
              actor: event.payload.actorId,
              day: event.payload.day,
            }),
          },
        ]
      : [],
};
