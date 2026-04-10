import { GameEvent } from "../../domain/model";
import { RealtimeGameEvent } from "../../infra/transport/broadcaster";
import { FrontendGameState } from "../../server/view_mapper";

export interface RealtimeTranslateContext {
  nowState: FrontendGameState;
  getPlayerName: (playerId: number) => string;
  getPlayerRole: (playerId: number) => string;
}

export type RealtimeEventHandler = (
  event: GameEvent,
  ctx: RealtimeTranslateContext,
) => RealtimeGameEvent[];

