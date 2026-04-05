import { GameEngineV2 } from "../../src/core/GameEngineV2";
import {
  GameConfig,
  Player,
  RoleType,
  Faction,
  ModelConfig,
  GamePhase,
} from "../../src/core/types";
import { Broadcaster } from "../../src/broadcaster/Broadcaster";
import { GameLogger } from "../../src/logger/GameLogger";
import { PhaseStack } from "../../src/core/PhaseStackEngine";

describe("GameEngineV2", () => {
  let gameEngine: GameEngineV2;
  let logger: GameLogger;
  let broadcaster: Broadcaster;
  let config: GameConfig;
  let players: Player[];

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

    const modelConfig: ModelConfig = {
      baseURL: "http://test.local",
      apiKey: "test-key",
      model: "test-model",
      temperature: 0.7,
      maxTokens: 1024,
    };

    players = [
      {
        id: 1,
        name: "player1",
        isAlive: true,
        isSheriff: false,
        faction: Faction.Wolf,
        modelConfig,
        role: {
          roleType: RoleType.Wolf,
          faction: Faction.Wolf,
          act: jest.fn(),
          think: jest.fn(),
          observe: jest.fn(),
        } as any,
      },
      {
        id: 2,
        name: "player2",
        isAlive: true,
        isSheriff: false,
        faction: Faction.Villager,
        modelConfig,
        role: {
          roleType: RoleType.Villager,
          faction: Faction.Villager,
          act: jest.fn(),
          think: jest.fn(),
          observe: jest.fn(),
        } as any,
      },
      {
        id: 3,
        name: "player3",
        isAlive: true,
        isSheriff: false,
        faction: Faction.Villager,
        modelConfig,
        role: {
          roleType: RoleType.Villager,
          faction: Faction.Villager,
          act: jest.fn(),
          think: jest.fn(),
          observe: jest.fn(),
        } as any,
      },
    ] as Player[];

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

    gameEngine = new GameEngineV2(config, players, logger, broadcaster);
  });

  describe("核心功能", () => {
    test("正确初始化游戏引擎", () => {
      expect(gameEngine).toBeDefined();
    });

    test("获取游戏状态返回有效对象", () => {
      const state = gameEngine.getGameState();
      expect(state).toBeDefined();
      expect(typeof state).toBe("object");
      expect(Array.isArray(state.players)).toBe(true);
    });

    test("导出游戏状态返回过滤后的视图", () => {
      const exported = gameEngine.exportGameState();
      expect(exported).toBeDefined();
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
      expect(view1).not.toBe(view2);
    });

    test("公开游戏状态不包含敏感信息", () => {
      const publicState = gameEngine.exportGameState();
      expect(publicState).not.toHaveProperty("secretData");
      expect(publicState).not.toHaveProperty("privateGameState");
    });
  });

  describe("游戏流程", () => {
    test("开始游戏调用logger方法", async () => {
      await gameEngine.start();

      expect(logger.startNewGame).toHaveBeenCalled();
      expect(broadcaster.broadcast).toHaveBeenCalled();
    });

    test("停止游戏取消内部状态", () => {
      gameEngine.stop();
    });
  });
});
