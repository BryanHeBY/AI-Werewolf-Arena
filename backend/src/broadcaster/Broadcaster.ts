import { Server } from 'socket.io';
import { BroadcastEvent } from '../core/types';

export class Broadcaster {
  private io: Server;

  constructor(io: Server) {
    this.io = io;
  }

  broadcast(event: BroadcastEvent): void {
    this.io.emit('gameEvent', event);
  }

  broadcastToRoom(roomId: string, event: BroadcastEvent): void {
    this.io.to(roomId).emit('gameEvent', event);
  }
}
