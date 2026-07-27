import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import path from "path";
import { appConfig, BoardPreset } from "../runtime/config";
import { Broadcaster } from "./transport/broadcaster";
import { setupSocket, setGlobalBroadcaster } from "./socket";
import { SessionManager } from "./session_manager";
import { ReplayRecordRepository, ReplayRepositoryError } from "./replay_record_repository";
import { createReplaySourceDocument } from "./replay_source_document";
import { loadRuntimeConfig } from "../runtime/config/runtime_config";

interface CreateServerOptions {
  recordRepository?: ReplayRecordRepository;
  logger?: boolean;
}

function fallbackRecordRoot(cwd: string = process.cwd()): string {
  if (path.basename(cwd) === "backend") {
    return path.resolve(cwd, "data", "records");
  }
  return path.resolve(cwd, "backend", "data", "records");
}

function toBoard(game?: string): BoardPreset {
  return String(game ?? "").startsWith("twelve")
    ? "twelve_player_standard"
    : "six_player_mvp";
}

function mapSessionData(
  session: ReturnType<SessionManager["status"]>,
  gameState: ReturnType<SessionManager["publicState"]>,
) {
  if (!session) {
    return null;
  }
  return {
    session: {
      id: session.id,
      game: session.boardConfigName ?? session.board,
      running: session.running,
      snapshot: session.snapshot,
      record: { ready: false },
    },
    gameState,
  };
}

function apiError(reply: any, status: number, code: string, message: string) {
  return reply.status(status).send({
    success: false,
    error: { code, message },
  });
}

function mapReplayError(error: unknown): { status: number; code: string; message: string } {
  if (!(error instanceof ReplayRepositoryError)) {
    return { status: 503, code: "RECORD_UNAVAILABLE", message: String(error) };
  }
  if (error.code === "INVALID_QUERY") {
    return { status: 422, code: error.code, message: error.message };
  }
  if (error.code === "SESSION_NOT_FOUND" || error.code === "PLAYER_NOT_FOUND") {
    return { status: 404, code: error.code, message: error.message };
  }
  return { status: 503, code: error.code, message: error.message };
}

async function resolveRecordRepository(
  override?: ReplayRecordRepository,
): Promise<ReplayRecordRepository> {
  if (override) {
    return override;
  }
  try {
    const runtime = await loadRuntimeConfig();
    const configured = runtime.game?.recordRootDir;
    return new ReplayRecordRepository(configured ?? fallbackRecordRoot());
  } catch {
    return new ReplayRecordRepository(fallbackRecordRoot());
  }
}

/**
 * 游戏服务入口：
 * - HTTP: 状态查询、会话生命周期、复盘查询
 * - Socket: 实时事件广播
 */
