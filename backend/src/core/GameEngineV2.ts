import {
  GameState,
  PublicGameState,
  GamePhase,
  Player,
  GameConfig,
  StackNode,
  EntityId,
  World,
  BroadcastEventType,
  BroadcastEvent,
} from "./types";
import { Environment } from "./Environment";
import { PhaseStack } from "./PhaseStackEngine";
import { AgentController } from "../agent/AgentController";
import { GameLogger } from "../logger/GameLogger";
import { Broadcaster } from "../broadcaster/Broadcaster";
import { ViewSanitizer } from "./ViewSanitizer";
import { ActionValidator } from "../agent/ActionValidator";

/**
 * GameEngineV2 - V2 版本游戏引擎
 *
 * 核心特性：
 * 1. 基于 Phase Stack 的嵌套、并发阶段管理
 * 2. 与 ECS 架构集成（待实现）
 * 3. 使用 ViewSanitizer 进行视角隔离
 * 4. 使用 ActionValidator 进行动作验证和 Fallback
 */
export class GameEngineV2 {
  private env: Environment;
  private config: GameConfig;
  private agentController: AgentController;
  private logger: GameLogger;
  private broadcaster: Broadcaster;
  private viewSanitizer: ViewSanitizer;
  private actionValidator: ActionValidator;
  private phaseStack: PhaseStack;
  private world: World | null = null; // ECS World，待 ECS 框架完成后初始化
  private isRunning: boolean = false;
  private abortController: AbortController | null = null;

  constructor(
    config: GameConfig,
    players: Player[],
    logger: GameLogger,
    broadcaster: Broadcaster,
  ) {
    this.config = config;
    this.logger = logger;
    this.broadcaster = broadcaster;
    this.env = new Environment(config, players);
    this.agentController = new AgentController(this.env, this.broadcaster);
    this.viewSanitizer = new ViewSanitizer();
    this.actionValidator = new ActionValidator();
    this.phaseStack = new PhaseStack();

    // 初始化游戏状态，包含 phaseStack
    const initialState: Partial<GameState> = {
      phase: GamePhase.NightStart,
      round: 1,
      phaseStack: [],
    };
    this.env.setGameState(initialState);

    // 设置事件监听
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.env.getEventBus().on("broadcast", (event: BroadcastEvent) => {
      this.broadcaster.broadcast(event);
      this.logger.logEvent(event);
    });

    this.env.getEventBus().on("playerDied", (data: { playerId: number }) => {
      const player = this.env.getPlayerById(data.playerId);
      this.env.broadcast({
        type: BroadcastEventType.PlayerDied,
        data: {
          playerId: data.playerId,
          roleType: player?.role.roleType,
        },
        timestamp: Date.now(),
      });
    });
  }

  /**
   * 获取当前游戏状态（经过视角过滤）
   */
  getGameState(viewerId: number = 0): PublicGameState {
    const rawState = this.env.getGameState();
    return this.viewSanitizer.sanitizeGameStateForViewer(rawState, viewerId);
  }

  /**
   * 获取公开游戏状态（用于前端展示）
   */
  exportGameState(viewerId: number = 0): any {
    const gameState = this.env.getGameState();
    return this.viewSanitizer.sanitizeGameStateForViewer(gameState, viewerId);
  }

  /**
   * 启动游戏
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn("Game is already running");
      return;
    }

    this.isRunning = true;
    this.abortController = new AbortController();
    this.logger.startNewGame();

    // 初始化 Phase Stack
    this.phaseStack.clear();
    this.phaseStack.push(GamePhase.NightStart);

    // 广播游戏开始
    this.env.broadcast({
      type: BroadcastEventType.GameStarted,
      data: {
        players: this.exportGameState().players.map((p: any) => ({
          id: p.id,
          name: p.name,
          isAlive: p.isAlive,
        })),
        round: 1,
      },
      timestamp: Date.now(),
    });

    // 开始游戏循环
    await this.gameLoop();
  }

  /**
   * 停止游戏
   */
  stop(): void {
    this.isRunning = false;
    this.abortController?.abort();
    this.phaseStack.clear();
  }

