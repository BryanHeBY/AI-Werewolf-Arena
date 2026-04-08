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

/**
 * 单局会话封装：
 * 持有完整对局上下文，负责循环推进 phase 并把内部事件翻译成前端实时事件。
 */
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
    // 开局先发一帧完整状态，前端可据此初始化全量视图。
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
      visibility: { scope: "public" },
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
    // 只增量消费新事件，避免重复广播同一条历史事件。
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

    if (event.type === "wolf_tactical_order") {
      return [
        this.makeWolvesOnlyEvent(
          "wolf_tactical_order",
          {
            order: Array.isArray(event.payload.order) ? event.payload.order : [],
          },
          event.timestamp,
        ),
      ];
    }

    if (event.type === "wolf_discussion") {
      return [
        this.makeWolvesOnlyEvent(
          "wolf_discussion",
          {
            actorId: Number(event.payload.actorId),
            text: String(event.payload.text ?? ""),
          },
          event.timestamp,
        ),
      ];
    }

    if (event.type === "guard_applied") {
      const actorId = Number(event.payload.actorId);
      return [
        this.makePrivateTargetsEvent(
          "guard_applied",
          {
            actorId,
            targetId: Number(event.payload.targetId),
          },
          [actorId],
          event.timestamp,
        ),
      ];
    }

    if (event.type === "wolf_kill_vote_cast") {
      return [
        this.makeWolvesOnlyEvent(
          "wolf_kill_vote_cast",
          {
            actorId: Number(event.payload.actorId),
            targetId: Number(event.payload.targetId),
          },
          event.timestamp,
        ),
      ];
    }

    if (event.type === "seer_checked") {
      const actorId = Number(event.payload.actorId);
      return [
        this.makePrivateTargetsEvent(
          "seer_checked",
          {
            actorId,
            targetId: Number(event.payload.targetId),
            isWerewolf: Boolean(event.payload.isWerewolf),
          },
          [actorId],
          event.timestamp,
        ),
      ];
    }

    if (event.type === "witch_potion_used") {
      const actorId = Number(event.payload.actorId);
      return [
        this.makePrivateTargetsEvent(
          "witch_potion_used",
          {
            actorId,
            targetId: Number(event.payload.targetId),
            potionType: String(event.payload.potionType ?? ""),
          },
          [actorId],
          event.timestamp,
        ),
      ];
    }

    if (event.type === "phase_changed") {
      const phase = String(event.payload.phase ?? Phase.Night) as Phase;
      const day = Number(event.payload.day ?? nowState.round);
      return [
        this.makePublicEvent(
          "phase_changed",
          {
            phase: toFrontendPhase(phase),
            round: day,
            gameState: nowState,
          },
          event.timestamp,
        ),
      ];
    }

    if (event.type === "day_speech") {
      const playerId = Number(event.payload.actorId);
      return [
        this.makePublicEvent(
          "speech_start",
          {
            playerId,
            playerName: this.getPlayerName(playerId),
          },
          event.timestamp,
        ),
        this.makePublicEvent(
          "player_action",
          {
            playerId,
            actionType: "speak",
            content: String(event.payload.text ?? ""),
          },
          event.timestamp,
        ),
      ];
    }

    if (event.type === "night_resolved") {
      const deadPlayerIds = Array.isArray(event.payload.deaths)
        ? event.payload.deaths.map((id) => Number(id))
        : [];
      const result: RealtimeGameEvent[] = [
        this.makePublicEvent(
          "night_result",
          {
            deadPlayerIds,
            killedByWolf:
              event.payload.wolfTarget !== undefined
                ? Number(event.payload.wolfTarget)
                : undefined,
          },
          event.timestamp,
        ),
      ];
      for (const playerId of deadPlayerIds) {
        result.push(this.makePlayerDiedEvent(playerId, event.timestamp));
      }
      return result;
    }

    if (event.type === "voted_out") {
      const target = Number(event.payload.target);
      return [
        this.makePublicEvent(
          "vote_result",
          {
            votedOutId: target,
            votedOutName: this.getPlayerName(target),
          },
          event.timestamp,
        ),
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
        this.makePublicEvent(
          "player_action",
          {
            playerId: hunterId,
            actionType: "kill",
            targetId,
          },
          event.timestamp,
        ),
        this.makePlayerDiedEvent(targetId, event.timestamp),
      ];
    }

    if (event.type === "game_over") {
      const winner = toFrontendFaction((event.payload.winner as Camp | null) ?? null);
      return [
        this.makePublicEvent(
          "game_over",
          {
            winner,
            gameState: nowState,
          },
          event.timestamp,
        ),
        this.makePublicEvent(
          "winner_declared",
          {
            winner,
            message: winner === "wolf" ? "🐺 狼人阵营获胜" : "👥 好人阵营获胜",
          },
          event.timestamp,
        ),
      ];
    }

    return [];
  }

  private makePlayerDiedEvent(playerId: number, timestamp: number): RealtimeGameEvent {
    return this.makePublicEvent(
      "player_died",
      {
        playerId,
        roleType: this.getPlayerRole(playerId),
      },
      timestamp,
    );
  }

  private makePublicEvent(
    type: string,
    data: Record<string, unknown>,
    timestamp: number,
  ): RealtimeGameEvent {
    return {
      type,
      timestamp,
      data,
      visibility: { scope: "public" },
    };
  }

  private makeWolvesOnlyEvent(
    type: string,
    data: Record<string, unknown>,
    timestamp: number,
  ): RealtimeGameEvent {
    return {
      type,
      timestamp,
      data,
      visibility: { scope: "wolves_only" },
    };
  }

  private makePrivateTargetsEvent(
    type: string,
    data: Record<string, unknown>,
    targetPlayerIds: number[],
    timestamp: number,
  ): RealtimeGameEvent {
    return {
      type,
      timestamp,
      data,
      visibility: {
        scope: "private_targets",
        targetPlayerIds,
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
      // 同一时刻只允许一个活跃会话，重复 start 直接返回当前状态。
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
