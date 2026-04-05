import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { WitchRole } from "../../src/roles/WitchRole";
import {
  GamePhase,
  PlayerAction,
  ModelConfig,
  RoleType,
  Faction,
  ActionType,
  GameState,
  NightResult,
} from "../../src/core/types";
import { MockEnvironment } from "../mocks/mockEnvironment";

// Mock fs to avoid actual file system operations
jest.mock("fs", () => ({
  readFileSync: jest.fn().mockReturnValue(
    JSON.stringify({
      systemPrompt: "You are a witch in Werewolf game.",
      roleInformation: "You are a Witch",
      goals: "",
      actions: {},
    }),
  ),
}));

describe("WitchRole - Public API Tests", () => {
  const playerId = 3;
  const modelConfig: ModelConfig = {
    baseURL: "https://api.example.com",
    apiKey: "test-api-key",
    model: "test-model",
    temperature: 0.7,
    maxTokens: 1024,
  };

  let witch: WitchRole;
  let mockEnv: MockEnvironment;

  beforeEach(() => {
    witch = new WitchRole(playerId, modelConfig);
    mockEnv = new MockEnvironment();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Test 1: Basic properties
  describe("basic properties", () => {
    it("has correct role type", () => {
      expect(witch.roleType).toBe(RoleType.Witch);
    });

    it("has correct faction", () => {
      expect(witch.faction).toBe(Faction.Villager);
    });

    it("has player ID", () => {
      expect(witch.playerId).toBe(playerId);
    });

    it("returns system prompt", () => {
      expect(witch.getSystemPrompt()).toBe("You are a witch in Werewolf game.");
    });
  });

  // Test 2: Phase activation
  describe("canActInPhase", () => {
    it("returns true for WitchAction phase", () => {
      expect(witch.canActInPhase(GamePhase.WitchAction)).toBe(true);
    });

    it("returns true for SequentialSpeech phase", () => {
      expect(witch.canActInPhase(GamePhase.SequentialSpeech)).toBe(true);
    });

    it("returns true for Vote phase", () => {
      expect(witch.canActInPhase(GamePhase.Vote)).toBe(true);
    });

    it("returns false for WolfAction phase", () => {
      expect(witch.canActInPhase(GamePhase.WolfAction)).toBe(false);
    });

    it("returns false for SeerAction phase", () => {
      expect(witch.canActInPhase(GamePhase.SeerAction)).toBe(false);
    });
  });

  // Test 3: Observe method
  describe("observe", () => {
    it("successfully observes environment in WitchAction phase", async () => {
      // Setup mock environment with WitchAction phase
      const mockGameState: GameState = {
        phase: GamePhase.WitchAction,
        round: 1,
        players: [
          {
            id: 1,
            name: "Player 1",
            role: {
              roleType: RoleType.Wolf,
              faction: Faction.Wolf,
              playerId: 1,
              canActInPhase: jest.fn(),
              getSystemPrompt: jest.fn(),
              observe: jest.fn(),
              think: jest.fn(),
              act: jest.fn(),
            } as any,
            isAlive: true,
            faction: Faction.Wolf,
            modelConfig,
          },
          {
            id: 2,
            name: "Player 2",
            role: {
              roleType: RoleType.Villager,
              faction: Faction.Villager,
              playerId: 2,
              canActInPhase: jest.fn(),
              getSystemPrompt: jest.fn(),
              observe: jest.fn(),
              think: jest.fn(),
              act: jest.fn(),
            } as any,
            isAlive: true,
            faction: Faction.Villager,
            modelConfig,
          },
        ],
        deadPlayerIds: [],
        history: [],
        nightResult: {
          killedByWolf: 2,
          deadPlayerIds: [],
        } as NightResult,
        witchHasAntidote: true,
        witchHasPoison: true,
        currentSpeechIndex: 0,
        phaseStack: [{ phase: GamePhase.WitchAction }],
      };

      jest.spyOn(mockEnv, "getGameState").mockReturnValue(mockGameState);
      jest.spyOn(mockEnv, "getVisibleHistory").mockReturnValue([]);

      await witch.observe(mockEnv as any);

      expect(mockEnv.getGameState).toHaveBeenCalled();
      expect(mockEnv.getVisibleHistory).toHaveBeenCalledWith(playerId);
    });
  });

  // Test 4: Act method with mocked LLM - Witch actions
  describe("act", () => {
    it("returns save action when LLM responds with save", async () => {
      // Mock the client.chat method with explicit type
      const mockChat = jest.fn<
        () => Promise<{
          thought: string;
          action: { type: string; targetId: number };
        }>
      >();
      mockChat.mockResolvedValue({
        thought: "I will save player 2 who was killed by wolves",
        action: { type: "save", targetId: 2 },
      });

      (witch as any).client = {
        chat: mockChat,
      };

      // Set up observation context
      (witch as any).lastObservation = "Mock observation for witch";
      // Set current phase to WitchAction so act() doesn't fast-fail
      (witch as any).currentPhase = GamePhase.WitchAction;

      const action = await witch.act();

      expect(action.playerId).toBe(playerId);
      expect(action.roleType).toBe(RoleType.Witch);
      expect(action.actionType).toBe(ActionType.Save);
      expect(action.targetId).toBe(2);
      expect(typeof action.thought).toBe("string");
      expect(typeof action.timestamp).toBe("number");
    });

    it("returns poison action when LLM responds with poison", async () => {
      const mockChat = jest.fn<
        () => Promise<{
          thought: string;
          action: { type: string; targetId: number };
        }>
      >();
      mockChat.mockResolvedValue({
        thought: "I suspect player 1 is a wolf, I will poison them",
        action: { type: "poison", targetId: 1 },
      });

      (witch as any).client = {
        chat: mockChat,
      };

      // Set up observation context
      (witch as any).lastObservation = "Mock observation for witch";
      // Set current phase to WitchAction so act() doesn't fast-fail
      (witch as any).currentPhase = GamePhase.WitchAction;

      const action = await witch.act();

      expect(action.playerId).toBe(playerId);
      expect(action.roleType).toBe(RoleType.Witch);
      expect(action.actionType).toBe(ActionType.Poison);
      expect(action.targetId).toBe(1);
      expect(typeof action.thought).toBe("string");
      expect(typeof action.timestamp).toBe("number");
    });

    it("returns no_action when not in valid phase", async () => {
      const action = await witch.act();

      // By default, if no observation has been made, act should return no_action
      expect(action.actionType).toBe(ActionType.NoAction);
    }, 30000); // Increased timeout
  });

  // Test 5: Think method
  describe("think", () => {
    it("returns thought from LLM", async () => {
      // First need to set up lastThought
      (witch as any).lastThought =
        "I suspect player 1 is a wolf and will poison them";

      const thought = await witch.think();

      expect(thought).toBe("I suspect player 1 is a wolf and will poison them");
    });

    it("returns empty string when no thought", async () => {
      (witch as any).lastThought = "";

      const thought = await witch.think();

      expect(thought).toBe("");
    });
  });
});
