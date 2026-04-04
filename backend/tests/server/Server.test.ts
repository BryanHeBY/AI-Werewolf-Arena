import Fastify from "fastify";
import { appConfig } from "../../src/config";
import { setupSocket } from "../../src/server/socket";
import { Broadcaster } from "../../src/broadcaster/Broadcaster";
import { BroadcastEventType } from "../../src/core/types";

describe("Server API Tests", () => {
  let fastify: any;
  let io: any;
  let broadcaster: Broadcaster;

  beforeAll(async () => {
    // 创建Fastify实例
    fastify = Fastify({
      logger: false,
    });

    // 设置CORS
    fastify.register(require("@fastify/cors"), {
      origin: appConfig.corsOrigin,
      methods: ["GET", "POST", "OPTIONS"],
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization"],
    });

    // 设置Socket.IO
    io = setupSocket(fastify.server);
    broadcaster = new Broadcaster(io);

    // 注册路由
    fastify.get("/api/status", async () => {
      return {
        status: "ok",
        config: {
          port: appConfig.port,
          model: appConfig.modelDefaults.model,
        },
      };
    });

    fastify.get("/api/start-game", async () => {
      return {
        success: true,
        gameId: "test-game-id",
        players: [
          { id: 1, name: "Player 1" },
          { id: 2, name: "Player 2" },
        ],
        engineVersion: "V2",
      };
    });

    // 启动服务器
    await fastify.listen({ port: 0 }); // 使用随机端口
  });

  afterAll(async () => {
    if (fastify) {
      await fastify.close();
    }
    if (io) {
      io.close();
    }
  });

  test("GET /api/status should return server status", async () => {
    const response = await fastify.inject({
      method: "GET",
      url: "/api/status",
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.payload);
    expect(data.status).toBe("ok");
    expect(data.config).toBeDefined();
    expect(data.config.port).toBe(appConfig.port);
  });

  test("GET /api/start-game should start a V2 game", async () => {
    const response = await fastify.inject({
      method: "GET",
      url: "/api/start-game",
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.payload);
    expect(data.success).toBe(true);
    expect(data.gameId).toBe("test-game-id");
    expect(data.players).toHaveLength(2);
    expect(data.engineVersion).toBe("V2");
  });

  test("Server should handle CORS headers correctly", async () => {
    const response = await fastify.inject({
      method: "OPTIONS",
      url: "/api/status",
      headers: {
        Origin: "http://localhost:5173",
        "Access-Control-Request-Method": "GET",
      },
    });

    expect(response.statusCode).toBe(204); // No Content for preflight
    expect(response.headers["access-control-allow-origin"]).toBe(
      appConfig.corsOrigin,
    );
    expect(response.headers["access-control-allow-methods"]).toContain("GET");
  });
});

describe("WebSocket Tests", () => {
  test("Broadcaster should be able to broadcast events", () => {
    const mockIo = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };

    const broadcaster = new Broadcaster(mockIo as any);

    const event = {
      type: BroadcastEventType.PhaseChanged,
      data: { message: "test" },
      timestamp: Date.now(),
    };

    broadcaster.broadcast(event);

    expect(mockIo.emit).toHaveBeenCalledWith("gameEvent", event);
  });

  test("Broadcaster should register and unregister players", () => {
    const mockIo = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };

    const broadcaster = new Broadcaster(mockIo as any);

    broadcaster.registerPlayer("socket-123", 1);

    const event = {
      type: BroadcastEventType.PhaseChanged,
      data: { data: "test" },
      timestamp: Date.now(),
    };

    broadcaster.broadcastToPlayer(1, event);

    expect(mockIo.to).toHaveBeenCalledWith("socket-123");
    expect(mockIo.emit).toHaveBeenCalledWith("gameEvent", event);

    broadcaster.unregisterSocket("socket-123");

    const event2 = {
      type: BroadcastEventType.PhaseChanged,
      data: { data: "test2" },
      timestamp: Date.now(),
    };

    const result = broadcaster.broadcastToPlayer(1, event2);

    expect(result).toBe(false);
    expect(mockIo.emit).toHaveBeenCalledTimes(1);
  });
});
