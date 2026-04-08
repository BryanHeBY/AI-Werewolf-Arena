import { Server } from "socket.io";

export type RealtimeVisibility =
  | { scope: "public" }
  | { scope: "wolves_only" }
  | { scope: "private_targets"; targetPlayerIds: number[] };

export interface RealtimeGameEvent {
  type: string;
  data: Record<string, unknown>;
  timestamp: number;
  visibility?: RealtimeVisibility;
}

interface RegisteredPlayer {
  playerId: number;
  role?: string;
}

/**
 * 广播器：封装 Socket.IO 发送能力，并维护 socket 与玩家 ID 的双向映射。
 */
export class Broadcaster {
  private readonly socketToPlayer: Map<string, RegisteredPlayer> = new Map();
  private readonly playerToSocket: Map<number, string> = new Map();

  constructor(private readonly io: Server) {}

  registerPlayer(socketId: string, playerId: number, role?: string): void {
    this.socketToPlayer.set(socketId, { playerId, role });
    this.playerToSocket.set(playerId, socketId);
  }

  unregisterSocket(socketId: string): void {
    const session = this.socketToPlayer.get(socketId);
    if (session !== undefined) {
      this.playerToSocket.delete(session.playerId);
      this.socketToPlayer.delete(socketId);
    }
  }

  broadcast(event: RealtimeGameEvent): void {
    const visibility = event.visibility ?? { scope: "public" as const };
    if (visibility.scope === "public") {
      // 公开事件直接全体广播。
      this.io.emit("gameEvent", event);
      return;
    }

    if (visibility.scope === "wolves_only") {
      // 狼人私有频道：仅推送给已注册且身份为狼人的连接。
      for (const [socketId, session] of this.socketToPlayer.entries()) {
        if (session.role === "wolf") {
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

  broadcastToPlayer(playerId: number, event: RealtimeGameEvent): boolean {
    const socketId = this.playerToSocket.get(playerId);
    if (!socketId) {
      return false;
    }

    this.io.to(socketId).emit("gameEvent", event);
    return true;
  }
}
