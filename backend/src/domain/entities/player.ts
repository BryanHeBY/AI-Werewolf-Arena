import { EntityId } from "../model";

// 玩家实体的身份组件（座位号、展示名、会话ID）。
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
    // 会话 ID 目前采用稳定前缀 + 实体 ID，便于日志排查。
    sessionId: `player_${id}`,
  };
}
