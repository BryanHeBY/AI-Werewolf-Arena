import { PromptPipeline } from "../../src/agent/PromptPipeline";
import { Environment } from "../../src/core/Environment";
import {
  GamePhase,
  RoleType,
  Faction,
  GameState,
  Player,
  ActionType,
} from "../../src/core/types";

describe("PromptPipeline", () => {
  let env: Environment;
  let gameState: GameState;
  let pipeline: PromptPipeline;

  beforeEach(() => {
    // 创建模拟游戏状态
    gameState = {
      phase: GamePhase.NightStart,
      round: 1,
      players: [
        {
          id: 1,
          name: "Player 1",
          role: {
            roleType: RoleType.Wolf,
            faction: Faction.Wolf,
            playerId: 1,
            canActInPhase: () => true,
            getSystemPrompt: () => "你是狼人，每晚可以杀死一名玩家。",
            observe: async () => {},
            think: async () => "",
            act: async () => ({
              playerId: 1,
              roleType: RoleType.Wolf,
              actionType: ActionType.NoAction,
              thought: "",
              timestamp: Date.now(),
              targetId: undefined,
            }),
          },
          isAlive: true,
          faction: Faction.Wolf,
          modelConfig: {
            baseURL: "http://test.local",
            apiKey: "test-key",
            model: "test-model",
            temperature: 0.7,
            maxTokens: 1024,
          },
          isSheriff: false,
          privateMemory: ["昨晚我杀了玩家3", "我认为玩家2可能是预言家"],
        },
        {
          id: 2,
          name: "Player 2",
          role: {
            roleType: RoleType.Seer,
            faction: Faction.Villager,
            playerId: 2,
            canActInPhase: () => true,
            getSystemPrompt: () => "你是预言家，每晚可以查验一名玩家的阵营。",
            observe: async () => {},
            think: async () => "",
            act: async () => ({
              playerId: 2,
              roleType: RoleType.Seer,
              actionType: ActionType.NoAction,
              thought: "",
              timestamp: Date.now(),
              targetId: undefined,
            }),
          },
          isAlive: true,
          faction: Faction.Villager,
          modelConfig: {
            baseURL: "http://test.local",
            apiKey: "test-key",
            model: "test-model",
            temperature: 0.7,
            maxTokens: 1024,
          },
          isSheriff: true,
          privateMemory: ["昨晚查验了玩家1，他是狼人"],
        },
        {
          id: 3,
          name: "Player 3",
          role: {
            roleType: RoleType.Villager,
            faction: Faction.Villager,
            playerId: 3,
            canActInPhase: () => true,
            getSystemPrompt: () => "你是村民，没有特殊能力。",
            observe: async () => {},
            think: async () => "",
            act: async () => ({
              playerId: 3,
              roleType: RoleType.Villager,
              actionType: ActionType.NoAction,
              thought: "",
              timestamp: Date.now(),
              targetId: undefined,
            }),
          },
          isAlive: true,
          faction: Faction.Villager,
          modelConfig: {
            baseURL: "http://test.local",
            apiKey: "test-key",
            model: "test-model",
            temperature: 0.7,
            maxTokens: 1024,
          },
          isSheriff: false,
          privateMemory: [],
        },
      ],
      phaseStack: [],
      nightResult: {},
    };

    // 创建环境
    env = new Environment(
      {
        totalPlayers: 3,
        wolfCount: 1,
        villagerCount: 2,
        seerCount: 1,
        witchCount: 0,
      },
      gameState.players,
    );
    env.setGameState(gameState);

    // 创建PromptPipeline
    pipeline = new PromptPipeline();
  });

  describe("生成游戏状态提示", () => {
    test("为预言家生成游戏状态提示", () => {
      const playerId = 2; // 预言家
      const prompt = pipeline.generateGameStatePrompt(env, playerId);

      expect(prompt).toBeDefined();
      expect(prompt).toContain("游戏状态");
      expect(prompt).toContain("当前阶段");
      expect(prompt).toContain("第1轮");
      expect(prompt).toContain("玩家信息");
      expect(prompt).toContain("游戏历史");
    });

    test("为村民生成游戏状态提示", () => {
      const playerId = 3; // 村民
      const prompt = pipeline.generateGameStatePrompt(env, playerId);

      expect(prompt).toBeDefined();
      expect(prompt).toContain("游戏状态");
      expect(prompt).toContain("当前阶段");
    });

    test("为死者生成有限信息提示", () => {
      // 创建一个死亡的玩家
      const deadPlayerId = 4;
      const deadPlayer: Player = {
        id: deadPlayerId,
        name: "Player 4",
        role: {
          roleType: RoleType.Villager,
          faction: Faction.Villager,
          playerId: deadPlayerId,
          canActInPhase: () => false,
          getSystemPrompt: () => "你是村民，没有特殊能力。",
          observe: async () => {},
          think: async () => "",
          act: async () => ({
            playerId: deadPlayerId,
            roleType: RoleType.Villager,
            actionType: ActionType.NoAction,
            thought: "",
            timestamp: Date.now(),
            targetId: undefined,
          }),
        },
        isAlive: false,
        faction: Faction.Villager,
        modelConfig: {
          baseURL: "http://test.local",
          apiKey: "test-key",
          model: "test-model",
          temperature: 0.7,
          maxTokens: 1024,
        },
        isSheriff: false,
        privateMemory: [],
      };

      // 添加死亡玩家到环境
      const updatedPlayers = [...gameState.players, deadPlayer];
      env = new Environment(
        {
          totalPlayers: 4,
          wolfCount: 1,
          villCount: 3,
          seerCount: 1,
          witchCount: 0,
        },
        updatedPlayers,
      );
      env.setGameState({ ...gameState, players: updatedPlayers });

      const prompt = pipeline.generateGameStatePrompt(env, deadPlayerId);

      expect(prompt).toBeDefined();
      expect(prompt).toContain("你已死亡");
      expect(prompt).toContain("游戏结束");
      expect(prompt).not.toContain("当前阶段");
    });
  });

  describe("生成角色特定提示", () => {
    test("为狼人生成角色特定提示", () => {
      const playerId = 1; // 狼人
      const prompt = pipeline.generateRoleSpecificPrompt(env, playerId);

      expect(prompt).toBeDefined();
      expect(prompt).toContain("狼人");
      expect(prompt).toContain("杀死");
      expect(prompt).toContain("阵营");
    });

    test("为预言家生成角色特定提示", () => {
      const playerId = 2; // 预言家
      const prompt = pipeline.generateRoleSpecificPrompt(env, playerId);

      expect(prompt).toBeDefined();
      expect(prompt).toContain("预言家");
      expect(prompt).toContain("查验");
      expect(prompt).toContain("身份");
    });

    test("为村民生成角色特定提示", () => {
      const playerId = 3; // 村民
      const prompt = pipeline.generateRoleSpecificPrompt(env, playerId);

      expect(prompt).toBeDefined();
      expect(prompt).toContain("村民");
      expect(prompt).toContain("投票");
      expect(prompt).toContain("发言");
    });
  });

  describe("生成行动提示", () => {
    test("为夜晚阶段生成行动提示", () => {
      const playerId = 1; // 狼人
      const prompt = pipeline.generateActionPrompt(env, playerId);

      expect(prompt).toBeDefined();
      expect(prompt).toContain("行动");
      expect(prompt).toContain("目标");
      expect(prompt).toContain("JSON格式");
    });

    test("为白天阶段生成行动提示", () => {
      // 切换到白天阶段
      env.setGameState({ ...gameState, phase: GamePhase.DayStart });

      const playerId = 3; // 村民
      const prompt = pipeline.generateActionPrompt(env, playerId);

      expect(prompt).toBeDefined();
      expect(prompt).toContain("发言");
      expect(prompt).toContain("投票");
    });
  });
});
