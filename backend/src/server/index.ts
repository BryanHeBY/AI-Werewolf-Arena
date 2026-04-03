import Fastify from "fastify";
import cors from "@fastify/cors";
import { Server } from "socket.io";
import { appConfig } from "../config";
import { GameEngine } from "../core/GameEngine";
import { GameFactory } from "../core/GameFactory";
import { GameLogger } from "../logger/GameLogger";
import { Broadcaster } from "../broadcaster/Broadcaster";

const fastify = Fastify({
  logger: true,
});

fastify.register(cors, {
  origin: appConfig.corsOrigin,
  methods: ["GET", "POST", "OPTIONS"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
});

const io = new Server(fastify.server, {
  cors: {
    origin: appConfig.corsOrigin,
    methods: ["GET", "POST"],
  },
});

const broadcaster = new Broadcaster(io);

fastify.get("/api/start-game", async (request, reply) => {
  try {
    const factory = new GameFactory(
      appConfig.gameConfig,
      appConfig.modelDefaults,
    );
    const players = factory.createPlayers();
    const logger = new GameLogger(appConfig.gameRecordsDir);
    const engine = new GameEngine(
      appConfig.gameConfig,
      players,
      logger,
      broadcaster,
    );

    engine.start().catch((error) => {
      console.error("Game error:", error);
    });

    return {
      success: true,
      gameId: logger.getCurrentFilePath(),
      players: players.map((p) => ({ id: p.id, name: p.name })),
    };
  } catch (error) {
    console.error("Failed to start game:", error);
    return { success: false, error: String(error) };
  }
});

fastify.get("/api/status", async (request, reply) => {
  return {
    status: "ok",
    config: {
      port: appConfig.port,
      model: appConfig.modelDefaults.model,
    },
  };
});

const start = async () => {
  try {
    await fastify.listen({ port: appConfig.port, host: "0.0.0.0" });
    console.log(`服务器启动成功: http://0.0.0.0:${appConfig.port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
