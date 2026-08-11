/** 文件说明：白痴翻牌事件的裁判渲染。 */
import { ScriptJudgeLineHandler } from "../../script/contracts";

export const IDIOT_SCRIPT_JUDGE_HANDLERS: Record<string, ScriptJudgeLineHandler> = {
  idiot_revealed: (event) =>
    `${event.payload.targetId}号翻牌为白痴，免于放逐并失去投票权`,
};
