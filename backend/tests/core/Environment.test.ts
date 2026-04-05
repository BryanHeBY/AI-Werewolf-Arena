import { Environment } from "../../src/core/Environment";
import {
  GameConfig,
  Player,
  RoleType,
  Faction,
  ActionType,
  GamePhase,
  PlayerAction,
} from "../../src/core/types";
import { EventBus } from "../../src/core/EventBus";

describe("Environment", () => {
  let config: GameConfig;
  let players: Player[];
  let environment: Environment;

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

    players = [
      {
        id: 1,
        name: "player1",
        isAlive: true,
        isSheriff: false,
        faction: Faction.Wolf,
        modelConfig: config.modelDefaults,
        role: {
          roleType: RoleType.Wolf,
          faction: Faction.Wolf,
          act: jest.fn(),
          think: jest.fn(),
          observe: jest.fn(),
          canActInPhase: jest.fn().mockReturnValue(true),
          getSystemPrompt: jest.fn().mockReturnValue("test prompt"),
        } as any,
      },
      {
        id: 2,
        name: "player2",
        isAlive: true,
        isSheriff: false,
        faction: Faction.Villager,
        modelConfig: config.modelDefaults,
        role: {
          roleType: RoleType.Villager,
          faction: Faction.Villager,
          act: jest.fn(),
          think: jest.fn(),
          observe: jest.fn(),
          canActInPhase: jest.fn().mockReturnValue(true),
          getSystemPrompt: jest.fn().mockReturnValue("test prompt"),
        } as any,
      },
      {
        id: 3,
        name: "player3",
        isAlive: true,
        isSheriff: false,
        faction: Faction.Villager,
        modelConfig: config.modelDefaults,
        role: {
          roleType: RoleType.Seer,
          faction: Faction.Villager,
          act: jest.fn(),
          think: jest.fn(),
          observe: jest.fn(),
          canActInPhase: jest.fn().mockReturnValue(true),
          getSystemPrompt: jest.fn().mockReturnValue("test prompt"),
        } as any,
      },
      {
        id: 4,
        name: "player4",
        isAlive: true,
        isSheriff: false,
        faction: Faction.Villager,
        modelConfig: config.modelDefaults,
        role: {
          roleType: RoleType.Witch,
          faction: Faction.Villager,
          act: jest.fn(),
          think: jest.fn(),
          observe: jest.fn(),
          canActInPhase: jest.fn().mockReturnValue(true),
          getSystemPrompt: jest.fn().mockReturnValue("test prompt"),
        } as any,
      },
      {
        id: 5,
        name: "player5",
        isAlive: true,
        isSheriff: false,
        faction: Faction.Wolf,
        modelConfig: config.modelDefaults,
        role: {
          roleType: RoleType.Wolf,
          faction: Faction.Wolf,
          act: jest.fn(),
          think: jest.fn(),
          observe: jest.fn(),
          canActInPhase: jest.fn().mockReturnValue(true),
          getSystemPrompt: jest.fn().mockReturnValue("test prompt"),
        } as any,
      },
      {
        id: 6,
        name: "player6",
        isAlive: true,
        isSheriff: false,
        faction: Faction.Villager,
        modelConfig: config.modelDefaults,
        role: {
          roleType: RoleType.Villager,
          faction: Faction.Villager,
          act: jest.fn(),
          think: jest.fn(),
          observe: jest.fn(),
          canActInPhase: jest.fn().mockReturnValue(true),
          getSystemPrompt: jest.fn().mockReturnValue("test prompt"),
        } as any,
      },
    ];

    environment = new Environment(config, players);
  });

  describe("constructor", () => {
    test("initializes with provided config and players", () => {
      expect(environment).toBeDefined();
      const gameState = environment.getGameState();
      expect(gameState.players).toHaveLength(6);
      expect(gameState.round).toBe(0);
      expect(gameState.deadPlayerIds).toHaveLength(0);
      expect(gameState.history).toHaveLength(0);
      expect(gameState.witchHasAntidote).toBe(true);
      expect(gameState.witchHasPoison).toBe(true);
    });

    test("initializes with empty phase stack", () => {
      const gameState = environment.getGameState();
      expect(gameState.phaseStack).toEqual([]);
    });
  });

  describe("getGameState", () => {
    test("returns a copy of game state, not reference", () => {
      const state1 = environment.getGameState();
      const state2 = environment.getGameState();
      expect(state1).toEqual(state2);
      expect(state1).not.toBe(state2);
    });

    test("state includes all expected properties", () => {
      const state = environment.getGameState();
      expect(state).toHaveProperty("phase");
      expect(state).toHaveProperty("round");
      expect(state).toHaveProperty("players");
      expect(state).toHaveProperty("deadPlayerIds");
      expect(state).toHaveProperty("history");
      expect(state).toHaveProperty("witchHasAntidote");
      expect(state).toHaveProperty("witchHasPoison");
      expect(state).toHaveProperty("currentSpeechIndex");
      expect(state).toHaveProperty("phaseStack");
    });
  });

  describe("getPublicGameState", () => {
    test("returns public state with sanitized players", () => {
      const publicState = environment.getPublicGameState();
      expect(publicState.players).toHaveLength(6);

      const player = publicState.players[0];
      expect(player).toHaveProperty("id");
      expect(player).toHaveProperty("name");
      expect(player).toHaveProperty("roleType");
      expect(player).toHaveProperty("faction");
      expect(player).toHaveProperty("isAlive");
      expect(player).not.toHaveProperty("modelConfig");
      expect(player).not.toHaveProperty("role");
      expect(player).not.toHaveProperty("isSheriff");
    });

    test("includes all public game state fields", () => {
      const publicState = environment.getPublicGameState();
      expect(publicState).toHaveProperty("phase");
      expect(publicState).toHaveProperty("round");
      expect(publicState).toHaveProperty("players");
      expect(publicState).toHaveProperty("deadPlayerIds");
      expect(publicState).toHaveProperty("history");
      expect(publicState).toHaveProperty("nightResult");
      expect(publicState).toHaveProperty("votedDeadId");
      expect(publicState).toHaveProperty("winner");
      expect(publicState).toHaveProperty("witchHasAntidote");
      expect(publicState).toHaveProperty("witchHasPoison");
      expect(publicState).toHaveProperty("currentSpeechIndex");
      expect(publicState).toHaveProperty("phaseStack");
    });
  });

  describe("setGameState", () => {
    test("updates game state with partial state", () => {
      const newPhase = GamePhase.NightStart;
      const newRound = 1;

      environment.setGameState({
        phase: newPhase,
        round: newRound,
      });

      const state = environment.getGameState();
      expect(state.phase).toBe(newPhase);
      expect(state.round).toBe(newRound);
    });

    test("emits stateChanged event", () => {
      const eventBus = environment.getEventBus();
      const emitSpy = jest.spyOn(eventBus, "emit");

      environment.setGameState({ round: 1 });

      expect(emitSpy).toHaveBeenCalledWith("stateChanged", expect.any(Object));
    });

    test("merges partial state with existing state", () => {
      environment.setGameState({ round: 1, phase: GamePhase.NightStart });
      environment.setGameState({ round: 2 });

      const state = environment.getGameState();
      expect(state.round).toBe(2);
      expect(state.phase).toBe(GamePhase.NightStart);
    });
  });

  describe("getEventBus", () => {
    test("returns event bus instance", () => {
      const eventBus = environment.getEventBus();
      expect(eventBus).toBeInstanceOf(EventBus);
    });
  });

  describe("getGameConfig", () => {
    test("returns a copy of game config", () => {
      const returnedConfig = environment.getGameConfig();
      expect(returnedConfig).toEqual(config);
      expect(returnedConfig).not.toBe(config);
    });
  });

  describe("publishAction", () => {
    test("adds action to history", () => {
      const action: PlayerAction = {
        playerId: 1,
        roleType: RoleType.Wolf,
        actionType: ActionType.Speak,
        targetId: undefined,
        content: "Test message",
        thought: "Test thought",
        timestamp: Date.now(),
      };

      environment.publishAction(action);

      const state = environment.getGameState();
      expect(state.history).toHaveLength(1);
      expect(state.history[0]).toEqual(action);
    });

    test("emits playerAction event", () => {
      const eventBus = environment.getEventBus();
      const emitSpy = jest.spyOn(eventBus, "emit");

      const action: PlayerAction = {
        playerId: 1,
        roleType: RoleType.Wolf,
        actionType: ActionType.Speak,
        targetId: undefined,
        content: "Test",
        thought: "Test thought",
        timestamp: Date.now(),
      };

      environment.publishAction(action);

      expect(emitSpy).toHaveBeenCalledWith("playerAction", action);
    });
  });

  describe("getVisibleHistory", () => {
    test("returns empty array for non-existent player", () => {
      const history = environment.getVisibleHistory(999);
      expect(history).toEqual([]);
    });

    test("always shows judge actions (playerId = -1)", () => {
      const judgeAction: PlayerAction = {
        playerId: -1,
        roleType: RoleType.Villager,
        actionType: ActionType.Speak,
        targetId: undefined,
        content: "Night falls",
        thought: "",
        timestamp: Date.now(),
      };

      environment.publishAction(judgeAction);

      const history = environment.getVisibleHistory(1);
      expect(history).toHaveLength(1);
      expect(history[0]).toEqual(judgeAction);
    });

    test("always shows player's own actions", () => {
      const ownAction: PlayerAction = {
        playerId: 1,
        roleType: RoleType.Wolf,
        actionType: ActionType.Kill,
        targetId: 2,
        content: "",
        thought: "Killing player 2",
        timestamp: Date.now(),
      };

      environment.publishAction(ownAction);

      const history = environment.getVisibleHistory(1);
      expect(history).toHaveLength(1);
      expect(history[0]).toEqual(ownAction);
    });

    test("always shows speak actions", () => {
      const speakAction: PlayerAction = {
        playerId: 2,
        roleType: RoleType.Villager,
        actionType: ActionType.Speak,
        targetId: undefined,
        content: "I think player 1 is wolf",
        thought: "Accusing player 1",
        timestamp: Date.now(),
      };

      environment.publishAction(speakAction);

      const history = environment.getVisibleHistory(1);
      expect(history).toHaveLength(1);
      expect(history[0]).toEqual(speakAction);
    });

    test("always shows vote actions", () => {
      const voteAction: PlayerAction = {
        playerId: 2,
        roleType: RoleType.Villager,
        actionType: ActionType.Vote,
        targetId: 1,
        content: "",
        thought: "Voting for player 1",
        timestamp: Date.now(),
      };

      environment.publishAction(voteAction);

      const history = environment.getVisibleHistory(1);
      expect(history).toHaveLength(1);
      expect(history[0]).toEqual(voteAction);
    });

    test("wolves can see other wolves' kill actions", () => {
      const wolfKillAction: PlayerAction = {
        playerId: 5, // Another wolf (player 5)
        roleType: RoleType.Wolf,
        actionType: ActionType.Kill,
        targetId: 2,
        content: "",
        thought: "Killing player 2",
        timestamp: Date.now(),
      };

      environment.publishAction(wolfKillAction);

      const wolfHistory = environment.getVisibleHistory(1); // Player 1 is wolf
      expect(wolfHistory).toHaveLength(1);
      expect(wolfHistory[0]).toEqual(wolfKillAction);
    });

    test("villagers cannot see wolves' kill actions", () => {
      const wolfKillAction: PlayerAction = {
        playerId: 1, // Wolf
        roleType: RoleType.Wolf,
        actionType: ActionType.Kill,
        targetId: 2,
        content: "",
        thought: "Killing player 2",
        timestamp: Date.now(),
      };

      environment.publishAction(wolfKillAction);

      const villagerHistory = environment.getVisibleHistory(2); // Player 2 is villager
      expect(villagerHistory).toHaveLength(0); // Should not see kill action
    });

    test("filters actions based on multiple rules", () => {
      // Add multiple actions
      const judgeAction: PlayerAction = {
        playerId: -1,
        roleType: RoleType.Villager,
        actionType: ActionType.Speak,
        targetId: undefined,
        content: "Night falls",
        thought: "",
        timestamp: Date.now(),
      };

      const ownSpeakAction: PlayerAction = {
        playerId: 1,
        roleType: RoleType.Wolf,
        actionType: ActionType.Speak,
        targetId: undefined,
        content: "I'm innocent",
        thought: "Lying",
        timestamp: Date.now(),
      };

      const otherWolfKillAction: PlayerAction = {
        playerId: 5,
        roleType: RoleType.Wolf,
        actionType: ActionType.Kill,
        targetId: 2,
        content: "",
        thought: "Killing",
        timestamp: Date.now(),
      };

      const villagerCheckAction: PlayerAction = {
        playerId: 3,
        roleType: RoleType.Seer,
        actionType: ActionType.Check,
        targetId: 1,
        content: "",
        thought: "Checking player 1",
        timestamp: Date.now(),
      };

      environment.publishAction(judgeAction);
      environment.publishAction(ownSpeakAction);
      environment.publishAction(otherWolfKillAction);
      environment.publishAction(villagerCheckAction);

      // Player 1 (wolf) should see: judge, own speak, other wolf kill
      const wolfHistory = environment.getVisibleHistory(1);
      expect(wolfHistory).toHaveLength(3);

      // Player 2 (villager) should see: judge, own speak (from player 1), but NOT kill or check actions
      const villagerHistory = environment.getVisibleHistory(2);
      expect(villagerHistory).toHaveLength(2);
    });
  });

  describe("getAlivePlayers", () => {
    test("returns only alive players", () => {
      // Mark player 2 as dead
      players[1].isAlive = false;
      environment = new Environment(config, players);

      const alivePlayers = environment.getAlivePlayers();
      expect(alivePlayers).toHaveLength(5);
      expect(alivePlayers.every((p) => p.isAlive)).toBe(true);
    });

    test("returns empty array when all players dead", () => {
      players.forEach((p) => (p.isAlive = false));
      environment = new Environment(config, players);

      const alivePlayers = environment.getAlivePlayers();
      expect(alivePlayers).toHaveLength(0);
    });
  });

  describe("getPlayerById", () => {
    test("returns player by id", () => {
      const player = environment.getPlayerById(1);
      expect(player).toBeDefined();
      expect(player?.id).toBe(1);
      expect(player?.name).toBe("player1");
    });

    test("returns undefined for non-existent player", () => {
      const player = environment.getPlayerById(999);
      expect(player).toBeUndefined();
    });
  });

  describe("markPlayerDead", () => {
    test("marks player as dead", () => {
      const player = environment.getPlayerById(1);
      expect(player?.isAlive).toBe(true);

      environment.markPlayerDead(1);

      expect(player?.isAlive).toBe(false);
    });

    test("adds player to deadPlayerIds", () => {
      environment.markPlayerDead(1);

      const state = environment.getGameState();
      expect(state.deadPlayerIds).toContain(1);
    });

    test("does not duplicate player in deadPlayerIds", () => {
      environment.markPlayerDead(1);
      environment.markPlayerDead(1); // Second call should not duplicate

      const state = environment.getGameState();
      expect(state.deadPlayerIds).toEqual([1]);
    });

    test("emits playerDied event", () => {
      const eventBus = environment.getEventBus();
      const emitSpy = jest.spyOn(eventBus, "emit");

      environment.markPlayerDead(1);

      expect(emitSpy).toHaveBeenCalledWith("playerDied", { playerId: 1 });
    });

    test("does nothing for non-existent player", () => {
      const eventBus = environment.getEventBus();
      const emitSpy = jest.spyOn(eventBus, "emit");

      environment.markPlayerDead(999);

      expect(emitSpy).not.toHaveBeenCalledWith("playerDied", expect.anything());
    });

    test("does nothing for already dead player", () => {
      environment.markPlayerDead(1);

      const eventBus = environment.getEventBus();
      const emitSpy = jest.spyOn(eventBus, "emit");
      emitSpy.mockClear(); // Clear previous call

      environment.markPlayerDead(1); // Already dead

      expect(emitSpy).not.toHaveBeenCalledWith("playerDied", expect.anything());
    });
  });

  describe("broadcast", () => {
    test("emits broadcast event", () => {
      const eventBus = environment.getEventBus();
      const emitSpy = jest.spyOn(eventBus, "emit");

      const event = {
        type: "test" as any,
        data: { test: "data" },
        timestamp: Date.now(),
        gameStateForView: environment.getGameState(),
      };

      environment.broadcast(event);

      expect(emitSpy).toHaveBeenCalledWith("broadcast", event);
    });
  });

  describe("broadcastGameState", () => {
    test("emits PhaseChanged event with game state", () => {
      const eventBus = environment.getEventBus();
      const emitSpy = jest.spyOn(eventBus, "emit");

      environment.broadcastGameState();

      expect(emitSpy).toHaveBeenCalledWith(
        "broadcast",
        expect.objectContaining({
          type: "phase_changed",
          data: expect.objectContaining({
            phase: undefined,
            round: 0,
            gameState: expect.any(Object),
          }),
        }),
      );
    });
  });

  describe("clearHistory", () => {
    test("clears all history", () => {
      // Add some history first
      const action: PlayerAction = {
        playerId: 1,
        roleType: RoleType.Wolf,
        actionType: ActionType.Speak,
        targetId: undefined,
        content: "Test",
        thought: "Test thought",
        timestamp: Date.now(),
      };

      environment.publishAction(action);
      expect(environment.getGameState().history).toHaveLength(1);

      environment.clearHistory();
      expect(environment.getGameState().history).toHaveLength(0);
    });
  });
});
