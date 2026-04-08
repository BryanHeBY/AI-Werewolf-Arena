import { bootstrapGame, BootstrapResult } from "../app/bootstrap";
import { BoardPreset } from "../config";
import { Camp, GameEvent, Phase, RuntimeSnapshot } from "../domain/model";
import { Broadcaster, RealtimeGameEvent } from "../infra/transport/broadcaster";
import { sixPlayerMvpConfig } from "../scenarios/six_player_mvp";
import { twelvePlayerStandardConfig } from "../scenarios/twelve_player_standard";
import { buildFrontendGameState, toFrontendFaction, toFrontendPhase } from "./view_mapper";
import { BaselineBotActionProvider } from "../v3/action_providers";

export interface SessionStartOptions {
  board?: BoardPreset;
  maxDays?: number;
}

export interface SessionStatus {
  id: string;
  board: BoardPreset;
  running: boolean;
  snapshot: RuntimeSnapshot;
}

export interface SessionManagerConfig {
  defaultBoard: BoardPreset;
  maxDaysPerSession: number;
  cycleDelayMs: number;
}

class V3GameSession {
  private readonly context: BootstrapResult;
  private readonly actionProvider: BaselineBotActionProvider;
  private readonly maxDays: number;
  private readonly cycleDelayMs: number;
  private eventCursor = 0;
  private running = false;

  constructor(
    readonly id: string,
    readonly board: BoardPreset,
    private readonly broadcaster: Broadcaster,
    maxDays: number,
    cycleDelayMs: number,
  ) {
    this.maxDays = maxDays;
    this.cycleDelayMs = cycleDelayMs;
    this.context = bootstrapGame(
      board === "twelve_player_standard"
        ? twelvePlayerStandardConfig
        : sixPlayerMvpConfig,
    );
    this.actionProvider = new BaselineBotActionProvider(this.context.world);
  }

  start(): void {
    if (this.running) {
      return;
    }

    this.running = true;
    this.broadcaster.broadcast({
      type: "game_started",
      timestamp: Date.now(),
      data: {
        phase: toFrontendPhase(this.context.phaseManager.getSnapshot().phase),
        round: this.context.phaseManager.getSnapshot().day,
        players: buildFrontendGameState(
          this.context.world,
          this.context.phaseManager.getSnapshot(),
        ).players,
        gameState: buildFrontendGameState(
          this.context.world,
          this.context.phaseManager.getSnapshot(),
        ),
      },
    });
    void this.runLoop();
  }

  stop(): void {
    this.running = false;
  }

  status(): SessionStatus {
    return {
      id: this.id,
      board: this.board,
      running: this.running,
      snapshot: this.context.phaseManager.getSnapshot(),
    };
  }

  snapshotPublicState() {
    return buildFrontendGameState(
      this.context.world,
      this.context.phaseManager.getSnapshot(),
    );
  }

  private async runLoop(): Promise<void> {
    while (this.running && !this.context.phaseManager.getSnapshot().gameOver) {
      await this.context.phaseManager.runSingleCycle(this.actionProvider, this.maxDays);
      this.flushEvents();
      if (!this.context.phaseManager.getSnapshot().gameOver) {
        await sleep(this.cycleDelayMs);
      }
    }

    this.flushEvents();
    this.running = false;
  }

  private flushEvents(): void {
    const events = this.context.phaseManager.getEvents().slice(this.eventCursor);
    this.eventCursor += events.length;

    for (const event of events) {
      const outgoing = this.translateEvent(event);
      if (outgoing.length === 0) {
        continue;
      }
      for (const item of outgoing) {
        this.broadcaster.broadcast(item);
      }
    }
  }

