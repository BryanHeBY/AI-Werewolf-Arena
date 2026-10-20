/**
 * 负责本机制已有事件的脚本行、终端分类及阶段标签贡献。输入为原GameEvent、语言和私有输出开关，输出原文案与展示阶段。
 * 不提交行动、重算规则或扩大受众；私有分支保留原短路与payload读取顺序。
 */
import type * as ScriptRendering from "../../agents/presentation/contracts";
import { text as defaultText } from "@ai-werewolf-arena/game-text";
import { type PlayerText } from "@ai-werewolf-arena/game-presentation";

export const NIGHT_ABILITIES_EVENT_JUDGE_HANDLERS: ScriptRendering.ScriptJudgeLineHandlers = {
  lucky_ability_skipped: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    text(locale, "console.lucky.skipped", {
      actor: event.payload.actorId,
      day: event.payload.day,
      ability: event.payload.abilityId,
    }),
};

export const NIGHT_ABILITIES_EVENT_STAGE_HANDLERS: ScriptRendering.ScriptReplayStageHandlers = {
  awakened_inherited: () => "awakened_inherited",
  awakened_ready: () => "awakened_activation",
  awakened_mimicked: () => "awakened_mimic",
  awakened_mimic_skipped: () => "awakened_mimic",
  awakened_poison_used: () => "awakened_skill",
  awakened_guard_chosen: () => "awakened_skill",
  awakened_skill_skipped: () => "awakened_skill",
  awakened_attack_chosen: () => "awakened_attack",
};

export const NIGHT_ABILITIES_EVENT_LIVE_HANDLERS: ScriptRendering.ScriptLiveRenderHandlers = {
  ability_changed: (event, printPrivateEvents, locale = "zh-CN", text: PlayerText = defaultText) =>
    printPrivateEvents
      ? [
          {
            kind: "private",
            text: text(locale, "ability.change", {
              actor: event.payload.actorId,
              id: event.payload.abilityId,
              kind: text(locale, `ability.kind.${event.payload.kind}`),
              operation: text(locale, `ability.operation.${event.payload.operation}`),
            }),
          },
        ]
      : [],
};

export const NIGHT_ABILITIES_EVENT_SKIPPED_LIVE_HANDLERS: ScriptRendering.ScriptLiveRenderHandlers =
  {
    lucky_ability_skipped: (
      event,
      printPrivateEvents,
      locale = "zh-CN",
      text: PlayerText = defaultText,
    ) =>
      printPrivateEvents
        ? [
            {
              kind: "private",
              text: text(locale, "console.lucky.skipped", {
                actor: event.payload.actorId,
                day: event.payload.day,
                ability: event.payload.abilityId,
              }),
            },
          ]
        : [],
  };
