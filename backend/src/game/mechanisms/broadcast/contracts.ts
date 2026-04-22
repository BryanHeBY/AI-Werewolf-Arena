/** 文件说明：定义玩家可见广播行渲染契约。 */
import { EntityId, GameEvent } from "../../../core/domain/model";

/** 广播渲染上下文。 */
export interface AgentLineContext {
  actorId: EntityId;
  isWolf: boolean;
}

/** 单条事件转换为玩家可见文本行的处理函数签名。 */
export type AgentEventLineHandler = (
  event: GameEvent,
  ctx: AgentLineContext,
) => string | null;
