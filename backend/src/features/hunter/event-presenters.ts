/**
 * 负责把猎人已开枪事件转换为裁判展示行。输入为原猎人／目标 payload 与语言；输出为原本地化文案。
 * 只读取既有事实，不开死亡窗口、消费枪、映射目标或执行死亡。
 */
import { type PlayerText } from "@ai-werewolf-arena/game-presentation";
import { text as defaultText } from "@ai-werewolf-arena/game-text";
import type { ScriptJudgeLineHandlers } from "../../agents/presentation/contracts";
export const HUNTER_SCRIPT_JUDGE_HANDLERS: ScriptJudgeLineHandlers = {
  hunter_shot: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    text(locale, "console.judge.hunter", {
      actor: event.payload.hunterId,
      target: event.payload.targetId,
    }),
};
