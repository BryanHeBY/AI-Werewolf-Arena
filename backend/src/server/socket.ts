import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { appConfig } from "../config";

export function setupSocket(server: HttpServer): Server {
  const io = new Server(server, {
    cors: {
      origin: appConfig.corsOrigin,
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("客户端连接:", socket.id);

    socket.on("disconnect", () => {
      console.log("客户端断开连接:", socket.id);
    });
  });

  return io;
}
