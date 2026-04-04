import { Server } from "socket.io";
import { BroadcastEvent, GameState, PublicGameState } from "../core/types";
import { ViewSanitizer } from "../core/ViewSanitizer";

export class Broadcaster {
  private io: Server;
  private sanitizer: ViewSanitizer;
  private socketToPlayer: Map<string, number>;
  private playerToSocket: Map<number, string>;

  constructor(io: Server) {
    this.io = io;
    this.sanitizer = new ViewSanitizer();
    this.socketToPlayer = new Map();
    this.playerToSocket = new Map();
  }

  registerPlayer(socketId: string, playerId: number): void {
    this.socketToPlayer.set(socketId, playerId);
    this.playerToSocket.set(playerId, socketId);
    console.log(`Registered socket ${socketId} for player ${playerId}`);
  }

  unregisterSocket(socketId: string): void {
    const playerId = this.socketToPlayer.get(socketId);
    if (playerId !== undefined) {
      this.playerToSocket.delete(playerId);
      this.socketToPlayer.delete(socketId);
    }
  }

  getPlayerIdBySocket(socketId: string): number | undefined {
    return this.socketToPlayer.get(socketId);
  }

  getSocketByPlayer(playerId: number): string | undefined {
    return this.playerToSocket.get(playerId);
  }

  broadcast(event: BroadcastEvent): void {
    if (event.gameStateForView) {
      this.broadcastWithView(event, event.gameStateForView);
    } else {
      this.io.emit("gameEvent", event);
    }
  }

  private broadcastWithView(event: BroadcastEvent, gameState: GameState): void {
    if (this.socketToPlayer.size === 0) {
      const sanitized = this.sanitizer.sanitizeGameStateForViewer(gameState, 0);
      const viewEvent: BroadcastEvent = {
        ...event,
        data: {
          ...(event.data as object),
          gameState: sanitized,
        },
        gameStateForView: undefined,
      };
      this.io.emit("gameEvent", viewEvent);
      return;
    }

    for (const [socketId, playerId] of this.socketToPlayer) {
      const sanitized = this.sanitizer.sanitizeGameStateForViewer(
        gameState,
        playerId,
      );
      const viewEvent: BroadcastEvent = {
        ...event,
        data: {
          ...(event.data as object),
          gameState: sanitized,
        },
        gameStateForView: undefined,
      };
      this.io.to(socketId).emit("gameEvent", viewEvent);
    }
  }

  broadcastToRoom(roomId: string, event: BroadcastEvent): void {
    this.io.to(roomId).emit("gameEvent", event);
  }

  broadcastToPlayer(playerId: number, event: BroadcastEvent): boolean {
    const socketId = this.playerToSocket.get(playerId);
    if (socketId) {
      this.io.to(socketId).emit("gameEvent", event);
      return true;
    }
    return false;
  }

  broadcastExcept(event: BroadcastEvent, excludePlayerIds: number[]): void {
    const excludeSet = new Set(excludePlayerIds || []);

    for (const [socketId, playerId] of this.socketToPlayer) {
      if (excludeSet.has(playerId)) continue;
      this.io.to(socketId).emit("gameEvent", event);
    }

    if (this.socketToPlayer.size === 0) {
      this.io.emit("gameEvent", event);
    }
  }
}
