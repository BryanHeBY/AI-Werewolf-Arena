/**
 * 负责本机制已有事件的脚本行、终端分类及阶段标签贡献。输入为原GameEvent、语言和私有输出开关，输出原文案与展示阶段。
 * 不提交行动、重算规则或扩大受众；私有分支保留原短路与payload读取顺序。
 */
import type * as ScriptRendering from "../../agents/presentation/contracts";
import { text as defaultText } from "@ai-werewolf-arena/game-text";
import { type PlayerText } from "@ai-werewolf-arena/game-presentation";
import { inspectionLabel } from "@ai-werewolf-arena/game-presentation";

export const ROLE_INSPECTION_EVENT_JUDGE_HANDLERS: ScriptRendering.ScriptJudgeLineHandlers = {
  role_inspection_skipped: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    text(locale, "console.role_inspection.skipped", {
      actor: event.payload.actorId,
      day: event.payload.day,
      reason: text(
        locale,
        event.payload.reason === "passed" ? "inspection.skip.passed" : "inspection.skip.no_targets",
      ),
    }),
  role_inspected: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    text(locale, "console.role_inspected", {
      actor: event.payload.actorId,
      target: event.payload.targetId,
      result: inspectionLabel(event.payload.result, locale, text),
    }),
};

export const ROLE_INSPECTION_EVENT_STAGE_HANDLERS: ScriptRendering.ScriptReplayStageHandlers = {
  role_inspected: () => "role_inspected",
  role_inspection_skipped: () => "role_inspection_skipped",
};

export const ROLE_INSPECTION_EVENT_LIVE_HANDLERS: ScriptRendering.ScriptLiveRenderHandlers = {
  role_inspection_skipped: (
    event,
    privateEvents,
    locale = "zh-CN",
    text: PlayerText = defaultText,
  ) =>
    privateEvents
      ? [
          {
            kind: "private",
            text: text(locale, "console.role_inspection.skipped", {
              actor: event.payload.actorId,
              day: event.payload.day,
              reason: text(
                locale,
                event.payload.reason === "passed"
                  ? "inspection.skip.passed"
                  : "inspection.skip.no_targets",
              ),
            }),
          },
        ]
      : [],
  role_inspected: (event, privateEvents, locale = "zh-CN", text: PlayerText = defaultText) =>
    privateEvents
      ? [
          {
            kind: "private",
            text: text(locale, "console.role_inspected", {
              actor: event.payload.actorId,
              target: event.payload.targetId,
              result: inspectionLabel(event.payload.result, locale, text),
            }),
          },
        ]
      : [],
};
