import { Server } from "socket.io";
import { Camp } from "../../domain/model";
import { getDefaultVisibilityRegistry } from "../../game/mechanisms";

/**
 * 实时事件可见性定义。
 */
export type RealtimeVisibility =
  | { scope: "public" }
  | { scope: "wolves_only" }
  | { scope: "private_targets"; targetPlayerIds: number[] };

/**
 * 实时广播事件结构。
 */
export interface RealtimeGameEvent {
  type: string;
  data: Record<string, unknown>;
  timestamp: number;
  visibility?: RealtimeVisibility;
}

interface RegisteredPlayer {
  playerId: number;
  role?: string;
  camp?: Camp | string;
}

/**
 * 广播器：封装 Socket.IO 发送能力，并维护 socket 与玩家 ID 的双向映射。
 */
export class Broadcaster {
  private readonly socketToPlayer: Map<string, RegisteredPlayer> = new Map();
  private readonly playerToSocket: Map<number, string> = new Map();

  constructor(private readonly io: Server) {}

  /**
   * 注册玩家与 socket 绑定关系。
   */
  registerPlayer(
    socketId: string,
    playerId: number,
    role?: string,
    camp?: Camp | string,
  ): void {
    this.socketToPlayer.set(socketId, { playerId, role, camp });
    this.playerToSocket.set(playerId, socketId);
  }

  /**
   * 断开时清理 socket 绑定关系。
   */
  unregisterSocket(socketId: string): void {
    const session = this.socketToPlayer.get(socketId);
    if (session !== undefined) {
      this.playerToSocket.delete(session.playerId);
      this.socketToPlayer.delete(socketId);
    }
  }

  /**
   * 按可见性策略广播事件。
   */
  broadcast(event: RealtimeGameEvent): void {
    const visibility = event.visibility ?? { scope: "public" as const };
    if (visibility.scope === "public") {
      // 公开事件直接全体广播。
      this.io.emit("gameEvent", event);
      return;
    }

    if (visibility.scope === "wolves_only") {
      // 狼队私有频道：通过机制层可见性规则判断可见对象。
      for (const [socketId, session] of this.socketToPlayer.entries()) {
        if (getDefaultVisibilityRegistry().isWolfAudience(session)) {
          this.io.to(socketId).emit("gameEvent", event);
        }
      }
      return;
    }

    // 点对点私有频道：仅推送给目标玩家列表。
    const sentSocketIds = new Set<string>();
    for (const playerId of visibility.targetPlayerIds) {
      const socketId = this.playerToSocket.get(playerId);
      if (!socketId || sentSocketIds.has(socketId)) {
        continue;
      }
      sentSocketIds.add(socketId);
      this.io.to(socketId).emit("gameEvent", event);
    }
  }

  /**
   * 定向向单个玩家推送事件。
   */
  broadcastToPlayer(playerId: number, event: RealtimeGameEvent): boolean {
    const socketId = this.playerToSocket.get(playerId);
    if (!socketId) {
      return false;
    }

    this.io.to(socketId).emit("gameEvent", event);
    return true;
  }
}
