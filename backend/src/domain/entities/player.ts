import { EntityId } from "../model";

/**
 * 玩家身份组件：记录实体 ID、座位号、显示名与会话 ID。
 */
export interface IdentityComponent {
  id: EntityId;
  seat: number;
  name: string;
  sessionId: string;
}

/**
 * 创建玩家身份组件。
 */
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
