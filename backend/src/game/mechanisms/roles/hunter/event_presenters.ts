/** 文件说明：猎人事件的裁判渲染。 */
import { ScriptJudgeLineHandlers } from "../../script/contracts";

export const HUNTER_SCRIPT_JUDGE_HANDLERS: ScriptJudgeLineHandlers = {
  hunter_shot: (event) => `${event.payload.hunterId}号猎人开枪带走${event.payload.targetId}号`,
};
