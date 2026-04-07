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
  IdentityComponent,
  StatusComponent,
  SkillComponent,
  Faction,
  RoleType,
  ActionType,
} from "./types";
import { Environment } from "./Environment";
import { PhaseStack } from "./PhaseStackEngine";
import { AgentController } from "../agent/AgentController";
import { GameLogger } from "../logger/GameLogger";
import { Broadcaster } from "../broadcaster/Broadcaster";
import { ViewSanitizer } from "./ViewSanitizer";
import { ActionValidator } from "../agent/ActionValidator";
import { GameWorld } from "../ecs/World";

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
    world: World, // 直接传入已初始化的World
    logger: GameLogger,
    broadcaster: Broadcaster,
  ) {
    this.config = config;
    this.logger = logger;
    this.broadcaster = broadcaster;

    // 直接使用传入的World
    this.world = world;

    this.env = new Environment(config, world);
    this.agentController = new AgentController(
      this.env,
      this.broadcaster,
      world,
      config.modelDefaults,
    );
    this.viewSanitizer = new ViewSanitizer(world);
    this.actionValidator = new ActionValidator();
    this.phaseStack = new PhaseStack();

    // 初始化游戏状态，从World获取玩家信息
    const initialState: Partial<GameState> = {
      phase: GamePhase.NightStart,
      round: 1,
      phaseStack: [],
      nightResult: {
        deadPlayerIds: [],
      },
    };
    this.env.setGameState(initialState);

    // 设置事件监听
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.env.getEventBus().on("broadcast", (event: BroadcastEvent) => {
      // 使用 ViewSanitizer 过滤事件数据
      const sanitizedEvent = this.viewSanitizer.sanitizeBroadcastEvent(event);
      this.broadcaster.broadcast(sanitizedEvent);
      this.logger.logEvent(sanitizedEvent);
    });

    this.env.getEventBus().on("playerDied", (data: { playerId: number }) => {
      const player = this.env.getPlayerById(data.playerId);
      let roleType: RoleType | undefined;

      // Get role type from ECS World
      if (player && this.world) {
        const identity = this.world.getComponent<IdentityComponent>(
          player.id,
          "IdentityComponent",
        );
        if (identity) {
          roleType = identity.roleType;
        }
      }

      this.env.broadcast({
        type: BroadcastEventType.PlayerDied,
        data: {
          playerId: data.playerId,
          roleType,
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
   * 主游戏循环 - Phase Stack 模式
   * 每个 processPhase 函数负责：
   * 1. 处理当前阶段逻辑
   * 2. 完成后弹出当前阶段（phaseStack.pop()）
   * 3. 根据场景压入下一阶段（如 pushDayStack, handleTieVote 等）
   * 4. 更新游戏状态
   */
  private async gameLoop(): Promise<void> {
    let iteration = 0;
    while (this.isRunning && !this.abortController?.signal.aborted) {
      iteration++;

      // 安全限制：防止无限循环
      if (iteration > 100) {
        console.error(
          `[gameLoop SAFETY] Exceeded 100 iterations, forcing stop. Stack: ${this.getStackSnapshot()
            .map((n) => n.phase)
            .join(" -> ")}`,
        );
        this.isRunning = false;
        break;
      }

      const currentNode = this.phaseStack.peek();
      // 直接检查栈内部状态
      const stackInternal = (this.phaseStack as any).stack;
      console.error(
        `[gameLoop] Iteration ${iteration}: Current node: ${currentNode?.phase}, Stack depth: ${this.phaseStack.depth}, phaseStack ref: ${this.phaseStack.toString().substring(0, 20)}..., Stack length: ${stackInternal?.length || 0}, Stack: ${stackInternal?.map((n: any) => n.phase).join(" -> ") || "empty"}`,
      );
      if (!currentNode) {
        // 栈为空，游戏结束
        console.error("[gameLoop] Stack empty, stopping game");
        this.isRunning = false;
        break;
      }

      try {
        // 处理当前阶段
        console.error(`[gameLoop] Processing phase: ${currentNode.phase}`);
        await this.processPhase(currentNode.phase, currentNode.context);
        console.error(
          `[gameLoop] Finished processing phase: ${currentNode.phase}, Stack depth: ${this.phaseStack.depth}, Stack snapshot: ${this.getStackSnapshot()
            .map((n) => n.phase)
            .join(" -> ")}`,
        );

        // 注意：processPhase 函数现在负责弹出当前阶段和压入下一阶段
        // 所以这里不需要额外的逻辑

        // 更新环境状态（当前阶段在 processPhase 中已更新）
        const peekResult = this.phaseStack.peek();
        const nextPhase = peekResult?.phase || GamePhase.GameOver;
        console.log(
          `[gameLoop] Next phase: ${nextPhase}, peek result: ${peekResult?.phase}, stack depth: ${this.phaseStack.depth}, stack internal: ${JSON.stringify((this.phaseStack as any).stack?.map((n: any) => n.phase))}`,
        );
        this.env.setGameState({
          phase: nextPhase,
          phaseStack: this.getStackSnapshot(),
        });

        // 广播游戏状态变化，包括阶段变更
        this.env.broadcastGameState();
      } catch (error) {
        console.error("Error in game loop:", error);
        console.error("Error stack:", (error as Error).stack);

        // 改进：不立即停止游戏，而是尝试恢复
        // 弹出当前阶段，尝试继续下一阶段
        try {
          this.phaseStack.pop(); // 弹出失败阶段
          console.warn(
            `[gameLoop] Recovered from error in phase, moving to next phase`,
          );

          // 更新游戏状态为下一个阶段
          const nextPhase = this.phaseStack.peek()?.phase || GamePhase.GameOver;
          this.env.setGameState({
            phase: nextPhase,
            phaseStack: this.getStackSnapshot(),
          });
          this.env.broadcastGameState();
        } catch (recoveryError) {
          console.error(
            "[gameLoop] Recovery failed, stopping game:",
            recoveryError,
          );
          this.stop();
          break;
        }

        // 恢复成功后，检查栈是否为空
        if (!this.phaseStack.peek()) {
          console.error(
            "[processWitchAction] Stack empty after recovery, stopping game",
          );
          this.isRunning = false;
          break;
        }
      }

      // 短暂延迟，避免 CPU 占用过高
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  /**
   * 获取当前栈的快照
   */
  private getStackSnapshot(): StackNode[] {
    return this.phaseStack.getStackSnapshot();
  }

  private getPhaseStackRefId(): string {
    // 获取对象的唯一引用ID
    return `ref_${Math.random().toString(36).substring(2)}`;
  }

  /**
   * 处理游戏阶段
   */
  private async processPhase(phase: GamePhase, context?: any): Promise<void> {
    console.error(
      `[processPhase] Starting phase: ${phase}, context: ${context ? "yes" : "no"}`,
    );
    this.logger.logPhaseStart(phase);

    switch (phase) {
      case GamePhase.NightStart:
        console.error(`[processPhase] Calling processNightStart...`);
        await this.processNightStart();
        console.error(`[processPhase] processNightStart completed`);
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
        // 游戏已结束，弹出GameOver节点
        this.phaseStack.pop();
        break;
      default:
        console.warn(`Unknown phase: ${phase}`);
    }

    // 记录游戏状态更新
    this.logger.logGameState(this.exportGameState());
  }

  /**
   * 场景1：标准的新一天（ARCHITECTURE.md 第93-115行）
   * 逆序压栈，后进先出
   */
  private pushDayStack(round: number): void {
    // 逆序压栈（后进先出） - PublishNightResult在栈底，CheckWinCondition在栈顶
    this.phaseStack.push(GamePhase.PublishNightResult); // 先压（到栈底）
    this.phaseStack.push(GamePhase.SequentialSpeech); // 第二个压
    this.phaseStack.push(GamePhase.Vote); // 第三个压
    this.phaseStack.push(GamePhase.CheckWinCondition); // 后压（到栈顶，最先执行）

    // 如果是第一天，额外插入上警栈
    if (round === 1) {
      this.pushSheriffElectionStack();
    }
  }

  /**
   * 场景2：第一天上警竞选（ARCHITECTURE.md 第119-131行）
   */
  private pushSheriffElectionStack(): void {
    this.phaseStack.push(GamePhase.Sheriff_Vote);
    this.phaseStack.push(GamePhase.Sheriff_Speech);
    this.phaseStack.push(GamePhase.Sheriff_Run);
  }

  // ============================================================================
  // 阶段处理函数（需要从 V1 迁移并适配 V2 架构）
  // ============================================================================

  private async processNightStart(): Promise<void> {
    console.error(
      `[processNightStart] Starting, Stack depth before: ${this.phaseStack.depth}`,
    );

    // 所有process方法第一步都pop自己
    const popped = this.phaseStack.pop();
    console.error(
      `[processNightStart] Popped: ${popped?.phase}, Stack depth after pop: ${this.phaseStack.depth}`,
    );

    const currentState = this.env.getGameState();

    // 重置夜晚结果，递增轮次
    this.env.setGameState({
      round: currentState.round + 1, // V1逻辑：开始新夜晚时递增轮次
      nightResult: {
        deadPlayerIds: [],
        killedByWolf: undefined,
        savedByWitch: undefined,
        poisonedByWitch: undefined,
      },
    });

    // Phase Stack 模式：一次性压入整个夜晚流程
    // 逆序压入整个夜晚阶段！
    console.error(`[processNightStart] Pushing night phases...`);
    console.error(
      `[processNightStart] Before push - Stack depth: ${this.phaseStack.depth}, internal length: ${(this.phaseStack as any).stack?.length || 0}`,
    );

    this.phaseStack.push(GamePhase.DayStart); // 第1个：DayStart（最后执行）
    console.error(
      `[processNightStart] After push DayStart - Stack depth: ${this.phaseStack.depth}`,
    );
    this.phaseStack.push(GamePhase.CheckWinCondition); // 第2个：CheckWinCondition
    console.error(
      `[processNightStart] After push CheckWinCondition - Stack depth: ${this.phaseStack.depth}`,
    );
    this.phaseStack.push(GamePhase.PublishNightResult); // 第3个：PublishNightResult
    console.error(
      `[processNightStart] After push PublishNightResult - Stack depth: ${this.phaseStack.depth}`,
    );
    this.phaseStack.push(GamePhase.WitchAction); // 第4个：WitchAction
    console.error(
      `[processNightStart] After push WitchAction - Stack depth: ${this.phaseStack.depth}`,
    );
    this.phaseStack.push(GamePhase.SeerAction); // 第5个：SeerAction
    console.error(
      `[processNightStart] After push SeerAction - Stack depth: ${this.phaseStack.depth}`,
    );
    this.phaseStack.push(GamePhase.WolfAction); // 第6个：WolfAction（最先执行）
    console.error(
      `[processNightStart] After push WolfAction - Stack depth: ${this.phaseStack.depth}`,
    );

    console.error(
      `[processNightStart] Stack depth after pushing: ${this.phaseStack.depth}, phaseStack ref: ${this.phaseStack.toString().substring(0, 20)}..., actual stack: ${this.phaseStack
        .getStackSnapshot()
        .map((n) => n.phase)
        .join(" -> ")}`,
    );
    console.error(
      `[processNightStart] getStackSnapshot(): ${this.getStackSnapshot()
        .map((n) => n.phase)
        .join(" -> ")}`,
    );

    // 更新游戏状态，phase由gameLoop设置
    // this.env.setGameState({ phase: currentPhase }); // 已移除，由gameLoop设置

    // 广播游戏状态变化（phase已由gameLoop设置）
    this.env.broadcastGameState();

    // 调试：检查调用后的栈状态
    console.error(
      `[processNightStart] END - Stack depth: ${this.phaseStack.depth}, Stack: ${this.phaseStack
        .getStackSnapshot()
        .map((n) => n.phase)
        .join(" -> ")}`,
    );

    // 强制更新游戏状态中的phaseStack
    this.env.setGameState({
      phaseStack: this.getStackSnapshot(),
    });
  }

  private async processWolfAction(): Promise<void> {
    try {
      // 在pop之前获取当前阶段用于广播
      const currentPhase = GamePhase.WolfAction;
      console.log(
        `[processWolfAction] Starting, Stack before pop: ${this.getStackSnapshot()
          .map((n) => n.phase)
          .join(" -> ")}`,
      );

      // 所有process方法第一步都pop自己
      this.phaseStack.pop();
      console.log(
        `[processWolfAction] After pop, Stack depth: ${this.phaseStack.depth}, Stack: ${this.getStackSnapshot()
          .map((n) => n.phase)
          .join(" -> ")}`,
      );

      if (!this.world) throw new Error("ECS World not initialized");

      // 真正的 ECS 查询：获取所有同时拥有 Identity 和 Status 组件的实体
      const entities = this.world.query<{
        IdentityComponent: IdentityComponent;
        StatusComponent: StatusComponent;
      }>("IdentityComponent", "StatusComponent");

      // 过滤出存活的狼人实体
      const aliveWolfEntities = entities.filter(
        (e: any) =>
          e.IdentityComponent.roleType === RoleType.Wolf &&
          e.StatusComponent.isAlive,
      );

      const historyBefore = this.env.getGameState().history.length;

      // 驱动 AgentController（使用重构后的 entityId 接口）
      // 使用 Promise.allSettled 而不是 Promise.all，允许部分狼人行动失败
      const results = await Promise.allSettled(
        aliveWolfEntities.map((entity: any) => {
          // 直接使用entity.entityId作为参数传递给runAgentCycle
          return this.agentController.runAgentCycle(entity.entityId);
        }),
      );

      // 记录失败的行动，但不中断整个流程
      const failedActions = results.filter(
        (r): r is PromiseRejectedResult => r.status === "rejected",
      );
      if (failedActions.length > 0) {
        console.warn(
          `[processWolfAction] ${failedActions.length} wolf actions failed:`,
          failedActions.map((f) => f.reason?.message || "Unknown error"),
        );
      }

      const gameState = this.env.getGameState();
      let nightResult = gameState.nightResult;
      const history = gameState.history;

      // 如果nightResult未初始化，初始化它
      if (!nightResult) {
        nightResult = {
          deadPlayerIds: [],
        };
      }
      const killActions = history
        .slice(historyBefore)
        .filter(
          (a) =>
            a.actionType === ActionType.Kill &&
            a.roleType === RoleType.Wolf &&
            a.targetId !== undefined,
        );

      // 注意：nightResult.killedByWolf 和 deadPlayerIds 已经在 AgentController.applySideEffects 中设置
      // 这里只需要验证和处理狼人行动的最终结果

      // 如果没有狼人击杀行动，确保killedByWolf为undefined
      if (killActions.length === 0) {
        nightResult.killedByWolf = undefined;
      } else {
        // 确保killedByWolf与第一个kill action一致
        nightResult.killedByWolf = killActions[0].targetId!;
      }

      // 更新夜晚结果，phase由gameLoop在processPhase之后设置
      this.env.setGameState({
        nightResult,
        // phase由gameLoop设置：this.phaseStack.peek()?.phase || GamePhase.GameOver
      });

      // 广播游戏状态变化
      this.env.broadcastGameState();

      await this.sleep(1000);

      // Phase Stack 模式：处理完成后只弹出当前阶段，下一阶段已在栈中
      // this.phaseStack.pop(); // 弹出 WolfAction，SeerAction自动成为栈顶 - 已移动到第一步
    } catch (error) {
      console.error("[processWolfAction] Error:", error);
      console.error("[processWolfAction] Error stack:", (error as Error).stack);
      throw error; // 重新抛出，让gameLoop处理
    }
  }

  private async processSeerAction(): Promise<void> {
    try {
      // 在pop之前获取当前阶段用于广播
      const currentPhase = GamePhase.SeerAction;
      console.log(
        `[processSeerAction] Starting, Stack before pop: ${this.getStackSnapshot()
          .map((n) => n.phase)
          .join(" -> ")}`,
      );

      // 所有process方法第一步都pop自己

      this.phaseStack.pop();
      console.log(
        `[processSeerAction] After pop, Stack depth: ${this.phaseStack.depth}`,
      );

      if (!this.world) throw new Error("ECS World not initialized");

      // 真正的 ECS 查询：获取所有同时拥有 Identity 和 Status 组件的实体
      const entities = this.world.query<{
        IdentityComponent: IdentityComponent;
        StatusComponent: StatusComponent;
      }>("IdentityComponent", "StatusComponent");

      // 过滤出存活的预言家实体
      const aliveSeerEntities = entities.filter(
        (e: any) =>
          e.IdentityComponent.roleType === RoleType.Seer &&
          e.StatusComponent.isAlive,
      );

      // Sequential just in case (but should only be one seer in MVP)
      for (const entity of aliveSeerEntities) {
        if (!entity.StatusComponent.isAlive) continue;

        // 直接使用entity.entityId作为参数传递给runAgentCycle
        await this.agentController.runAgentCycle(entity.entityId);
        await this.sleep(500);
      }

      // 更新游戏状态，phase由gameLoop设置
      // this.env.setGameState({ phase: currentPhase }); // 已移除，由gameLoop设置

      // 广播游戏状态变化（phase已由gameLoop设置）
      this.env.broadcastGameState();
    } catch (error) {
      console.error("[processSeerAction] Error:", error);
      console.error("[processSeerAction] Error stack:", (error as Error).stack);
      throw error; // 重新抛出，让gameLoop处理
    }
  }

  private async processWitchAction(): Promise<void> {
    try {
      // 在pop之前获取当前阶段用于广播
      const currentPhase = GamePhase.WitchAction;
      console.error(
        `[processWitchAction] Starting, Stack before pop: ${this.getStackSnapshot()
          .map((n) => n.phase)
          .join(" -> ")}`,
      );

      // 所有process方法第一步都pop自己
      this.phaseStack.pop();
      console.error(
        `[processWitchAction] After pop, Stack depth: ${this.phaseStack.depth}`,
      );

      if (!this.world) throw new Error("ECS World not initialized");

      const gameState = this.env.getGameState();
      let nightResult = gameState.nightResult;

      // 如果nightResult未初始化，初始化它
      if (!nightResult) {
        nightResult = {
          deadPlayerIds: [],
        };
      }

      // 真正的 ECS 查询：获取所有同时拥有 Identity 和 Status 组件的实体
      const entities = this.world.query<{
        IdentityComponent: IdentityComponent;
        StatusComponent: StatusComponent;
      }>("IdentityComponent", "StatusComponent");

      // 过滤出存活的女巫实体
      const aliveWitchEntities = entities.filter(
        (e: any) =>
          e.IdentityComponent.roleType === RoleType.Witch &&
          e.StatusComponent.isAlive,
      );

      console.log(
        `[processWitchAction] Found ${aliveWitchEntities.length} alive witch entities`,
      );

      for (const entity of aliveWitchEntities) {
        if (!entity.StatusComponent.isAlive) continue;

        // 直接使用entity.entityId作为参数传递给runAgentCycle
        const currentGameState = this.env.getGameState();
        const witchHasAntidote = currentGameState.witchHasAntidote;
        const witchHasPoison = currentGameState.witchHasPoison;

        console.error(
          `[processWitchAction] Calling agentController.runAgentCycle for witch entity ${entity.entityId}, witchHasAntidote=${witchHasAntidote}, witchHasPoison=${witchHasPoison}`,
        );

        const historyBefore = gameState.history.length;
        await this.agentController.runAgentCycle(entity.entityId);

        const newActions = this.env.getGameState().history.slice(historyBefore);
        console.error(
          `[processWitchAction] New actions after agentController: ${newActions.length}`,
        );
        let antidoteUsed = false;
        let poisonUsed = false;

        for (const action of newActions) {
          console.error(
            `[processWitchAction] Processing action: ${action.actionType}, targetId: ${action.targetId}`,
          );
          if (action.actionType === ActionType.Save && witchHasAntidote) {
            console.error(
              `[processWitchAction] Witch Save action detected, target: ${action.targetId}`,
            );
            nightResult.savedByWitch = nightResult.killedByWolf;
            antidoteUsed = true;
            // 女巫救人后，从死亡列表中移除被救的玩家
            if (nightResult.killedByWolf !== undefined) {
              console.error(
                `[processWitchAction] Removing ${nightResult.killedByWolf} from deadPlayerIds`,
              );
              nightResult.deadPlayerIds = nightResult.deadPlayerIds.filter(
                (id) => id !== nightResult.killedByWolf,
              );
            }
          } else if (
            action.actionType === ActionType.Poison &&
            witchHasPoison
          ) {
            if (action.targetId !== undefined) {
              nightResult.poisonedByWitch = action.targetId;
              poisonUsed = true;
              // 女巫毒人后，添加到死亡列表
              if (!nightResult.deadPlayerIds.includes(action.targetId)) {
                nightResult.deadPlayerIds.push(action.targetId);
              }
            }
          }
        }

        if (antidoteUsed || poisonUsed) {
          this.env.setGameState({
            witchHasAntidote: witchHasAntidote && !antidoteUsed,
            witchHasPoison: witchHasPoison && !poisonUsed,
            nightResult, // 保存更新后的nightResult
          });
        }

        await this.sleep(500);
      }

      await this.sleep(1000);

      // 更新游戏状态，phase由gameLoop设置
      // this.env.setGameState({ phase: currentPhase }); // 已移除，由gameLoop设置

      // 广播游戏状态变化（phase已由gameLoop设置）
      this.env.broadcastGameState();

      // Phase Stack 模式：处理完成后弹出当前阶段，栈自动流转
      // this.phaseStack.pop(); // 弹出 WitchAction，栈顶变为 DayStart - 已移动到第一步
    } catch (error) {
      console.error("[processWitchAction] Error:", error);
      console.error(
        "[processWitchAction] Error stack:",
        (error as Error).stack,
      );
      throw error; // 重新抛出，让gameLoop处理
    }
  }

  private processDayStart(): void {
    // 所有process方法第一步都pop自己
    this.phaseStack.pop();

    // 获取当前轮次
    const currentState = this.env.getGameState();
    const round = currentState.round || 1;

    // 根据ARCHITECTURE.md第93-115行，DayStart之后压入白天阶段栈
    this.pushDayStack(round);

    // 广播游戏状态变化
    this.env.broadcastGameState();
  }

  private async processPublishNightResult(): Promise<void> {
    // 所有process方法第一步都pop自己
    this.phaseStack.pop();

    const nightResult = this.env.getGameState().nightResult!;
    const deadIds = nightResult.deadPlayerIds;

    for (const deadId of deadIds) {
      this.env.markPlayerDead(deadId);
    }

    // 广播夜晚结果事件
    this.env.broadcast({
      type: BroadcastEventType.NightResult,
      data: nightResult,
      timestamp: Date.now(),
    });

    await this.sleep(1000);

    // Phase Stack 模式：处理完成后弹出当前阶段，栈自动流转
    // this.phaseStack.pop(); // 弹出 PublishNightResult，栈顶变为 CheckWinCondition - 已移动到第一步
  }

  private async processCheckWinCondition(): Promise<void> {
    // 所有process方法第一步都pop自己
    this.phaseStack.pop();

    const winResult = this.checkWinCondition();
    if (winResult.gameOver) {
      this.phaseStack.clear();
      this.phaseStack.push(GamePhase.GameOver);
    } else {
      const currentState = this.env.getGameState();

      // 检查是否有人被投票出局 - 遵循V1逻辑
      if (currentState.votedDeadId !== undefined) {
        // 有人被投票出局 → 进入夜晚
        this.phaseStack.push(GamePhase.NightStart);
      } else {
        // 没有人被投票出局 → 继续白天发言
        // 检查是否是第一天，决定是否压入上警栈
        const round = currentState.round;
        if (round === 1) {
          // 检查是否已经完成警长竞选（从 ECS World 中检查）
          const hasSheriff = this.hasSheriffInWorld();
          if (!hasSheriff) {
            this.pushSheriffElectionStack();
          } else {
            // 警长竞选已完成，进入顺序发言
            this.phaseStack.push(GamePhase.SequentialSpeech);
          }
        } else {
          this.phaseStack.push(GamePhase.SequentialSpeech);
        }
      }
    }
  }

  private async processSequentialSpeech(): Promise<void> {
    // 所有process方法第一步都pop自己
    this.phaseStack.pop();

    // Simple implementation for now - just advance the phase
    await this.sleep(1000);

    // Phase Stack 模式：处理完成后弹出当前阶段，栈自动流转
    // this.phaseStack.pop(); // 弹出 SequentialSpeech，栈顶变为 Vote - 已移动到第一步
  }

  private async processVote(): Promise<void> {
    // 所有process方法第一步都pop自己
    this.phaseStack.pop();

    if (!this.world) throw new Error("ECS World not initialized");

    const gameState = this.env.getGameState();
    const players = gameState.players;
    const alivePlayers = players.filter((p) => p.isAlive);

    const voteContext = this.phaseStack.peek()?.context || {};
    const onlyTargets = voteContext.onlyTargets as number[] | undefined;
    const excludeVoters = voteContext.excludeVoters as number[] | undefined;

    const voteMap = new Map<number, number>();
    const votingPlayerIds = new Set<number>();
    const historyBefore = gameState.history.length;

    for (
      let i = gameState.history.length - 1;
      i >= 0 && votingPlayerIds.size < alivePlayers.length;
      i--
    ) {
      const action = gameState.history[i];
      if (
        action.actionType === ActionType.Vote &&
        action.targetId !== undefined &&
        !votingPlayerIds.has(action.playerId)
      ) {
        const targetPlayer = players.find((p) => p.id === action.targetId);
        const voterPlayer = players.find((p) => p.id === action.playerId);

        if (
          targetPlayer &&
          targetPlayer.isAlive &&
          voterPlayer &&
          voterPlayer.isAlive &&
          (!onlyTargets || onlyTargets.includes(action.targetId)) &&
          (!excludeVoters || !excludeVoters.includes(action.playerId))
        ) {
          votingPlayerIds.add(action.playerId);
          voteMap.set(action.targetId, (voteMap.get(action.targetId) || 0) + 1);
        }
      }
    }

    const playersToVote = alivePlayers.filter(
      (player) =>
        !votingPlayerIds.has(player.id) &&
        (!excludeVoters || !excludeVoters.includes(player.id)),
    );

    if (playersToVote.length > 0) {
      await Promise.all(
        playersToVote.map((player) =>
          this.agentController.runAgentCycle(player.id),
        ),
      );

      const newHistory = this.env.getGameState().history.slice(historyBefore);
      for (const action of newHistory) {
        if (
          action.actionType === ActionType.Vote &&
          action.targetId !== undefined &&
          !votingPlayerIds.has(action.playerId)
        ) {
          const targetPlayer = players.find((p) => p.id === action.targetId);
          const voterPlayer = players.find((p) => p.id === action.playerId);

          if (
            targetPlayer &&
            targetPlayer.isAlive &&
            voterPlayer &&
            voterPlayer.isAlive &&
            (!onlyTargets || onlyTargets.includes(action.targetId)) &&
            (!excludeVoters || !excludeVoters.includes(action.playerId))
          ) {
            votingPlayerIds.add(action.playerId);
            voteMap.set(
              action.targetId,
              (voteMap.get(action.targetId) || 0) + 1,
            );
          }
        }
      }
    }

    let maxVotes = 0;
    let votedDeadId: number | undefined;
    let tie = false;
    let tiedPlayerIds: number[] = [];

    for (const [targetId, count] of voteMap) {
      if (count > maxVotes) {
        maxVotes = count;
        votedDeadId = targetId;
        tie = false;
        tiedPlayerIds = [targetId];
      } else if (count === maxVotes && maxVotes > 0) {
        tie = true;
        if (!tiedPlayerIds.includes(targetId)) {
          tiedPlayerIds.push(targetId);
        }
      }
    }

    if (votedDeadId !== undefined && !tie) {
      this.env.setGameState({ votedDeadId });
      this.env.markPlayerDead(votedDeadId);

      const deadPlayer = players.find((p) => p.id === votedDeadId);
      this.env.broadcast({
        type: BroadcastEventType.PlayerDied,
        data: {
          playerId: votedDeadId,
          playerName: deadPlayer?.name,
          reason: "voted_out",
        },
        timestamp: Date.now(),
      });

      console.log(
        `[投票结果] 玩家 ${deadPlayer?.name} (ID: ${votedDeadId}) 被投票出局，获得 ${maxVotes} 票`,
      );
    } else if (tie && tiedPlayerIds.length > 1) {
      console.log(
        `[投票结果] 平票：玩家 ${tiedPlayerIds.join(", ")} 各获得 ${maxVotes} 票，进入PK阶段`,
      );

      this.phaseStack.push(GamePhase.PK_Speech, {
        speakers: [...tiedPlayerIds].reverse(),
        tiedPlayerIds,
      });
    } else {
      console.log(`[投票结果] 无人被投票出局`);
      this.env.setGameState({ votedDeadId: undefined });
    }

    await this.sleep(1000);
  }

  private async processSheriffRun(): Promise<void> {
    // 所有process方法第一步都pop自己
    this.phaseStack.pop();

    // Simple implementation for now - just advance the phase
    await this.sleep(1000);

    // Phase Stack 模式：处理完成后弹出当前阶段，栈自动流转
    // this.phaseStack.pop(); // 弹出 Sheriff_Run，栈顶变为 Sheriff_Speech - 已移动到第一步
  }

  private async processSheriffSpeech(context?: any): Promise<void> {
    // 所有process方法第一步都pop自己
    this.phaseStack.pop();

    // Simple implementation for now - just advance the phase
    await this.sleep(1000);

    // Phase Stack 模式：处理完成后弹出当前阶段，栈自动流转
    // this.phaseStack.pop(); // 弹出 Sheriff_Speech，栈顶变为 Sheriff_Vote - 已移动到第一步
  }

  private async processSheriffVote(): Promise<void> {
    // 所有process方法第一步都pop自己
    this.phaseStack.pop();

    // 警长选举：收集所有玩家的警长投票并选出警长
    const players = this.env.getGameState().players;
    const alivePlayers = players.filter((p) => p.isAlive);

    // 获取所有玩家的警长投票
    const voteMap = new Map<number, number>();
    const history = this.env.getGameState().history;
    const votingPlayerIds = new Set<number>();

    // 从最近的历史记录中收集警长投票
    for (
      let i = history.length - 1;
      i >= 0 && votingPlayerIds.size < alivePlayers.length;
      i--
    ) {
      const action = history[i];
      if (
        action.actionType === ActionType.SheriffVote &&
        action.targetId !== undefined &&
        !votingPlayerIds.has(action.playerId)
      ) {
        votingPlayerIds.add(action.playerId);
        voteMap.set(action.targetId, (voteMap.get(action.targetId) || 0) + 1);
      }
    }

    // 如果没有收集到投票，等待玩家投票
    if (voteMap.size === 0) {
      // 等待所有存活玩家投票
      await Promise.all(
        alivePlayers
          .filter((p) => p.isAlive)
          .map((player) => this.agentController.runAgentCycle(player.id)),
      );

      // 重新收集投票
      const newHistory = this.env.getGameState().history;
      for (let i = newHistory.length - 1; i >= 0; i--) {
        const action = newHistory[i];
        if (
          action.actionType === ActionType.SheriffVote &&
          action.targetId !== undefined &&
          !votingPlayerIds.has(action.playerId)
        ) {
          votingPlayerIds.add(action.playerId);
          voteMap.set(action.targetId, (voteMap.get(action.targetId) || 0) + 1);
        }
      }
    }

    // 统计最高票数
    let maxVotes = 0;
    let sheriffPlayerId: number | undefined;
    let tie = false;

    for (const [targetId, count] of voteMap) {
      if (count > maxVotes) {
        maxVotes = count;
        sheriffPlayerId = targetId;
        tie = false;
      } else if (count === maxVotes && maxVotes > 0) {
        tie = true;
      }
    }

    // 处理平票情况
    if (tie || sheriffPlayerId === undefined) {
      // 平票时进入PK发言阶段
      const tiedPlayerIds = Array.from(voteMap.entries())
        .filter(([_, count]) => count === maxVotes)
        .map(([targetId]) => targetId);

      if (tiedPlayerIds.length > 0) {
        // 压入PK阶段，传递平票玩家列表作为上下文
        // this.phaseStack.pop(); // 弹出 Sheriff_Vote - 已移动到第一步
        this.phaseStack.push(GamePhase.PK_Speech, { tiedPlayerIds });
        return;
      } else {
        // 没有投票，选择第一个存活的玩家作为默认警长
        sheriffPlayerId = alivePlayers[0]?.id;
      }
    }

    // 设置警长
    if (sheriffPlayerId !== undefined) {
      const sheriffPlayer = players.find((p) => p.id === sheriffPlayerId);
      if (sheriffPlayer) {
        // 更新玩家状态，设置为警长
        const updatedPlayers = players.map(
          (p) =>
            p.id === sheriffPlayer.id
              ? { ...p, isSheriff: true }
              : { ...p, isSheriff: false }, // 确保其他玩家不是警长
        );

        this.env.setGameState({
          players: updatedPlayers,
        });

        // 广播警长选举结果
        this.env.broadcast({
          type: BroadcastEventType.SheriffElected,
          data: {
            playerId: sheriffPlayer.id,
            playerName: sheriffPlayer.name,
          },
          timestamp: Date.now(),
        });
      }
    }

    await this.sleep(1000);

    // Phase Stack 模式：处理完成后弹出当前阶段，栈自动流转
    // this.phaseStack.pop(); // 弹出 Sheriff_Vote，栈顶变为 SequentialSpeech - 已移动到第一步
  }

  private async processPkSpeech(context?: any): Promise<void> {
    // 所有process方法第一步都pop自己
    this.phaseStack.pop();

    console.log("处理 PK 发言阶段");

    if (!context || !context.speakers || !Array.isArray(context.speakers)) {
      console.error("PK 发言阶段缺少有效的 speakers 上下文");
      return; // 已经pop了，可以直接返回
    }

    const speakers = context.speakers as number[];
    console.log(`PK 发言玩家: ${speakers.join(", ")}`);

    // 让每个平票玩家发言
    for (const playerId of speakers) {
      const player = this.env.getPlayerById(playerId);
      if (!player || !player.isAlive) {
        console.log(`玩家 ${playerId} 不存在或已死亡，跳过发言`);
        continue;
      }

      // 获取玩家角色信息（用于日志）
      let roleInfo = "未知角色";
      if (this.world) {
        const identity = this.world.getComponent<IdentityComponent>(
          playerId,
          "IdentityComponent",
        );
        if (identity) {
          roleInfo = identity.roleType;
        }
      }

      console.log(`玩家 ${player.name} (${roleInfo}) 进行 PK 发言`);

      // 在实际游戏中，这里会调用 AgentController 让玩家发言
      // 暂时用 sleep 模拟发言时间
      await this.sleep(100);
    }

    console.log("PK 发言阶段完成");

    // PK 发言完成后，弹出当前阶段
    // this.phaseStack.pop(); // 已移动到第一步

    // PK 发言后进入投票阶段（只允许投给平票玩家）
    this.phaseStack.push(GamePhase.Vote, {
      onlyTargets: speakers,
      excludeVoters: speakers, // 平票玩家不能投票
    });
  }

  private async processSelfDestruct(): Promise<void> {
    console.log("处理狼人自爆阶段");

    // 弹出当前阶段（自爆阶段已完成）
    this.phaseStack.pop();

    // 自爆后立即进入夜晚，清除所有白天阶段
    this.phaseStack.clear();

    // 立即进入天黑
    this.phaseStack.push(GamePhase.NightStart);

    console.log("狼人自爆完成，进入夜晚阶段");

    // 自爆玩家死亡
    // 注意：在实际游戏中，自爆玩家ID应该从上下文或事件中获取
    // 这里暂时不实现具体玩家死亡逻辑
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
    console.error(
      `[checkWinCondition] ENTER - called from: ${new Error().stack?.split("\n")[2]?.trim()}`,
    );

    // 必须要有 ECS World
    if (!this.world) {
      throw new Error(
        "ECS World not initialized - required for V2 architecture",
      );
    }

    // 真正的 ECS 查询：获取所有同时拥有 Identity 和 Status 组件的实体
    const entities = this.world.query<{
      IdentityComponent: IdentityComponent;
      StatusComponent: StatusComponent;
    }>("IdentityComponent", "StatusComponent");

    // 过滤出存活的狼人实体和村民实体
    const aliveEntities = entities.filter(
      (e: any) => e.StatusComponent.isAlive,
    );
    const aliveWolfEntities = aliveEntities.filter(
      (e: any) => e.IdentityComponent.faction === Faction.Wolf,
    );
    const aliveVillagerEntities = aliveEntities.filter(
      (e: any) => e.IdentityComponent.faction === Faction.Villager,
    );

    console.error(
      `[checkWinCondition] aliveWolfEntities: ${aliveWolfEntities.length}, aliveVillagerEntities: ${aliveVillagerEntities.length}`,
    );

    if (aliveWolfEntities.length === 0) {
      console.error(
        `[checkWinCondition] Game over: villagers win, all wolves dead`,
      );
      return {
        gameOver: true,
        winningFaction: "villager",
        winners: aliveVillagerEntities.map((e: any) => e.entityId),
        reason: "所有狼人死亡，村民阵营胜利",
      };
    }

    if (aliveWolfEntities.length >= aliveVillagerEntities.length) {
      console.error(
        `[checkWinCondition] Game over: wolves win (${aliveWolfEntities.length} wolves >= ${aliveVillagerEntities.length} villagers)`,
      );
      return {
        gameOver: true,
        winningFaction: "wolf",
        winners: aliveWolfEntities.map((e: any) => e.entityId),
        reason: "狼人数量大于等于村民数量，狼人阵营胜利",
      };
    }

    console.error(
      `[checkWinCondition] Game continues: ${aliveWolfEntities.length} wolves, ${aliveVillagerEntities.length} villagers`,
    );
    return { gameOver: false };
  }

  /**
   * 初始化 ECS World
   */

  /**
   * Check if there is a sheriff in the game
   * 注意：警长状态存储在 Environment 中，而不是 ECS World
   */
  private hasSheriffInWorld(): boolean {
    // 从 Environment 查询警长状态，因为警长选举更新的是 Environment
    const gameState = this.env.getGameState();
    return gameState.players?.some((p) => p.isSheriff === true) || false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
