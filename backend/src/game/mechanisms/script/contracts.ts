/** 文件说明：脚本回放与终端渲染相关契约。 */
import { GameEvent } from "../../domain/model";

/** 终端 live 输出类型。 */
export type ScriptLiveKind =
  | "chat"
  | "action"
  | "private"
  | "god"
  | "system"
  | "end";

/** 终端 live 渲染结果结构。 */
export interface ScriptLiveRender {
  kind: ScriptLiveKind;
  text: string;
}

/** 事件 -> 聊天行处理器签名。 */
export type ScriptChatLineHandler = (event: GameEvent) => string | null;
/** 事件 -> 判词处理器签名。 */
export type ScriptJudgeLineHandler = (event: GameEvent) => string | null;
/** 事件 -> 回放阶段处理器签名。 */
export type ScriptReplayStageHandler = (event: GameEvent) => string | null;
/** 事件 -> live 渲染处理器签名。 */
export type ScriptLiveRenderHandler = (
  event: GameEvent,
  printPrivateEvents: boolean,
) => ScriptLiveRender[] | null;
