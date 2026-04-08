import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { appConfig } from "../config";
import { Broadcaster } from "../infra/transport/broadcaster";

let globalBroadcaster: Broadcaster | null = null;

export function setupSocket(server: HttpServer): Server {
  const io = new Server(server, {
    cors: {
      origin: appConfig.corsOrigin,
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("客户端连接:", socket.id);

    socket.on("register", (data: { playerId: number }) => {
      if (typeof data?.playerId === "number" && globalBroadcaster) {
        globalBroadcaster.registerPlayer(socket.id, data.playerId);
      }
    });

    socket.on("disconnect", () => {
      if (globalBroadcaster) {
        globalBroadcaster.unregisterSocket(socket.id);
      }
      console.log("客户端断开连接:", socket.id);
    });
  });

  return io;
}

export function setGlobalBroadcaster(broadcaster: Broadcaster): void {
  globalBroadcaster = broadcaster;
}