export async function createServer(
  options: CreateServerOptions = {},
): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: options.logger ?? true,
  });
  await fastify.register(cors, {
    origin: appConfig.corsOrigin,
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  const io = setupSocket(fastify.server);
  const broadcaster = new Broadcaster(io);
  setGlobalBroadcaster(broadcaster);

  const sessions = new SessionManager(broadcaster, {
    defaultBoard: appConfig.defaultBoard,
    maxDaysPerSession: appConfig.maxDaysPerSession,
    cycleDelayMs: appConfig.cycleDelayMs,
  });
  const replayRepository = await resolveRecordRepository(options.recordRepository);

  fastify.get("/api/status", async () => ({
    status: "ok",
    config: {
      port: appConfig.port,
      defaultBoard: appConfig.defaultBoard,
      maxDaysPerSession: appConfig.maxDaysPerSession,
      cycleDelayMs: appConfig.cycleDelayMs,
      recordRootDir: replayRepository.recordRoot,
    },
    session: sessions.status(),
  }));
  fastify.post("/api/sessions", async (request) => {
    const body = (request.body ?? {}) as { game?: string; maxDays?: number };
    const board = toBoard(body.game);
    const started = sessions.start({
      board,
      boardConfigName: body.game,
      maxDays: body.maxDays,
    });
    return {
      success: true,
      data: mapSessionData(started, sessions.publicState()),
    };
  });

  fastify.get("/api/sessions", async () => {
    const current = mapSessionData(sessions.status(), sessions.publicState());
    return {
      success: true,
      data: current ? [current] : [],
    };
  });

  fastify.get("/api/sessions/current", async (request, reply) => {
    const current = mapSessionData(sessions.status(), sessions.publicState());
    if (!current) {
      return apiError(reply, 404, "SESSION_NOT_FOUND", "session not found");
    }
    return { success: true, data: current };
  });

  fastify.get("/api/sessions/:sessionId", async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const current = sessions.status();
    if (current && current.id === sessionId) {
      return {
        success: true,
        data: mapSessionData(current, sessions.publicState()),
      };
    }
    try {
      const manifest = await replayRepository.getManifest(sessionId);
      return {
        success: true,
        data: {
          session: {
            id: manifest.session_id,
            game: manifest.board,
            running: false,
            snapshot: {
              day: 0,
              phase: "completed",
              gameOver: manifest.finish_reason !== "in_progress",
              winner: manifest.winner,
              reason: manifest.finish_reason,
            },
            record: {
              ready: true,
              recordDir: path.join(replayRepository.recordRoot, sessionId),
            },
          },
          gameState: null,
        },
      };
    } catch (error) {
      const mapped = mapReplayError(error);
      return apiError(reply, mapped.status, mapped.code, mapped.message);
    }
  });

  fastify.post("/api/sessions/:sessionId/stop", async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const current = sessions.status();
    if (!current || current.id !== sessionId) {
      return apiError(reply, 404, "SESSION_NOT_FOUND", "session not found");
    }
    const stopped = sessions.stop();
    return {
      success: true,
      data: mapSessionData(stopped, sessions.publicState()),
    };
  });

  fastify.get("/api/sessions/:sessionId/result", async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const current = sessions.status();
    if (current && current.id === sessionId) {
      return {
        success: true,
        data: {
          sessionId,
          gameOver: current.snapshot.gameOver,
          result: {
            winner: current.snapshot.result?.winner ?? null,
            reason: current.snapshot.result?.reason ?? null,
          },
        },
      };
    }
    try {
      const result = await replayRepository.getResult(sessionId);
      return { success: true, data: result };
    } catch (error) {
      const mapped = mapReplayError(error);
      return apiError(reply, mapped.status, mapped.code, mapped.message);
    }
  });

  fastify.get("/api/sessions/:sessionId/timeline", async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const query = request.query as {
      fromSeq?: string;
      toSeq?: string;
      phaseId?: string;
    };
    try {
      const data = await replayRepository.getPublicTimeline(sessionId, {
        fromSeq: query.fromSeq ? Number(query.fromSeq) : undefined,
        toSeq: query.toSeq ? Number(query.toSeq) : undefined,
        phaseId: query.phaseId,
      });
      return { success: true, data };
    } catch (error) {
      const mapped = mapReplayError(error);
      return apiError(reply, mapped.status, mapped.code, mapped.message);
    }
  });

  fastify.get("/api/sessions/:sessionId/phases", async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    try {
      const phaseWindows = await replayRepository.getPhaseWindows(sessionId);
      return {
        success: true,
        data: {
          sessionId,
          windows: phaseWindows.windows,
        },
      };
    } catch (error) {
      const mapped = mapReplayError(error);
      return apiError(reply, mapped.status, mapped.code, mapped.message);
    }
  });

  /**
   * Development-stage browser and renderer entry point. It deliberately
   * returns the complete record until perspective projection is designed.
   */
  fastify.get("/api/sessions/:sessionId/replay", async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    try {
      const [manifest, timeline, phaseWindows] = await Promise.all([
        replayRepository.getManifest(sessionId),
        replayRepository.getPublicTimeline(sessionId, {}),
        replayRepository.getPhaseWindows(sessionId),
      ]);
      return {
        success: true,
        data: createReplaySourceDocument({
          manifest,
          events: timeline.events,
          phaseWindows: phaseWindows.windows,
        }),
      };
    } catch (error) {
      const mapped = mapReplayError(error);
      return apiError(reply, mapped.status, mapped.code, mapped.message);
    }
  });

  fastify.get(
    "/api/sessions/:sessionId/players/:playerId/timeline",
    async (request, reply) => {
      const { sessionId, playerId } = request.params as {
        sessionId: string;
        playerId: string;
      };
      const query = request.query as {
        phaseId?: string;
        kind?: "broadcast" | "turn";
      };
      try {
        const data = await replayRepository.getPlayerTimeline(
          sessionId,
          Number(playerId),
          {
            phaseId: query.phaseId,
            kind: query.kind,
          },
        );
        return { success: true, data };
      } catch (error) {
        const mapped = mapReplayError(error);
        return apiError(reply, mapped.status, mapped.code, mapped.message);
      }
    },
  );

  return fastify;
}

export async function startServer(): Promise<FastifyInstance> {
  const fastify = await createServer();
  try {
    await fastify.listen({ port: appConfig.port, host: "0.0.0.0" });
    // eslint-disable-next-line no-console
    console.log(`Game server started: http://0.0.0.0:${appConfig.port}`);
    return fastify;
  } catch (error) {
    fastify.log.error(error);
    throw error;
  }
}

if (require.main === module) {
  void startServer();
}
