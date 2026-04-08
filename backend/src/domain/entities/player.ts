import { EntityId } from "../model";

export interface IdentityComponent {
  id: EntityId;
  seat: number;
  name: string;
  sessionId: string;
}

export function createIdentityComponent(
  id: EntityId,
  seat: number,
  name: string,
): IdentityComponent {
  return {
    id,
    seat,
    name,
    sessionId: `player_${id}`,
  };
}
