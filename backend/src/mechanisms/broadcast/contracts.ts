import { EntityId, GameEvent } from "../../domain/model";

export interface AgentLineContext {
  actorId: EntityId;
  isWolf: boolean;
}

export type AgentEventLineHandler = (
  event: GameEvent,
  ctx: AgentLineContext,
) => string | null;

