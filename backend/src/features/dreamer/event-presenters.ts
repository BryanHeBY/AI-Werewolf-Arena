/**
 * 负责本机制已有事件的脚本行、终端分类及阶段标签贡献。输入为原GameEvent、语言和私有输出开关，输出原文案与展示阶段。
 * 不提交行动、重算规则或扩大受众；私有分支保留原短路与payload读取顺序。
 */
import type * as ScriptRendering from "../../agents/presentation/contracts";
import { text as defaultText } from "@ai-werewolf-arena/game-text";
import { type PlayerText } from "@ai-werewolf-arena/game-presentation";

export const DREAMER_EVENT_JUDGE_HANDLERS: ScriptRendering.ScriptJudgeLineHandlers = {
  dream_applied: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    text(locale, "console.dream.applied", {
      actor: event.payload.actorId,
      target: event.payload.targetId,
      day: event.payload.day,
      consecutive: text(locale, event.payload.consecutive ? "common.yes" : "common.no"),
    }),
  dream_death: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    text(locale, "console.dream.death", {
      actor: event.payload.actorId,
      target: event.payload.targetId,
      day: event.payload.day,
      reason: text(
        locale,
        event.payload.reason === "consecutive"
          ? "console.dream.consecutive"
          : "console.dream.linked",
      ),
    }),
};

export const DREAMER_EVENT_STAGE_HANDLERS: ScriptRendering.ScriptReplayStageHandlers = {
  dream_applied: () => "dreamer",
  dream_death: () => "dream_death",
};

export const DREAMER_EVENT_LIVE_HANDLERS: ScriptRendering.ScriptLiveRenderHandlers = {
  dream_applied: (event, privateEvents, locale = "zh-CN", text: PlayerText = defaultText) =>
    privateEvents
      ? [
          {
            kind: "private",
            text: text(locale, "console.dream.applied", {
              actor: event.payload.actorId,
              target: event.payload.targetId,
              day: event.payload.day,
              consecutive: text(locale, event.payload.consecutive ? "common.yes" : "common.no"),
            }),
          },
        ]
      : [],
  dream_death: (event, privateEvents, locale = "zh-CN", text: PlayerText = defaultText) =>
    privateEvents
      ? [
          {
            kind: "private",
            text: text(locale, "console.dream.death", {
              actor: event.payload.actorId,
              target: event.payload.targetId,
              day: event.payload.day,
              reason: text(
                locale,
                event.payload.reason === "consecutive"
                  ? "console.dream.consecutive"
                  : "console.dream.linked",
              ),
            }),
          },
        ]
      : [],
};
