import { text } from "@ai-werewolf-arena/game-text";
import type { ScriptJudgeLineHandlers, ScriptLiveRenderHandlers } from "../script/contracts";
export const LAST_WORDS_SCRIPT_JUDGE_HANDLERS: ScriptJudgeLineHandlers = {
  last_words_granted: (event, locale = "zh-CN") => text(locale, "console.judge.last_granted", { actor: event.payload.playerId }),
  last_words_spoken: (event, locale = "zh-CN") => text(locale, "console.judge.last_spoken", { actor: event.payload.playerId, speech: event.payload.text }),
};
export const LAST_WORDS_SCRIPT_LIVE_HANDLERS: ScriptLiveRenderHandlers = {
  last_words_spoken: (event, _private, locale = "zh-CN") => [{ kind: "system", text: text(locale, "console.live.last_words", { actor: event.payload.playerId, speech: event.payload.text }) }],
};
