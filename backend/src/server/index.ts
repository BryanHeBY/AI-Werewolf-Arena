import Fastify from "fastify";
import cors from "@fastify/cors";
import { appConfig } from "../config";
import { GameEngineV2 } from "../core/GameEngineV2";
import { GameFactoryV2 } from "../core/GameFactoryV2";
import { GameWorld } from "../ecs/World";
import { GameLogger } from "../logger/GameLogger";
import { Broadcaster } from "../broadcaster/Broadcaster";
import { IdentityComponent, StatusComponent } from "../core/types";
import { setupSocket, setGlobalBroadcaster } from "./socket";

const fastify = Fastify({
  logger: true,
});

fastify.register(cors, {
  origin: appConfig.corsOrigin,
  methods: ["GET", "POST", "OPTIONS"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
});

const io = setupSocket(fastify.server);
const broadcaster = new Broadcaster(io);
setGlobalBroadcaster(broadcaster);

fastify.get("/api/start-game", async (request, reply) => {
  try {
    const world = new GameWorld();
    const factory = new GameFactoryV2(
      appConfig.gameConfig,
      appConfig.modelDefaults,
      world,
    );
    factory.createPlayers(); // 现在返回void

    // 从World查询玩家信息
    const entities = world.query<{
      IdentityComponent: IdentityComponent;
      StatusComponent: StatusComponent;
    }>("IdentityComponent", "StatusComponent");

    const logger = new GameLogger(appConfig.gameRecordsDir);
    const engine = new GameEngineV2(
      appConfig.gameConfig,
      world, // 传入World而不是players数组
      logger,
      broadcaster,
    );

    engine.start().catch((error) => {
      console.error("Game error:", error);
    });

    return {
      success: true,
      gameId: logger.getCurrentFilePath(),
      players: entities.map((e: any) => ({
        id: e.IdentityComponent.entityId,
        name: e.IdentityComponent.name,
      })),
      engineVersion: "V2",
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
