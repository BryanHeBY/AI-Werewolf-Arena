/**
 * 负责把愚者已翻牌事件转换为裁判展示行。输入为原目标 payload 与语言；输出为原本地化翻牌文案。
 * 这里只展示已发生事实，不恢复投票权、改警徽或重复执行翻牌。
 */
import { type PlayerText } from "@ai-werewolf-arena/game-presentation";
import { text as defaultText } from "@ai-werewolf-arena/game-text";
import type { ScriptJudgeLineHandlers } from "../../agents/presentation/contracts";
export const IDIOT_SCRIPT_JUDGE_HANDLERS: ScriptJudgeLineHandlers = {
  idiot_revealed: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    text(locale, "console.judge.idiot", { target: event.payload.targetId }),
};
