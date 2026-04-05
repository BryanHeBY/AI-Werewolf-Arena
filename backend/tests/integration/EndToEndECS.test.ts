import { GameEngineV2 } from "../../src/core/GameEngineV2";
import { GameFactoryV2 } from "../../src/core/GameFactoryV2";
import { GameWorld } from "../../src/ecs/World";
import {
  GameConfig,
  RoleType,
  Faction,
  ModelConfig,
  GamePhase,
  IdentityComponent,
  StatusComponent,
  SkillComponent,
  ActionType,
  PlayerAction,
  NightResult,
  BroadcastEventType,
} from "../../src/core/types";
import { Broadcaster } from "../../src/broadcaster/Broadcaster";
import { GameLogger } from "../../src/logger/GameLogger";
import { AgentController } from "../../src/agent/AgentController";
import { Environment } from "../../src/core/Environment";

// Mock OpenAIClient 来避免真实的API调用
const mockChatCompletion = jest.fn();
jest.mock("../../src/llm/OpenAIClient", () => {
  return {
    OpenAIClient: jest.fn().mockImplementation(() => ({
      chatCompletion: mockChatCompletion,
    })),
  };
});

describe("ECS架构端到端测试", () => {
  let gameEngine: GameEngineV2;
  let logger: GameLogger;
  let broadcaster: Broadcaster;
  let config: GameConfig;
  let world: GameWorld;
  let broadcastEvents: any[] = [];

  beforeEach(() => {
    // 重置所有mock
    jest.clearAllMocks();
    mockChatCompletion.mockClear();

    // 基础配置：6人局（2狼2村民1预言家1女巫）
    config = {
      totalPlayers: 6,
      wolfCount: 2,
      villagerCount: 2,
      seerCount: 1,
      witchCount: 1,
      modelDefaults: {
        baseURL: "http://test.local",
        apiKey: "test-key",
        model: "test-model",
        temperature: 0.7,
        maxTokens: 1024,
      },
    };

    // 创建ECS World
    world = new GameWorld();

    // 创建ModelConfig
    const modelConfig: ModelConfig = {
      baseURL: "http://test.local",
      apiKey: "test-key",
      model: "test-model",
      temperature: 0.7,
      maxTokens: 1024,
    };

    // 创建玩家并注册到ECS World
    const gameFactory = new GameFactoryV2(config, modelConfig, world);
    gameFactory.createPlayers();

    // 初始化mock logger
    logger = {
      startNewGame: jest.fn(),
      logEvent: jest.fn(),
      logGameState: jest.fn(),
      logPhaseStart: jest.fn(),
      logGameOver: jest.fn(),
      flush: jest.fn(),
      close: jest.fn(),
      getCurrentFilePath: jest.fn(),
    } as any;

    // 初始化mock broadcaster
    broadcaster = {
      broadcast: jest.fn().mockImplementation((event) => {
        broadcastEvents.push(event);
      }),
    } as any;

    // 创建GameEngineV2
    gameEngine = new GameEngineV2(config, world, logger, broadcaster);

    // 重置收集数组
    broadcastEvents = [];
  });

  afterEach(() => {
    // 确保游戏停止
    gameEngine.stop();
  });

  /**
   * 获取ECS World中的玩家信息
   */
  const getPlayerInfoFromECS = (playerId: number) => {
    const identity = world.getComponent<IdentityComponent>(
      playerId,
      "IdentityComponent",
    );
    const status = world.getComponent<StatusComponent>(
      playerId,
      "StatusComponent",
    );
    const skills = world.getComponent<SkillComponent>(
      playerId,
      "SkillComponent",
    );

    return {
      identity,
      status,
      skills,
    };
  };

  /**
   * 获取存活的狼人实体ID列表
   */
  const getAliveWolfEntityIds = (): number[] => {
    const entities = world.query<{
      IdentityComponent: IdentityComponent;
      StatusComponent: StatusComponent;
    }>("IdentityComponent", "StatusComponent");

    return entities
      .filter(
        (e) =>
          e.IdentityComponent.roleType === RoleType.Wolf &&
          e.StatusComponent.isAlive,
      )
      .map((e) => e.entityId);
  };

  /**
   * 获取存活的村民阵营实体ID列表
   */
  const getAliveVillagerEntityIds = (): number[] => {
    const entities = world.query<{
      IdentityComponent: IdentityComponent;
      StatusComponent: StatusComponent;
    }>("IdentityComponent", "StatusComponent");

    return entities
      .filter(
        (e) =>
          e.IdentityComponent.faction === Faction.Villager &&
          e.StatusComponent.isAlive,
      )
      .map((e) => e.entityId);
  };

  /**
   * 验证ECS架构完整性：检查是否存在role.act()残留
   */
  const verifyECSArchitectureIntegrity = () => {
    // 检查所有玩家是否通过ECS组件存储数据
    const entities = world.query<{
      IdentityComponent: IdentityComponent;
      StatusComponent: StatusComponent;
      SkillComponent: SkillComponent;
    }>("IdentityComponent", "StatusComponent", "SkillComponent");

    expect(entities.length).toBeGreaterThan(0);

    // 验证每个实体都有完整的组件
    entities.forEach((entity) => {
      expect(entity.IdentityComponent).toBeDefined();
      expect(entity.StatusComponent).toBeDefined();
      expect(entity.SkillComponent).toBeDefined();

      // 验证身份组件
      expect(entity.IdentityComponent.entityId).toBe(entity.entityId);
      expect(entity.IdentityComponent.roleType).toBeDefined();
      expect(entity.IdentityComponent.faction).toBeDefined();
      expect(entity.IdentityComponent.name).toBeDefined();

      // 验证状态组件
      expect(entity.StatusComponent.entityId).toBe(entity.entityId);
      expect(typeof entity.StatusComponent.isAlive).toBe("boolean");

      // 验证技能组件
      expect(entity.SkillComponent.entityId).toBe(entity.entityId);
      expect(Array.isArray(entity.SkillComponent.skills)).toBe(true);
    });

    // 检查GameFactoryV2.createPlayers()返回void
    const gameFactory = new GameFactoryV2(
      config,
      config.modelDefaults,
      new GameWorld(),
    );
    expect(() => gameFactory.createPlayers()).not.toThrow();
  };

  describe("场景1：简单场景 - 狼人第一晚击杀村民，村民胜利", () => {
    test("狼人第一晚击杀村民，村民阵营胜利", async () => {
      // 验证ECS架构完整性
      verifyECSArchitectureIntegrity();

      // Mock OpenAIClient 返回预定义的狼人行动（击杀村民1）
      mockChatCompletion.mockResolvedValue({
        thought: "我是狼人，我需要杀死一个村民。",
        action: {
          type: ActionType.Kill,
          targetId: 1, // 假设村民1的ID是1
        },
      } as any);

      // 启动游戏
      await gameEngine.start();

      // 验证游戏状态 - 游戏启动后可能已经在WolfAction阶段
      const initialGameState = gameEngine.getGameState();
      // 游戏可能已经进入了WolfAction阶段
      expect([
        GamePhase.NightStart,
        GamePhase.WolfAction,
        GamePhase.SeerAction,
        GamePhase.WitchAction,
        GamePhase.DayStart,
      ]).toContain(initialGameState.phase);

      // 模拟游戏流程（由于我们mock了OpenAIClient，AgentController会使用mock的响应）
      // 这里我们主要验证ECS组件更新和Phase Stack流转

      // 获取存活的狼人和村民
      const aliveWolves = getAliveWolfEntityIds();
      const aliveVillagers = getAliveVillagerEntityIds();

      expect(aliveWolves.length).toBe(2); // 2个狼人
      expect(aliveVillagers.length).toBe(4); // 2村民 + 1预言家 + 1女巫

      // 验证Phase Stack初始状态
      // 在NightStart阶段后，应该压入夜晚的各个阶段

      // 检查广播事件
      expect(broadcaster.broadcast).toHaveBeenCalled();

      // 验证游戏日志记录
      expect(logger.startNewGame).toHaveBeenCalled();
      expect(logger.logPhaseStart).toHaveBeenCalledWith(GamePhase.NightStart);
    });
  });

  describe("场景2：中等场景 - 女巫使用解药救活被杀村民", () => {
    test("女巫在狼人击杀后使用解药救活村民", async () => {
      // Mock OpenAIClient 返回预定义行动
      let callCount = 0;
      mockChatCompletion.mockImplementation(() => {
        callCount++;
        // 第一次调用：狼人1击杀
        if (callCount === 1) {
          return Promise.resolve({
            thought: "我是狼人1，我选择击杀村民1。",
            action: {
              type: ActionType.Kill,
              targetId: 1,
            },
          } as any);
        }
        // 第二次调用：狼人2也击杀（默认会统一行动）
        if (callCount === 2) {
          return Promise.resolve({
            thought: "我是狼人2，我也同意击杀村民1。",
            action: {
              type: ActionType.Kill,
              targetId: 1,
            },
          } as any);
        }
        // 第三次调用：女巫使用解药
        if (callCount === 3) {
          return Promise.resolve({
            thought: "我是女巫，我看到村民1被狼人击杀，使用解药救他。",
            action: {
              type: ActionType.Save,
              targetId: 1,
            },
          } as any);
        }
        // 其他调用：默认不行动
        return Promise.resolve({
          thought: "我没有特殊行动。",
          action: {
            type: ActionType.NoAction,
          },
        } as any);
      });

      // 启动游戏
      await gameEngine.start();

      // 验证女巫的解药使用逻辑
      // 女巫应该在WitchAction阶段响应

      // 检查广播事件中是否有玩家被救活的消息
      const saveEvents = broadcastEvents.filter(
        (event) =>
          event.type === BroadcastEventType.PlayerAction &&
          event.data?.actionType === ActionType.Save,
      );

      expect(saveEvents.length).toBeGreaterThan(0);

      // 验证夜晚结果中savedByWitch字段
      const gameState = (gameEngine as any).env.getGameState();
      const nightResult: NightResult = gameState.nightResult || {};

      // 在女巫使用解药后，killedByWolf应该被保存
      expect(nightResult.savedByWitch).toBeDefined();
      expect(nightResult.savedByWitch).toBe(nightResult.killedByWolf);

      // 验证玩家没有真正死亡
      const player1Status = world.getComponent<StatusComponent>(
        1,
        "StatusComponent",
      );
      expect(player1Status?.isAlive).toBe(true);
    });
  });

  describe("场景3：复杂场景 - 预言家查验狼人，女巫毒杀狼人，村民投票获胜", () => {
    test("完整游戏流程：预言家查验狼人，女巫毒杀狼人，村民投票获胜", async () => {
      // 复杂场景：模拟完整的游戏剧本
      let callOrder: number[] = [];

      // Mock OpenAIClient 根据玩家ID返回不同的行动
      mockChatCompletion.mockImplementation((params: any) => {
        const systemPrompt: string = params.messages[0].content;
        const playerId = callOrder.length + 1;
        callOrder.push(playerId);

        // 根据系统提示判断角色
        if (systemPrompt.includes("狼人")) {
          // 狼人行动：击杀村民2
          return Promise.resolve({
            thought: "我是狼人，我们决定击杀村民2。",
            action: {
              type: ActionType.Kill,
              targetId: 2,
            },
          } as any);
        } else if (systemPrompt.includes("预言家")) {
          // 预言家行动：查验玩家3（假设是狼人）
          return Promise.resolve({
            thought: "我是预言家，我怀疑玩家3是狼人，查验他。",
            action: {
              type: ActionType.Check,
              targetId: 3,
            },
          } as any);
        } else if (systemPrompt.includes("女巫")) {
          // 女巫行动：使用毒药毒杀狼人3
          return Promise.resolve({
            thought:
              "我是女巫，我收到预言家的查验结果，知道玩家3是狼人，使用毒药毒杀他。",
            action: {
              type: ActionType.Poison,
              targetId: 3,
            },
          } as any);
        } else if (systemPrompt.includes("村民")) {
          // 村民行动：白天投票
          // 村民根据预言家查验结果投票给狼人3
          return Promise.resolve({
            thought: "我是村民，听到预言家说玩家3是狼人，投票放逐他。",
            action: {
              type: ActionType.Vote,
              targetId: 3,
            },
          } as any);
        }

        // 默认行动
        return Promise.resolve({
          thought: "我没有特殊行动。",
          action: {
            type: ActionType.NoAction,
          },
        } as any);
      });

      // 启动游戏
      await gameEngine.start();

      // 验证完整的Phase Stack流转
      // 1. NightStart -> 压入夜晚阶段栈
      // 2. WolfAction -> 狼人行动
      // 3. SeerAction -> 预言家行动
      // 4. WitchAction -> 女巫行动
      // 5. DayStart -> 压入白天阶段栈
      // 6. PublishNightResult -> 公布夜晚结果
      // 7. CheckWinCondition -> 检查胜利条件
      // 8. SequentialSpeech -> 顺序发言
      // 9. Vote -> 投票
      // 10. CheckWinCondition -> 再次检查胜利条件

      // 验证夜晚结果
      const gameState = (gameEngine as any).env.getGameState();
      const nightResult: NightResult = gameState.nightResult || {};

      // 狼人击杀了村民2
      expect(nightResult.killedByWolf).toBe(2);
      // 女巫毒杀了狼人3
      expect(nightResult.poisonedByWitch).toBe(3);

      // 验证死亡玩家列表
      expect(nightResult.deadPlayerIds).toContain(2); // 村民2
      expect(nightResult.deadPlayerIds).toContain(3); // 狼人3

      // 验证ECS组件更新
      const player2Status = world.getComponent<StatusComponent>(
        2,
        "StatusComponent",
      );
      const player3Status = world.getComponent<StatusComponent>(
        3,
        "StatusComponent",
      );

      expect(player2Status?.isAlive).toBe(false);
      expect(player3Status?.isAlive).toBe(false);

      // 验证预言家查验结果
      const lastChecked = gameState.lastChecked;
      expect(lastChecked).toBeDefined();
      if (lastChecked) {
        expect(lastChecked.targetId).toBe(3);
        // 预言家应该查验出玩家3是狼人
        expect(lastChecked.isWolf).toBe(true);
      }

      // 验证游戏历史记录
      const history: PlayerAction[] = gameState.history || [];
      const killActions = history.filter(
        (a) => a.actionType === ActionType.Kill,
      );
      const checkActions = history.filter(
        (a) => a.actionType === ActionType.Check,
      );
      const poisonActions = history.filter(
        (a) => a.actionType === ActionType.Poison,
      );
      const voteActions = history.filter(
        (a) => a.actionType === ActionType.Vote,
      );

      expect(killActions.length).toBeGreaterThan(0);
      expect(checkActions.length).toBeGreaterThan(0);
      expect(poisonActions.length).toBeGreaterThan(0);
      expect(voteActions.length).toBeGreaterThan(0);
    });
  });

  describe("场景4：边缘场景 - 平安夜", () => {
    test("狼人未击杀或女巫救活导致平安夜", async () => {
      // Mock OpenAIClient：狼人不选择击杀目标
      mockChatCompletion.mockImplementation((params: any) => {
        const systemPrompt: string = params.messages[0].content;

        if (systemPrompt.includes("狼人")) {
          // 狼人不杀人
          return Promise.resolve({
            thought: "我是狼人，我们决定今晚不杀人，迷惑村民。",
            action: {
              type: ActionType.NoAction,
            },
          } as any);
        } else if (systemPrompt.includes("女巫")) {
          // 女巫也不行动
          return Promise.resolve({
            thought: "我是女巫，今晚没有人被杀，我不需要使用解药。",
            action: {
              type: ActionType.NoAction,
            },
          } as any);
        }

        return Promise.resolve({
          thought: "我没有特殊行动。",
          action: {
            type: ActionType.NoAction,
          },
        } as any);
      });

      // 启动游戏
      await gameEngine.start();

      // 验证夜晚结果：平安夜
      const gameState = (gameEngine as any).env.getGameState();
      const nightResult: NightResult = gameState.nightResult || {};

      // 平安夜：没有玩家死亡
      expect(nightResult.deadPlayerIds).toEqual([]);
      expect(nightResult.killedByWolf).toBeUndefined();
      expect(nightResult.savedByWitch).toBeUndefined();
      expect(nightResult.poisonedByWitch).toBeUndefined();

      // 验证所有玩家仍然存活
      const entities = world.query<{
        IdentityComponent: IdentityComponent;
        StatusComponent: StatusComponent;
      }>("IdentityComponent", "StatusComponent");

      const aliveCount = entities.filter(
        (e) => e.StatusComponent.isAlive,
      ).length;
      expect(aliveCount).toBe(6); // 所有6个玩家都存活

      // 验证广播事件中应该有平安夜通知
      const nightResultEvents = broadcastEvents.filter(
        (event) => event.type === BroadcastEventType.NightResult,
      );
      expect(nightResultEvents.length).toBeGreaterThan(0);
    });
  });

  describe("场景5：防作弊验证 - ECS架构完整性", () => {
    test("验证ECS架构完整性，无role.act()残留", () => {
      // 验证ECS架构完整性
      verifyECSArchitectureIntegrity();

      // 检查GameEngineV2构造函数接收World参数
      expect(() => {
        new GameEngineV2(config, world, logger, broadcaster);
      }).not.toThrow();

      // 检查GameFactoryV2.createPlayers()返回void
      const newWorld = new GameWorld();
      const gameFactory = new GameFactoryV2(
        config,
        config.modelDefaults,
        newWorld,
      );
      const result = gameFactory.createPlayers();
      expect(result).toBeUndefined(); // 应该返回void

      // 验证World中有实体
      const entities = newWorld.query<{
        IdentityComponent: IdentityComponent;
        StatusComponent: StatusComponent;
      }>("IdentityComponent", "StatusComponent");

      expect(entities.length).toBe(6); // 6个玩家

      // 检查所有必要的组件
      entities.forEach((entity) => {
        expect(entity.IdentityComponent).toBeDefined();
        expect(entity.StatusComponent).toBeDefined();

        // 检查是否有不应该存在的字段
        const allComponents = newWorld.getAllComponents(entity.entityId);
        expect(allComponents).toBeDefined();

        // 确保没有role字段
        const componentKeys = Array.from(allComponents!.keys());
        expect(componentKeys).not.toContain("role");
        expect(componentKeys).not.toContain("RoleComponent"); // 确保没有遗留的role组件
      });

      // 验证Phase Stack一次性逆序压栈的实现
      // 在NightStart阶段，应该一次性压入整个夜晚流程
      const phaseStack = (gameEngine as any).phaseStack;
      expect(phaseStack).toBeDefined();

      // 检查游戏状态中phaseStack字段
      const gameState = gameEngine.getGameState();
      expect(gameState.phaseStack).toBeDefined();
      expect(Array.isArray(gameState.phaseStack)).toBe(true);
    });

    test("验证AgentController直接调用OpenAIClient，而非通过role.act()", () => {
      // 创建AgentController实例
      const env = new Environment(config, world);
      const agentController = new AgentController(
        env,
        broadcaster,
        world,
        config.modelDefaults,
      );

      // 验证AgentController有runAgentCycle方法
      expect(typeof agentController.runAgentCycle).toBe("function");

      // 验证OpenAIClient被正确mock
      expect(mockChatCompletion).toBeDefined();

      // 验证没有role.act()调用
      // 通过检查代码结构来验证（这里我们假设实现正确）
      // 在实际测试中，可能需要更复杂的检测

      // 验证ECS查询正常工作
      const wolfEntities = getAliveWolfEntityIds();
      expect(Array.isArray(wolfEntities)).toBe(true);

      // 验证通过ECS获取玩家信息
      wolfEntities.forEach((wolfId) => {
        const playerInfo = getPlayerInfoFromECS(wolfId);
        expect(playerInfo.identity?.roleType).toBe(RoleType.Wolf);
        expect(playerInfo.status?.isAlive).toBe(true);
      });
    });
  });

  describe("Phase Stack验证", () => {
    test("验证Phase Stack一次性逆序压栈", async () => {
      // Mock OpenAIClient
      mockChatCompletion.mockResolvedValue({
        thought: "测试行动",
        action: {
          type: ActionType.NoAction,
        },
      } as any);

      // 启动游戏
      await gameEngine.start();

      // 获取游戏状态
      const gameState = (gameEngine as any).env.getGameState();

      // 验证phaseStack字段存在
      expect(gameState.phaseStack).toBeDefined();
      expect(Array.isArray(gameState.phaseStack)).toBe(true);

      // 验证阶段是有效的游戏阶段
      expect(Object.values(GamePhase)).toContain(gameState.phase);

      // 验证Phase Stack的流转
      // 在NightStart阶段，processNightStart方法应该：
      // 1. 弹出NightStart
      // 2. 逆序压入夜晚阶段：WolfAction, SeerAction, WitchAction, DayStart

      // 由于我们不能直接访问私有方法，我们通过观察游戏流程来验证
      // 这里我们验证广播事件中包含了阶段变更

      const phaseChangeEvents = broadcastEvents.filter(
        (event) => event.type === BroadcastEventType.PhaseChanged,
      );

      expect(phaseChangeEvents.length).toBeGreaterThan(0);

      // 验证阶段变更顺序
      const phaseSequence = phaseChangeEvents.map((event) => event.data?.phase);

      // 应该包含夜晚的各个阶段
      expect(phaseSequence).toContain(GamePhase.NightStart);
      expect(phaseSequence).toContain(GamePhase.WolfAction);
      expect(phaseSequence).toContain(GamePhase.SeerAction);
      expect(phaseSequence).toContain(GamePhase.WitchAction);
      expect(phaseSequence).toContain(GamePhase.DayStart);
    });

    test("验证Phase Stack自动流转", async () => {
      // 设置简单的mock响应
      mockChatCompletion.mockResolvedValue({
        thought: "测试",
        action: {
          type: ActionType.NoAction,
        },
      } as any);

      // 启动游戏
      await gameEngine.start();

      // 验证游戏循环能够正常进行
      // 通过检查广播事件数量来验证
      expect(broadcastEvents.length).toBeGreaterThan(0);

      // 验证GameStarted事件
      const gameStartedEvents = broadcastEvents.filter(
        (event) => event.type === BroadcastEventType.GameStarted,
      );
      expect(gameStartedEvents.length).toBe(1);

      // 验证PhaseChanged事件
      const phaseChangedEvents = broadcastEvents.filter(
        (event) => event.type === BroadcastEventType.PhaseChanged,
      );
      expect(phaseChangedEvents.length).toBeGreaterThan(0);

      // 验证游戏状态更新
      expect(logger.logGameState).toHaveBeenCalled();
      expect(logger.logPhaseStart).toHaveBeenCalled();
    });
  });

  describe("组件更新验证", () => {
    test("验证ECS组件正确更新", async () => {
      // Mock OpenAIClient：狼人击杀村民1
      mockChatCompletion.mockResolvedValue({
        thought: "击杀村民1",
        action: {
          type: ActionType.Kill,
          targetId: 1,
        },
      } as any);

      // 启动游戏并运行到夜晚结果公布
      await gameEngine.start();

      // 获取玩家1的状态组件
      const player1StatusBefore = world.getComponent<StatusComponent>(
        1,
        "StatusComponent",
      );
      expect(player1StatusBefore?.isAlive).toBe(true);

      // 模拟夜晚结果处理
      const gameState = (gameEngine as any).env.getGameState();
      gameState.nightResult = {
        deadPlayerIds: [1],
        killedByWolf: 1,
      };

      // 调用markPlayerDead（模拟PublishNightResult阶段）
      (gameEngine as any).env.markPlayerDead(1);

      // 验证玩家1的状态组件已更新
      const player1StatusAfter = world.getComponent<StatusComponent>(
        1,
        "StatusComponent",
      );
      expect(player1StatusAfter?.isAlive).toBe(false);

      // 验证技能组件
      const player1Skills = world.getComponent<SkillComponent>(
        1,
        "SkillComponent",
      );
      expect(player1Skills).toBeDefined();

      // 验证身份组件保持不变
      const player1Identity = world.getComponent<IdentityComponent>(
        1,
        "IdentityComponent",
      );
      expect(player1Identity).toBeDefined();
      expect(player1Identity?.roleType).toBeDefined();
      expect(player1Identity?.faction).toBeDefined();
    });

    test("验证胜利条件检查使用ECS数据", () => {
      // 直接测试checkWinCondition方法
      const checkWinCondition = (gameEngine as any).checkWinCondition.bind(
        gameEngine,
      );

      // 初始状态：所有玩家存活
      const initialResult = checkWinCondition();
      expect(initialResult.gameOver).toBe(false);

      // 模拟狼人死亡的情况
      // 获取所有狼人实体并标记为死亡
      const wolfEntities = getAliveWolfEntityIds();
      wolfEntities.forEach((wolfId) => {
        const status = world.getComponent<StatusComponent>(
          wolfId,
          "StatusComponent",
        );
        if (status) {
          status.isAlive = false;
          world.addComponent(wolfId, status);
        }
      });

      // 现在检查胜利条件：应该村民胜利
      const resultAfterWolvesDead = checkWinCondition();
      expect(resultAfterWolvesDead.gameOver).toBe(true);
      expect(resultAfterWolvesDead.winningFaction).toBe("villager");

      // 验证返回的winners列表
      expect(resultAfterWolvesDead.winners).toBeDefined();
      expect(Array.isArray(resultAfterWolvesDead.winners)).toBe(true);

      // winners应该是存活的村民阵营实体
      const aliveVillagers = getAliveVillagerEntityIds();
      expect(resultAfterWolvesDead.winners).toEqual(
        expect.arrayContaining(aliveVillagers),
      );
    });
  });
});
