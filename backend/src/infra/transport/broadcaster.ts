import { Server } from "socket.io";

export interface RealtimeGameEvent {
  type: string;
  data: Record<string, unknown>;
  timestamp: number;
}

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
