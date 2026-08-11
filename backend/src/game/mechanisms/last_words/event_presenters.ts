/** 文件说明：遗言事件的裁判与终端渲染。 */
import { ScriptJudgeLineHandler, ScriptLiveRenderHandler } from "../script/contracts";

/** 遗言事件 -> 上帝判词渲染映射。 */
export const LAST_WORDS_SCRIPT_JUDGE_HANDLERS: Record<string, ScriptJudgeLineHandler> = {
  last_words_granted: (event) => `${event.payload.playerId}号获得遗言`,
  last_words_spoken: (event) => `${event.payload.playerId}号遗言：${event.payload.text}`,
};

/** 遗言事件 -> 终端 live 渲染映射。 */
export const LAST_WORDS_SCRIPT_LIVE_HANDLERS: Record<string, ScriptLiveRenderHandler> = {
  last_words_spoken: (event) => [
    {
      kind: "system",
      text: `[live][遗言][${event.payload.playerId}] ${event.payload.text}`,
    },
  ],
};
