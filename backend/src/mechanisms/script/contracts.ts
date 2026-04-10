import { GameEvent } from "../../domain/model";

export type ScriptLiveKind =
  | "chat"
  | "action"
  | "private"
  | "god"
  | "system"
  | "end";

export interface ScriptLiveRender {
  kind: ScriptLiveKind;
  text: string;
}

export type ScriptChatLineHandler = (event: GameEvent) => string | null;
export type ScriptJudgeLineHandler = (event: GameEvent) => string | null;
export type ScriptReplayStageHandler = (event: GameEvent) => string | null;
export type ScriptLiveRenderHandler = (
  event: GameEvent,
  printPrivateEvents: boolean,
) => ScriptLiveRender[] | null;

