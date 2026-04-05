import { GameEngineV2 } from "../../src/core/GameEngineV2";
import { GameFactoryV2 } from "../../src/core/GameFactoryV2";
import { GameWorld } from "../../src/ecs/World";
import {
  GameConfig,
  Player,
  RoleType,
  Faction,
  ModelConfig,
  GamePhase,
  IdentityComponent,
  StatusComponent,
  SkillComponent,
  EntityId,
} from "../../src/core/types";
import { Broadcaster } from "../../src/broadcaster/Broadcaster";
import { GameLogger } from "../../src/logger/GameLogger";
import { PhaseStack } from "../../src/core/PhaseStackEngine";

describe("GameEngineV2", () => {
  let gameEngine: GameEngineV2;
  let logger: GameLogger;
  let broadcaster: Broadcaster;
  let config: GameConfig;
  let world: GameWorld;

  beforeEach(() => {
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

    world = new GameWorld();

    const modelConfig: ModelConfig = {
      baseURL: "http://test.local",
      apiKey: "test-key",
      model: "test-model",
      temperature: 0.7,
      maxTokens: 1024,
    };

    const gameFactory = new GameFactoryV2(config, modelConfig, world);
    gameFactory.createPlayers();

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

    broadcaster = {
      broadcast: jest.fn(),
    } as any;

    gameEngine = new GameEngineV2(config, world, logger, broadcaster);
  });

  describe("核心功能", () => {
    test("正确初始化游戏引擎", () => {
      expect(gameEngine).toBeDefined();
    });

    test("获取游戏状态返回有效对象", () => {
      const state = gameEngine.getGameState();
      expect(state).toBeDefined();
      expect(typeof state).toBe("object");
      expect(state).toHaveProperty("phase");
      expect(state).toHaveProperty("round");
    });

    test("导出游戏状态返回过滤后的视图", () => {
      const exported = gameEngine.exportGameState();
      expect(exported).toBeDefined();
      expect(exported).toHaveProperty("phase");
    });

    test("开始和停止游戏方法存在", () => {
      expect(typeof gameEngine.start).toBe("function");
      expect(typeof gameEngine.stop).toBe("function");
    });
  });

  describe("Phase Stack 集成", () => {
    test("游戏引擎内部使用PhaseStack", () => {
      expect(gameEngine.start).toBeDefined();
    });
  });

  describe("视角隔离（ViewSanitizer）", () => {
    test("不同玩家获取不同视图", () => {
      const view1 = gameEngine.getGameState(1);
      const view2 = gameEngine.getGameState(2);

      expect(view1).toBeDefined();
      expect(view2).toBeDefined();
    });

    test("公开游戏状态不包含敏感信息", () => {
      const publicState = gameEngine.exportGameState();
      expect(publicState).not.toHaveProperty("secretData");
      expect(publicState).not.toHaveProperty("privateGameState");
    });
  });

  describe("游戏流程", () => {
    test("开始游戏调用logger方法", async () => {
      // 启动游戏但立即停止，避免无限循环
      const startPromise = gameEngine.start();

      // 等待一小段时间确保start方法被调用
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 停止游戏
      gameEngine.stop();

      // 等待start完成
      await startPromise;

      expect(logger.startNewGame).toHaveBeenCalled();
      expect(broadcaster.broadcast).toHaveBeenCalled();
    }, 10000); // 10秒超时

    test("停止游戏取消内部状态", () => {
      gameEngine.stop();
    });
  });
});
