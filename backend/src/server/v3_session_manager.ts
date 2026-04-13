import { bootstrapGame, BootstrapResult } from "../app/bootstrap";
import { BoardPreset } from "../runtime/config";
import { GameEvent, RuntimeSnapshot } from "../core";
import { Broadcaster } from "./transport/broadcaster";
import { getDefaultRealtimeEventRegistry } from "../game";
import { RealtimeGameEvent } from "../game/mechanisms/session/realtime_event_types";
import { resolveBoardConfig } from "../runtime/scenarios/board_config_resolver";
import { buildFrontendGameState, toFrontendPhase } from "./view_mapper";
import { BaselineBotActionProvider } from "../ai";

/**
 * 启动会话可选参数。
 */
export interface SessionStartOptions {
  board?: BoardPreset;
  boardConfigName?: string;
  maxDays?: number;
}

/**
 * 会话状态快照。
 */
export interface SessionStatus {
  id: string;
  board: BoardPreset;
  boardConfigName?: string;
  running: boolean;
  snapshot: RuntimeSnapshot;
}

/**
 * 会话管理器运行配置。
 */
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
  private readonly realtimeEventRegistry = getDefaultRealtimeEventRegistry();
  private readonly maxDays: number;
  private readonly cycleDelayMs: number;
  private eventCursor = 0;
  private running = false;

  constructor(
    readonly id: string,
    readonly board: BoardPreset,
    readonly boardConfigName: string | undefined,
    private readonly broadcaster: Broadcaster,
    maxDays: number,
    cycleDelayMs: number,
  ) {
    this.maxDays = maxDays;
    this.cycleDelayMs = cycleDelayMs;
    const overrideName = boardConfigName ?? board;
    this.context = bootstrapGame(resolveBoardConfig(board, { board: overrideName }));
    this.actionProvider = new BaselineBotActionProvider(this.context.world);
  }

  /**
   * 启动对局会话循环。
   */
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

  /**
   * 停止对局会话。
   */
  stop(): void {
    this.running = false;
  }

  /**
   * 获取当前会话状态。
   */
  status(): SessionStatus {
    return {
      id: this.id,
      board: this.board,
      boardConfigName: this.boardConfigName,
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

  /**
   * 按周期推进对局直到终局或被停止。
   */
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

  /**
   * 增量翻译并广播新事件。
   */
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

  /**
   * 将内部领域事件翻译为前端实时事件。
   */
  private translateEvent(event: GameEvent): RealtimeGameEvent[] {
    return this.realtimeEventRegistry.translate(event, {
      nowState: buildFrontendGameState(
        this.context.world,
        this.context.phaseManager.getSnapshot(),
      ),
      getPlayerName: (playerId) => this.getPlayerName(playerId),
      getPlayerRole: (playerId) => this.getPlayerRole(playerId),
    });
  }

  /**
   * 读取玩家展示名。
   */
  private getPlayerName(playerId: number): string {
    const player = this.snapshotPublicState().players.find((p) => p.id === playerId);
    return player?.name ?? `玩家${playerId}`;
  }

  /**
   * 读取玩家角色类型（前端展示用）。
   */
  private getPlayerRole(playerId: number): string {
    const player = this.snapshotPublicState().players.find((p) => p.id === playerId);
    return player?.roleType ?? "villager";
  }
}

/**
 * V3 会话管理器：负责单实例会话生命周期管理。
 */
export class V3SessionManager {
  private current: V3GameSession | null = null;
  private seq = 0;

  constructor(
    private readonly broadcaster: Broadcaster,
    private readonly config: SessionManagerConfig,
  ) {}

  /**
   * 启动会话；若已有运行中会话则直接返回其状态。
   */
  start(options: SessionStartOptions = {}): SessionStatus {
    if (this.current && this.current.status().running) {
      // 同一时刻只允许一个活跃会话，重复 start 直接返回当前状态。
      return this.current.status();
    }

    const board = options.board ?? this.config.defaultBoard;
    const boardConfigName = options.boardConfigName;
    const maxDays = options.maxDays ?? this.config.maxDaysPerSession;

    this.seq += 1;
    this.current = new V3GameSession(
      `v3-${this.seq}`,
      board,
      boardConfigName,
      this.broadcaster,
      maxDays,
      this.config.cycleDelayMs,
    );
    this.current.start();
    return this.current.status();
  }

  /**
   * 停止当前会话。
   */
  stop(): SessionStatus | null {
    if (!this.current) {
      return null;
    }
    this.current.stop();
    return this.current.status();
  }

  /**
   * 查询当前会话状态。
   */
  status(): SessionStatus | null {
    if (!this.current) {
      return null;
    }
    return this.current.status();
  }

  /**
   * 查询当前会话公开状态。
   */
  publicState(): ReturnType<V3GameSession["snapshotPublicState"]> | null {
    if (!this.current) {
      return null;
    }
    return this.current.snapshotPublicState();
  }
}

/**
 * 异步延迟工具：用于会话循环节流，降低广播压力。
 */
async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
