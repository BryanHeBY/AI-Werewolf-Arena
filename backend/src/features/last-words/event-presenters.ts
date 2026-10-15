/**
 * 负责把遗言授予／已发言事件转为裁判行和终端展示贡献。输入为原事件及可选语言；
 * 输出为原本地化文案／system 行。只消费既有事实，不授予遗言、调用模型、扩大事件受众或改写发言。
 */
import { text } from "@ai-werewolf-arena/game-text";
import type {
  ScriptJudgeLineHandlers,
  ScriptLiveRenderHandlers,
} from "../../agents/presentation/contracts";
export const LAST_WORDS_SCRIPT_JUDGE_HANDLERS: ScriptJudgeLineHandlers = {
  last_words_granted: (event, locale = "zh-CN") =>
    text(locale, "console.judge.last_granted", { actor: event.payload.playerId }),
  last_words_spoken: (event, locale = "zh-CN") =>
    text(locale, "console.judge.last_spoken", {
      actor: event.payload.playerId,
      speech: event.payload.text,
    }),
};
export const LAST_WORDS_SCRIPT_LIVE_HANDLERS: ScriptLiveRenderHandlers = {
  last_words_spoken: (event, _private, locale = "zh-CN") => [
    {
      kind: "system",
      text: text(locale, "console.live.last_words", {
        actor: event.payload.playerId,
        speech: event.payload.text,
      }),
    },
  ],
};