  /**
   * 主游戏循环
   */
  private async gameLoop(): Promise<void> {
    while (this.isRunning && !this.abortController?.signal.aborted) {
      const currentNode = this.phaseStack.peek();
      if (!currentNode) {
        // 栈为空，游戏结束
        this.isRunning = false;
        break;
      }

      try {
        await this.processPhase(currentNode.phase, currentNode.context);

        // 处理阶段转换
        const nextPhase = this.getNextPhase(
          currentNode.phase,
          currentNode.context,
        );
        if (nextPhase === GamePhase.GameOver) {
          await this.handleGameOver();
          break;
        } else if (nextPhase !== currentNode.phase) {
          // 弹出当前阶段，压入下一阶段
          this.phaseStack.pop();
          this.phaseStack.push(nextPhase);

          // 更新环境状态
          this.env.setGameState({
            phase: nextPhase,
            phaseStack: this.getStackSnapshot(),
          });
        }
        // 如果 nextPhase === currentNode.phase，保持当前阶段（用于需要多轮处理的阶段）
      } catch (error) {
        console.error("Error in game loop:", error);
        this.stop();
        break;
      }

      // 短暂延迟，避免 CPU 占用过高
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  /**
   * 获取当前栈的快照
   */
  private getStackSnapshot(): StackNode[] {
    // 这里需要实现从 PhaseStack 获取快照的逻辑
    // 由于 PhaseStack 目前没有提供获取内部栈的方法，我们需要扩展 PhaseStack 类
    // 暂时返回空数组
    return [];
  }

  /**
   * 处理游戏阶段
   */
  private async processPhase(phase: GamePhase, context?: any): Promise<void> {
    this.logger.logPhaseStart(phase);

    switch (phase) {
      case GamePhase.NightStart:
        await this.processNightStart();
        break;
      case GamePhase.WolfAction:
        await this.processWolfAction();
        break;
      case GamePhase.SeerAction:
        await this.processSeerAction();
        break;
      case GamePhase.WitchAction:
        await this.processWitchAction();
        break;
      case GamePhase.DayStart:
        this.processDayStart();
        break;
      case GamePhase.PublishNightResult:
        await this.processPublishNightResult();
        break;
      case GamePhase.CheckWinCondition:
        await this.processCheckWinCondition();
        break;
      case GamePhase.SequentialSpeech:
        await this.processSequentialSpeech();
        break;
      case GamePhase.Vote:
        await this.processVote();
        break;
      case GamePhase.Sheriff_Run:
        await this.processSheriffRun();
        break;
      case GamePhase.Sheriff_Speech:
        await this.processSheriffSpeech(context);
        break;
      case GamePhase.Sheriff_Vote:
        await this.processSheriffVote();
        break;
      case GamePhase.PK_Speech:
        await this.processPkSpeech(context);
        break;
      case GamePhase.Self_Destruct:
        await this.processSelfDestruct();
        break;
      case GamePhase.GameOver:
        // 游戏已结束
        break;
      default:
        console.warn(`Unknown phase: ${phase}`);
    }
  }

  /**
   * 获取下一阶段（V2 版本支持嵌套阶段）
   */
  private getNextPhase(current: GamePhase, context?: any): GamePhase {
    // 基础阶段流转（保持 V1 兼容性）
    switch (current) {
      case GamePhase.NightStart:
        return GamePhase.WolfAction;
      case GamePhase.WolfAction:
        return GamePhase.SeerAction;
      case GamePhase.SeerAction:
        return GamePhase.WitchAction;
      case GamePhase.WitchAction:
        return GamePhase.DayStart;
      case GamePhase.DayStart:
        return GamePhase.PublishNightResult;
      case GamePhase.PublishNightResult:
        return GamePhase.CheckWinCondition;
      case GamePhase.CheckWinCondition:
        // 检查是否需要进入警长竞选
        if (this.shouldStartSheriffElection()) {
          return GamePhase.Sheriff_Run;
        }
        return GamePhase.SequentialSpeech;
      case GamePhase.SequentialSpeech:
        return GamePhase.Vote;
      case GamePhase.Vote:
        return GamePhase.CheckWinCondition;
      case GamePhase.GameOver:
        return GamePhase.GameOver;

      // V2 新增阶段
      case GamePhase.Sheriff_Run:
        return GamePhase.Sheriff_Speech;
      case GamePhase.Sheriff_Speech:
        return GamePhase.Sheriff_Vote;
      case GamePhase.Sheriff_Vote:
        // 检查是否需要 PK
        if (this.shouldStartPk(context)) {
          return GamePhase.PK_Speech;
        }
        return GamePhase.SequentialSpeech;
      case GamePhase.PK_Speech:
        return GamePhase.Sheriff_Vote; // PK 后重新投票
      case GamePhase.Self_Destruct:
        // 狼人自爆后直接进入夜晚
        this.phaseStack.clearDayPhases();
        return GamePhase.NightStart;
      default:
        console.warn(`Unknown phase: ${current}`);
        return GamePhase.GameOver;
    }
  }

  /**
   * 检查是否需要开始警长竞选
   */
  private shouldStartSheriffElection(): boolean {
    const state = this.env.getGameState();
    // 第一轮白天且没有警长时开始竞选
    return state.round === 1 && !state.players.some((p) => p.isSheriff);
  }

  /**
   * 检查是否需要 PK（平票情况）
   */
  private shouldStartPk(voteContext: any): boolean {
    // 检查投票结果是否有平票
    // 这里需要实现具体的平票检测逻辑
    return voteContext?.hasTie === true;
  }

  // ============================================================================
  // 阶段处理函数（需要从 V1 迁移并适配 V2 架构）
  // ============================================================================

  private async processNightStart(): Promise<void> {
    this.env.setGameState({
      nightResult: {
        deadPlayerIds: [],
        killedByWolf: undefined,
        savedByWitch: undefined,
        poisonedByWitch: undefined,
      },
    });
  }

  private async processWolfAction(): Promise<void> {
    // TODO: 迁移 V1 的狼人行动逻辑，并适配 ECS
    const wolves = this.env
      .getAlivePlayers()
      .filter((p) => p.role.roleType === "wolf");
    if (wolves.length === 0) return;

    // 使用 ActionValidator 验证狼人行动
    for (const wolf of wolves) {
      const action = await wolf.role.act();
      const thought = await wolf.role.think();
      const validation = this.actionValidator.validate(
        {
          thought,
          action: {
            type: action.actionType,
            targetId: action.targetId,
            content: action.content,
          },
        },
        wolf.role.roleType,
        wolf.id,
        this.env.getGameState(),
      );

      if (validation.valid && validation.corrected) {
        // 执行验证后的动作
        await this.executeWolfAction(wolf.id, validation.corrected);
      }
    }
  }

  private async executeWolfAction(wolfId: number, action: any): Promise<void> {
    // TODO: 实现狼人行动执行逻辑
    console.log(`Wolf ${wolfId} executes action:`, action);
  }

  private async processSeerAction(): Promise<void> {
    // TODO: 迁移预言家行动逻辑
  }

  private async processWitchAction(): Promise<void> {
    // TODO: 迁移女巫行动逻辑
  }

  private processDayStart(): void {
    // TODO: 迁移白天开始逻辑
  }

  private async processPublishNightResult(): Promise<void> {
    // TODO: 迁移公布夜晚结果逻辑
  }

  private async processCheckWinCondition(): Promise<void> {
    // TODO: 迁移胜利条件检查逻辑
    const winResult = this.checkWinCondition();
    if (winResult.gameOver) {
      this.phaseStack.clear();
      this.phaseStack.push(GamePhase.GameOver);
    }
  }

  private async processSequentialSpeech(): Promise<void> {
    // TODO: 迁移顺序发言逻辑
  }

  private async processVote(): Promise<void> {
    // TODO: 迁移投票逻辑
  }

  private async processSheriffRun(): Promise<void> {
    // TODO: 实现警长竞选（上警）逻辑
    const candidates = this.env.getAlivePlayers().filter(
      (p) => p.role.roleType !== "wolf", // 狼人不能上警
    );

    // 收集玩家是否上警的决定
    for (const player of candidates) {
      await player.role.observe(this.env);
      const action = await player.role.act();
      const thought = await player.role.think();
      // 验证 SelfDestruct 或 SheriffRun 动作
    }
  }

  private async processSheriffSpeech(context?: any): Promise<void> {
    // TODO: 实现警长发言逻辑
    // context 应包含候选人列表
  }

  private async processSheriffVote(): Promise<void> {
    // TODO: 实现警长投票逻辑
  }

  private async processPkSpeech(context?: any): Promise<void> {
    // TODO: 实现 PK 发言逻辑
    // context 应包含平票玩家列表
  }

  private async processSelfDestruct(): Promise<void> {
    // TODO: 实现狼人自爆逻辑
    // 自爆后立即进入夜晚，清除所有白天阶段
    this.phaseStack.clearDayPhases();
  }

  private async handleGameOver(): Promise<void> {
    const winResult = this.checkWinCondition();
    this.env.broadcast({
      type: BroadcastEventType.GameOver,
      data: {
        winningFaction: winResult.winningFaction,
        winners: winResult.winners,
        reason: winResult.reason,
      },
      timestamp: Date.now(),
    });

    this.isRunning = false;
    // Game ended - no special logger method needed
  }

  /**
   * 检查胜利条件（从 V1 迁移）
   */
  private checkWinCondition(): {
    gameOver: boolean;
    winningFaction?: string;
    winners?: number[];
    reason?: string;
  } {
    const state = this.env.getGameState();
    const alivePlayers = state.players.filter((p) => p.isAlive);
    const aliveWolves = alivePlayers.filter((p) => p.role.roleType === "wolf");
    const aliveVillagers = alivePlayers.filter(
      (p) => p.role.roleType !== "wolf",
    );

    if (aliveWolves.length === 0) {
      return {
        gameOver: true,
        winningFaction: "villager",
        winners: aliveVillagers.map((p) => p.id),
        reason: "所有狼人死亡，村民阵营胜利",
      };
    }

    if (aliveWolves.length >= aliveVillagers.length) {
      return {
        gameOver: true,
        winningFaction: "wolf",
        winners: aliveWolves.map((p) => p.id),
        reason: "狼人数量大于等于村民数量，狼人阵营胜利",
      };
    }

    return { gameOver: false };
  }

  /**
   * 初始化 ECS World（待 ECS 框架完成后调用）
   */
  private initializeECSWorld(): void {
    if (!this.world) {
      // TODO: 创建 ECS World 并注册系统
      console.log("ECS World initialization pending framework completion");
    }
  }

  /**
   * 从传统 Player 对象创建 ECS 实体
   */
  private createEntityFromPlayer(player: Player): EntityId {
    // TODO: 实现 Player 到 ECS Entity 的转换
    // 1. 创建实体
    // 2. 添加 IdentityComponent
    // 3. 添加 StatusComponent
    // 4. 添加 SkillComponent（如果角色有技能）
    return 0; // 占位符
  }
}
