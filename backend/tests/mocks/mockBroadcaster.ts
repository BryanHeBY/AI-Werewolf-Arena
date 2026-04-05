import { BroadcastEvent, BroadcastEventType } from "../../src/core/types";

export class MockBroadcaster {
  private events: BroadcastEvent[] = [];
  private playerSockets: Map<number, string> = new Map();
  private socketPlayers: Map<string, number> = new Map();

  broadcast(event: BroadcastEvent): void {
    this.events.push(event);
  }

  broadcastToPlayer(playerId: number, event: BroadcastEvent): boolean {
    if (this.playerSockets.has(playerId)) {
      this.events.push(event);
      return true;
    }
    return false;
  }

  broadcastToRoom(roomId: string, event: BroadcastEvent): void {
    this.events.push(event);
  }

  broadcastExcept(event: BroadcastEvent, excludePlayerIds: number[]): void {
    this.events.push(event);
  }

  registerPlayer(socketId: string, playerId: number): void {
    this.playerSockets.set(playerId, socketId);
    this.socketPlayers.set(socketId, playerId);
  }

  unregisterSocket(socketId: string): void {
    const playerId = this.socketPlayers.get(socketId);
    if (playerId) {
      this.playerSockets.delete(playerId);
    }
    this.socketPlayers.delete(socketId);
  }

  getEvents(): BroadcastEvent[] {
    return [...this.events];
  }

  getEventsByType(type: BroadcastEventType): BroadcastEvent[] {
    return this.events.filter((event) => event.type === type);
  }

  clearEvents(): void {
    this.events = [];
  }

  getPlayerSocket(playerId: number): string | undefined {
    return this.playerSockets.get(playerId);
  }

  getSocketPlayer(socketId: string): number | undefined {
    return this.socketPlayers.get(socketId);
  }

  hasPlayer(playerId: number): boolean {
    return this.playerSockets.has(playerId);
  }

  hasSocket(socketId: string): boolean {
    return this.socketPlayers.has(socketId);
  }
}

export function createMockBroadcastEvent(
  type: BroadcastEventType = BroadcastEventType.PhaseChanged,
  data: any = {},
  timestamp: number = Date.now(),
): BroadcastEvent {
  return {
    type,
    data,
    timestamp,
  };
}
