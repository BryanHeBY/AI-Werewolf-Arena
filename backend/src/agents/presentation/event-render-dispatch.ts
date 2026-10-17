/**
 * 负责有序展示贡献的通用调用。输入为原事件、既有贡献、私有开关和语言，输出首个匹配文本或终端行。
 * 每个label按调用时重新读取type/payload；null继续、空数组终止、孤女truthy例外显式保留，不读取状态或赋予受众。
 */
import type { Locale } from "@ai-werewolf-arena/game-text";
import type { PlayerText } from "@ai-werewolf-arena/game-presentation";
import type { GameEvent } from "../../domain/model";
import type {
  ScriptJudgeLineHandlers,
  ScriptLiveKind,
  ScriptLiveRender,
  ScriptLiveRenderHandlers,
  ScriptEventLabel,
  JudgeLabelContribution,
  ScriptLiveLabelRenderer,
  LiveRenderContribution,
} from "./contracts";

export function firstJudgeLabel(
  contributions: readonly JudgeLabelContribution[],
  event: GameEvent,
  locale: Locale,
  text: PlayerText,
): string | null {
  for (const contribution of contributions) {
    // 原路径是直接调用导入函数，不能因贡献对象而意外新增this绑定。
    const render = contribution.label;
    const label = render(event.type, event.payload, locale, text);
    if (contribution.truthy ? Boolean(label) : label !== null) return label;
  }
  return null;
}
export function labelLiveContribution(
  label: ScriptEventLabel,
  render: ScriptLiveLabelRenderer,
  truthy = false,
): LiveRenderContribution {
  return (event, printPrivateEvents, locale, text) => {
    const line = label(event.type, event.payload, locale, text);
    return (truthy ? Boolean(line) : line !== null)
      ? render(event, printPrivateEvents, line!)
      : null;
  };
}
export const privateLabelRows =
  (kind: ScriptLiveKind): ScriptLiveLabelRenderer =>
  (_event, printPrivateEvents, label) =>
    printPrivateEvents ? [{ kind, text: label }] : [];
export const publicLabelRows =
  (kind: ScriptLiveKind): ScriptLiveLabelRenderer =>
  (_event, _private, label) => [{ kind, text: label }];

export function firstLiveRender(
  contributions: readonly LiveRenderContribution[],
  event: GameEvent,
  printPrivateEvents: boolean,
  locale: Locale,
  text: PlayerText,
): ScriptLiveRender[] | null {
  for (const contribution of contributions) {
    const result = contribution(event, printPrivateEvents, locale, text);
    if (result !== null) return result;
  }
  return null;
}
export function dispatchLineHandler(
  handlers: ScriptJudgeLineHandlers,
  event: GameEvent,
  locale: Locale,
  text: PlayerText,
): string | null {
  const handler = handlers[event.type];
  return handler
    ? (handler as (event: GameEvent, locale: Locale, text?: PlayerText) => string | null)(
        event,
        locale,
        text,
      )
    : null;
}
export function dispatchLiveHandler(
  handlers: ScriptLiveRenderHandlers,
  event: GameEvent,
  printPrivateEvents: boolean,
  locale: Locale,
  text: PlayerText,
): ScriptLiveRender[] | null {
  const handler = handlers[event.type];
  return handler
    ? (
        handler as (
          event: GameEvent,
          printPrivateEvents: boolean,
          locale: Locale,
          text?: PlayerText,
        ) => ScriptLiveRender[] | null
      )(event, printPrivateEvents, locale, text)
    : null;
}
export const liveHandlerContribution =
  (handlers: ScriptLiveRenderHandlers): LiveRenderContribution =>
  (event, printPrivateEvents, locale, text) =>
    dispatchLiveHandler(handlers, event, printPrivateEvents, locale, text);
