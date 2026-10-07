import type { Locale } from "@ai-werewolf-arena/game-text";
/** 文件说明：脚本回放与终端渲染相关契约。 */
import type { GameEvent } from "../../../core/domain/model";

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

/** A handler receives the payload belonging to its registered event type. */
type ScriptEventHandlers<T> = {
  [K in GameEvent["type"]]?: (event: Extract<GameEvent, { type: K }>, locale?: Locale) => T;
};

export type ScriptChatLineHandlers = ScriptEventHandlers<string | null>;
export type ScriptJudgeLineHandlers = ScriptEventHandlers<string | null>;
export type ScriptReplayStageHandlers = ScriptEventHandlers<string | null>;
export type ScriptLiveRenderHandlers = {
  [K in GameEvent["type"]]?: (
    event: Extract<GameEvent, { type: K }>,
    printPrivateEvents: boolean,
    locale?: Locale,
  ) => ScriptLiveRender[] | null;
};
