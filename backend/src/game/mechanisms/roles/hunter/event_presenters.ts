import { text } from "@ai-werewolf-arena/game-text";
import type { ScriptJudgeLineHandlers } from "../../script/contracts";
export const HUNTER_SCRIPT_JUDGE_HANDLERS: ScriptJudgeLineHandlers = {
  hunter_shot: (event, locale = "zh-CN") =>
    text(locale, "console.judge.hunter", {
      actor: event.payload.hunterId,
      target: event.payload.targetId,
    }),
};
