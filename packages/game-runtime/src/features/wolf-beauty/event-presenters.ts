/**
 * 负责本机制已有事件的脚本行、终端分类及阶段标签贡献。输入为原GameEvent、语言和私有输出开关，输出原文案与展示阶段。
 * 不提交行动、重算规则或扩大受众；私有分支保留原短路与payload读取顺序。
 */
import type * as ScriptRendering from "../../agents/presentation/contracts";
import { text as defaultText } from "@ai-werewolf-arena/game-text";
import { type PlayerText } from "@ai-werewolf-arena/game-presentation";

export const WOLF_BEAUTY_EVENT_JUDGE_HANDLERS: ScriptRendering.ScriptJudgeLineHandlers = {
  charm_applied: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    text(locale, "console.charm.applied", {
      actor: event.payload.actorId,
      target: event.payload.targetId ?? text(locale, "common.none"),
      day: event.payload.day,
    }),
  charm_death: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    text(locale, "console.charm.death", {
      actor: event.payload.actorId,
      target: event.payload.targetId,
    }),
  charm_blocked: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    text(locale, "console.charm.blocked", {
      actor: event.payload.actorId,
      target: event.payload.targetId,
    }),
};

export const WOLF_BEAUTY_EVENT_LIVE_HANDLERS: ScriptRendering.ScriptLiveRenderHandlers = {
  charm_applied: (event, privateEvents, locale = "zh-CN", text: PlayerText = defaultText) =>
    privateEvents
      ? [
          {
            kind: "private",
            text: text(locale, "console.charm.applied", {
              actor: event.payload.actorId,
              target: event.payload.targetId ?? text(locale, "common.none"),
              day: event.payload.day,
            }),
          },
        ]
      : [],
  charm_death: (event, privateEvents, locale = "zh-CN", text: PlayerText = defaultText) =>
    privateEvents
      ? [
          {
            kind: "private",
            text: text(locale, "console.charm.death", {
              actor: event.payload.actorId,
              target: event.payload.targetId,
            }),
          },
        ]
      : [],
  charm_blocked: (event, privateEvents, locale = "zh-CN", text: PlayerText = defaultText) =>
    privateEvents
      ? [
          {
            kind: "private",
            text: text(locale, "console.charm.blocked", {
              actor: event.payload.actorId,
              target: event.payload.targetId,
            }),
          },
        ]
      : [],
};
