import Fastify from "fastify";
import cors from "@fastify/cors";
import { appConfig, BoardPreset } from "../config";
import { Broadcaster } from "../infra/transport/broadcaster";
import { setupSocket, setGlobalBroadcaster } from "./socket";
import { V3SessionManager } from "./v3_session_manager";

/**
 * V3 服务入口：
 * - HTTP: 状态查询、开局、停局、会话快照
 * - Socket: 实时事件广播
 */
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

const sessions = new V3SessionManager(broadcaster, {
  defaultBoard: appConfig.defaultBoard,
  maxDaysPerSession: appConfig.maxDaysPerSession,
  cycleDelayMs: appConfig.cycleDelayMs,
});

fastify.get("/api/status", async () => {
  return {
    status: "ok",
    engineVersion: "V3",
    config: {
      port: appConfig.port,
      defaultBoard: appConfig.defaultBoard,
      maxDaysPerSession: appConfig.maxDaysPerSession,
      cycleDelayMs: appConfig.cycleDelayMs,
    },
    session: sessions.status(),
  };
});

fastify.get("/api/start-game", async (request) => {
  const query = request.query as { board?: BoardPreset; maxDays?: string };
  return startGame(query.board, query.maxDays ? Number(query.maxDays) : undefined);
});

fastify.post("/api/start-game", async (request) => {
  const body = request.body as { board?: BoardPreset; maxDays?: number } | undefined;
  return startGame(body?.board, body?.maxDays);
});

fastify.post("/api/stop-game", async () => {
  const status = sessions.stop();
  return {
    success: status !== null,
    session: status,
  };
});

fastify.get("/api/session", async () => {
  return {
    session: sessions.status(),
    gameState: sessions.publicState(),
  };
});

function startGame(board: BoardPreset | undefined, maxDays: number | undefined) {
  const status = sessions.start({
    board,
    maxDays,
  });
  return {
    success: true,
    gameId: status.id,
    board: status.board,
    players: sessions.publicState()?.players ?? [],
    engineVersion: "V3",
    snapshot: status.snapshot,
  };
}

const start = async () => {
  try {
    await fastify.listen({ port: appConfig.port, host: "0.0.0.0" });
    console.log(`V3 server started: http://0.0.0.0:${appConfig.port}`);
  } catch (error) {
    fastify.log.error(error);
    throw error;
  }
};

void start();