  private translateEvent(event: GameEvent): RealtimeGameEvent[] {
    const nowState = buildFrontendGameState(
      this.context.world,
      this.context.phaseManager.getSnapshot(),
    );

    if (event.type === "phase_changed") {
      const phase = String(event.payload.phase ?? Phase.Night) as Phase;
      const day = Number(event.payload.day ?? nowState.round);
      return [
        {
          type: "phase_changed",
          timestamp: event.timestamp,
          data: {
            phase: toFrontendPhase(phase),
            round: day,
            gameState: nowState,
          },
        },
      ];
    }

    if (event.type === "day_speech") {
      const playerId = Number(event.payload.actorId);
      return [
        {
          type: "speech_start",
          timestamp: event.timestamp,
          data: {
            playerId,
            playerName: this.getPlayerName(playerId),
          },
        },
        {
          type: "player_action",
          timestamp: event.timestamp,
          data: {
            playerId,
            actionType: "speak",
            content: String(event.payload.text ?? ""),
          },
        },
      ];
    }

    if (event.type === "night_resolved") {
      const deadPlayerIds = Array.isArray(event.payload.deaths)
        ? event.payload.deaths.map((id) => Number(id))
        : [];
      const result: RealtimeGameEvent[] = [
        {
          type: "night_result",
          timestamp: event.timestamp,
          data: {
            deadPlayerIds,
            killedByWolf:
              event.payload.wolfTarget !== undefined
                ? Number(event.payload.wolfTarget)
                : undefined,
          },
        },
      ];
      for (const playerId of deadPlayerIds) {
        result.push(this.makePlayerDiedEvent(playerId, event.timestamp));
      }
      return result;
    }

    if (event.type === "voted_out") {
      const target = Number(event.payload.target);
      return [
        {
          type: "vote_result",
          timestamp: event.timestamp,
          data: {
            votedOutId: target,
            votedOutName: this.getPlayerName(target),
          },
        },
        this.makePlayerDiedEvent(target, event.timestamp),
      ];
    }

    if (event.type === "wolf_self_destruct") {
      const wolfId = Number(event.payload.wolfId);
      return [this.makePlayerDiedEvent(wolfId, event.timestamp)];
    }

    if (event.type === "hunter_shot") {
      const hunterId = Number(event.payload.hunterId);
      const targetId = Number(event.payload.targetId);
      return [
        {
          type: "player_action",
          timestamp: event.timestamp,
          data: {
            playerId: hunterId,
            actionType: "kill",
            targetId,
          },
        },
        this.makePlayerDiedEvent(targetId, event.timestamp),
      ];
    }

    if (event.type === "game_over") {
      const winner = toFrontendFaction((event.payload.winner as Camp | null) ?? null);
      return [
        {
          type: "game_over",
          timestamp: event.timestamp,
          data: {
            winner,
            gameState: nowState,
          },
        },
        {
          type: "winner_declared",
          timestamp: event.timestamp,
          data: {
            winner,
            message: winner === "wolf" ? "🐺 狼人阵营获胜" : "👥 好人阵营获胜",
          },
        },
      ];
    }

    return [];
  }

  private makePlayerDiedEvent(playerId: number, timestamp: number): RealtimeGameEvent {
    return {
      type: "player_died",
      timestamp,
      data: {
        playerId,
        roleType: this.getPlayerRole(playerId),
      },
    };
  }

  private getPlayerName(playerId: number): string {
    const player = this.snapshotPublicState().players.find((p) => p.id === playerId);
    return player?.name ?? `玩家${playerId}`;
  }

  private getPlayerRole(playerId: number): string {
    const player = this.snapshotPublicState().players.find((p) => p.id === playerId);
    return player?.roleType ?? "villager";
  }
}

export class V3SessionManager {
  private current: V3GameSession | null = null;
  private seq = 0;

  constructor(
    private readonly broadcaster: Broadcaster,
    private readonly config: SessionManagerConfig,
  ) {}

  start(options: SessionStartOptions = {}): SessionStatus {
    if (this.current && this.current.status().running) {
      return this.current.status();
    }

    const board = options.board ?? this.config.defaultBoard;
    const maxDays = options.maxDays ?? this.config.maxDaysPerSession;

    this.seq += 1;
    this.current = new V3GameSession(
      `v3-${this.seq}`,
      board,
      this.broadcaster,
      maxDays,
      this.config.cycleDelayMs,
    );
    this.current.start();
    return this.current.status();
  }

  stop(): SessionStatus | null {
    if (!this.current) {
      return null;
    }
    this.current.stop();
    return this.current.status();
  }

  status(): SessionStatus | null {
    if (!this.current) {
      return null;
    }
    return this.current.status();
  }

  publicState(): ReturnType<V3GameSession["snapshotPublicState"]> | null {
    if (!this.current) {
      return null;
    }
    return this.current.snapshotPublicState();
  }
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
