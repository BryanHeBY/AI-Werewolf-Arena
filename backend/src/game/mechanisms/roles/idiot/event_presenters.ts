import { text } from "@ai-werewolf-arena/game-text";
import type { ScriptJudgeLineHandlers } from "../../script/contracts";
export const IDIOT_SCRIPT_JUDGE_HANDLERS: ScriptJudgeLineHandlers = {
  idiot_revealed: (event, locale = "zh-CN") =>
    text(locale, "console.judge.idiot", { target: event.payload.targetId }),
};
