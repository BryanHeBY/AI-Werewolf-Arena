/**
 * 负责按既有贡献顺序调用脚本和终端展示。输入为原事件、私有输出开关与语言，输出聊天／裁判／阶段文本及分类行。
 * 机制文案与受众由组合根装配；本层只保null、空数组和truthy回退及默认实例，不读取状态、重算规则或扩大私有受众。
 */
import { type PlayerText } from "@ai-werewolf-arena/game-presentation";
import { text as defaultText, type Locale } from "@ai-werewolf-arena/game-text";
import type { GameEvent } from "../../domain/model";
import type { ScriptLiveRender } from "./contracts";
import {
  CHAT_HANDLERS,
  JUDGE_HANDLERS,
  REPLAY_STAGE_HANDLERS,
  LIVE_HANDLERS,
  JUDGE_LABEL_CONTRIBUTIONS,
  LIVE_LABEL_CONTRIBUTIONS,
} from "./event-render-assembly";
import {
  dispatchLineHandler,
  dispatchLiveHandler,
  firstJudgeLabel,
  firstLiveRender,
} from "./event-render-dispatch";

export class ScriptEventRenderRegistry {
  toChatLine(
    event: GameEvent,
    locale: Locale = "zh-CN",
    text: PlayerText = defaultText,
  ): string | null {
    return dispatchLineHandler(CHAT_HANDLERS, event, locale, text);
  }
  toJudgeLine(
    event: GameEvent,
    locale: Locale = "zh-CN",
    text: PlayerText = defaultText,
  ): string | null {
    const label = firstJudgeLabel(JUDGE_LABEL_CONTRIBUTIONS, event, locale, text);
    return label !== null ? label : dispatchLineHandler(JUDGE_HANDLERS, event, locale, text);
  }
  toReplayStage(event: GameEvent): string {
    const handler = REPLAY_STAGE_HANDLERS[event.type];
    if (handler) return (handler as (event: GameEvent) => string | null)(event) ?? event.type;
    return event.type;
  }
  toLiveRender(
    event: GameEvent,
    printPrivateEvents: boolean,
    locale: Locale = "zh-CN",
    text: PlayerText = defaultText,
  ): ScriptLiveRender[] {
    const contribution = firstLiveRender(
      LIVE_LABEL_CONTRIBUTIONS,
      event,
      printPrivateEvents,
      locale,
      text,
    );
    // 空数组是已经处理且被隐藏的事实，不能继续回退到judge而泄露私有文案。
    if (contribution !== null) return contribution;
    const rendered = dispatchLiveHandler(LIVE_HANDLERS, event, printPrivateEvents, locale, text);
    if (rendered) return rendered;
    // 保留动态this调用，既有子类／自定义入口仍可覆盖judge回退。
    const judge = this.toJudgeLine(event, locale, text);
    return judge ? [{ kind: "god", text: text(locale, "console.live.god", { line: judge }) }] : [];
  }
}
let defaultRegistry: ScriptEventRenderRegistry | null = null;
export function getDefaultScriptEventRenderRegistry(): ScriptEventRenderRegistry {
  if (!defaultRegistry) defaultRegistry = new ScriptEventRenderRegistry();
  return defaultRegistry;
}
