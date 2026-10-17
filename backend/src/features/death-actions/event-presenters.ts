/**
 * 负责本机制已有事件的脚本行、终端分类及阶段标签贡献。输入为原GameEvent、语言和私有输出开关，输出原文案与展示阶段。
 * 不提交行动、重算规则或扩大受众；私有分支保留原短路与payload读取顺序。
 */
import type * as ScriptRendering from "../../agents/presentation/contracts";
import { text as defaultText } from "@ai-werewolf-arena/game-text";
import { type PlayerText } from "@ai-werewolf-arena/game-presentation";
import { deathAbilityEventLabel } from "@ai-werewolf-arena/game-presentation";

export const DEATH_ACTIONS_EVENT_JUDGE_HANDLERS: ScriptRendering.ScriptJudgeLineHandlers = {
  player_shot: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    text(locale, "console.player_shot", {
      actor: event.payload.actorId,
      target: event.payload.targetId,
    }),
  death_shot_blocked: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    text(locale, "console.shot.blocked", {
      actor: event.payload.actorId,
      target: event.payload.targetId,
    }),
};

export const DEATH_ACTIONS_EVENT_STAGE_HANDLERS: ScriptRendering.ScriptReplayStageHandlers = {
  player_shot: () => "death_shot",
};

export const DEATH_ACTIONS_EVENT_LIVE_HANDLERS: ScriptRendering.ScriptLiveRenderHandlers = {
  player_shot: (event, _private, locale = "zh-CN", text: PlayerText = defaultText) => [
    {
      kind: "action",
      text: text(locale, "console.player_shot", {
        actor: event.payload.actorId,
        target: event.payload.targetId,
      }),
    },
  ],
  death_shot_blocked: (event, _private, locale = "zh-CN", text: PlayerText = defaultText) => [
    {
      kind: "system",
      text: text(locale, "console.shot.blocked", {
        actor: event.payload.actorId,
        target: event.payload.targetId,
      }),
    },
  ],
  death_ability_changed: (
    event,
    printPrivateEvents,
    locale = "zh-CN",
    text: PlayerText = defaultText,
  ) =>
    printPrivateEvents
      ? [
          {
            kind: "private",
            text: deathAbilityEventLabel(event.type, event.payload, locale, text)!,
          },
        ]
      : [],
};
