/** 文件说明：实时事件转换相关契约。 */
import { GameEvent } from "../../../domain/model";
import { RealtimeGameEvent } from "../../../infra/transport/broadcaster";
import { FrontendGameState } from "../../../server/view_mapper";

/** 实时事件转换上下文。 */
export interface RealtimeTranslateContext {
  nowState: FrontendGameState;
  getPlayerName: (playerId: number) => string;
  getPlayerRole: (playerId: number) => string;
}

/** 事件 -> 实时事件数组处理器签名。 */
export type RealtimeEventHandler = (
  event: GameEvent,
  ctx: RealtimeTranslateContext,
) => RealtimeGameEvent[];
