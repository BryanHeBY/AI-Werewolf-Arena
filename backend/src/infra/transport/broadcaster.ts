import { Server } from "socket.io";

export interface RealtimeGameEvent {
  type: string;
  data: Record<string, unknown>;
  timestamp: number;
}

/**
 * 广播器：封装 Socket.IO 发送能力，并维护 socket 与玩家 ID 的双向映射。
 */
export class Broadcaster {
  private readonly socketToPlayer: Map<string, number> = new Map();
  private readonly playerToSocket: Map<number, string> = new Map();

  constructor(private readonly io: Server) {}

  registerPlayer(socketId: string, playerId: number): void {
    this.socketToPlayer.set(socketId, playerId);
    this.playerToSocket.set(playerId, socketId);
  }

  unregisterSocket(socketId: string): void {
    const playerId = this.socketToPlayer.get(socketId);
    if (playerId !== undefined) {
      this.playerToSocket.delete(playerId);
      this.socketToPlayer.delete(socketId);
    }
  }

  broadcast(event: RealtimeGameEvent): void {
    // 全局广播给所有在线客户端。
    this.io.emit("gameEvent", event);
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
