import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { appConfig } from "../runtime/config";
import { Role } from "../core/domain/model";
import { Broadcaster } from "../infra/transport/broadcaster";
import { getDefaultRoleCampRegistry } from "../game/mechanisms";

let globalBroadcaster: Broadcaster | null = null;
const roleCampRegistry = getDefaultRoleCampRegistry();

/**
 * Socket 层仅负责连接管理与玩家注册，不承载游戏规则逻辑。
 */
export function setupSocket(server: HttpServer): Server {
  const io = new Server(server, {
    cors: {
      origin: appConfig.corsOrigin,
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("客户端连接:", socket.id);

    socket.on("register", (data: { playerId: number; role?: string; camp?: string }) => {
      if (typeof data?.playerId === "number" && globalBroadcaster) {
        const role =
          typeof data?.role === "string" && isValidRole(data.role)
            ? data.role
            : undefined;
        const camp =
          typeof data?.camp === "string"
            ? data.camp
            : role
              ? roleCampRegistry.get(role)
              : undefined;
        // 建立“玩家 -> socket”映射，便于后续点对点推送私有事件。
        globalBroadcaster.registerPlayer(socket.id, data.playerId, role, camp);
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

/**
 * 注入全局广播器实例，供连接生命周期回调使用。
 */
export function setGlobalBroadcaster(broadcaster: Broadcaster): void {
  globalBroadcaster = broadcaster;
}

function isValidRole(role: string): role is Role {
  return (Object.values(Role) as string[]).includes(role);
}
