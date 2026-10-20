/**
 * 负责本机制已有事件的脚本行、终端分类及阶段标签贡献。输入为原GameEvent、语言和私有输出开关，输出原文案与展示阶段。
 * 不提交行动、重算规则或扩大受众；私有分支保留原短路与payload读取顺序。
 */
import type * as ScriptRendering from "../../agents/presentation/contracts";
import { text as defaultText } from "@ai-werewolf-arena/game-text";
import { type PlayerText } from "@ai-werewolf-arena/game-presentation";
import { readGravekeeperFeedback } from "@ai-werewolf-arena/replay-contract";
import { inspectionLabel } from "@ai-werewolf-arena/game-presentation";
import { type Locale } from "@ai-werewolf-arena/game-text";

function gravekeeperLabel(
  payload: unknown,
  locale: Locale,
  text: PlayerText = defaultText,
): string {
  const report = readGravekeeperFeedback(payload);
  return report
    ? text(locale, "console.gravekeeper.report", {
        actor: report.actorId,
        target: report.targetId,
        exileDay: report.exileDay,
        receivedDay: report.receivedDay,
        result: inspectionLabel(report.result, locale, text),
      })
    : text(locale, "replay.unknown");
}
export const GRAVEKEEPER_EVENT_JUDGE_HANDLERS: ScriptRendering.ScriptJudgeLineHandlers = {
  gravekeeper_reported: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    gravekeeperLabel(event.payload, locale, text),
};

export const GRAVEKEEPER_EVENT_STAGE_HANDLERS: ScriptRendering.ScriptReplayStageHandlers = {
  gravekeeper_reported: () => "gravekeeper_feedback",
};

export const GRAVEKEEPER_EVENT_LIVE_HANDLERS: ScriptRendering.ScriptLiveRenderHandlers = {
  gravekeeper_reported: (
    event,
    printPrivateEvents,
    locale = "zh-CN",
    text: PlayerText = defaultText,
  ) =>
    printPrivateEvents
      ? [{ kind: "private", text: gravekeeperLabel(event.payload, locale, text) }]
      : [],
};
