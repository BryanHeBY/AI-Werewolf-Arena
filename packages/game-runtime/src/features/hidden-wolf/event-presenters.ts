/**
 * 负责本机制已有事件的脚本行、终端分类及阶段标签贡献。输入为原GameEvent、语言和私有输出开关，输出原文案与展示阶段。
 * 不提交行动、重算规则或扩大受众；私有分支保留原短路与payload读取顺序。
 */
import type * as ScriptRendering from "../../agents/presentation/contracts";
import { text as defaultText } from "@ai-werewolf-arena/game-text";
import { type PlayerText } from "@ai-werewolf-arena/game-presentation";

export const HIDDEN_WOLF_EVENT_JUDGE_HANDLERS: ScriptRendering.ScriptJudgeLineHandlers = {
  hidden_wolf_awakened: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    text(locale, "console.hidden_wolf.awakened", {
      actor: event.payload.actorId,
      day: event.payload.day,
    }),
};

export const HIDDEN_WOLF_EVENT_STAGE_HANDLERS: ScriptRendering.ScriptReplayStageHandlers = {
  hidden_wolf_awakened: () => "hidden_wolf_awakened",
};

export const HIDDEN_WOLF_EVENT_LIVE_HANDLERS: ScriptRendering.ScriptLiveRenderHandlers = {
  hidden_wolf_awakened: (event, privateEvents, locale = "zh-CN", text: PlayerText = defaultText) =>
    privateEvents
      ? [
          {
            kind: "private",
            text: text(locale, "console.hidden_wolf.awakened", {
              actor: event.payload.actorId,
              day: event.payload.day,
            }),
          },
        ]
      : [],
};
