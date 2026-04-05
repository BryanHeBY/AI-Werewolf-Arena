import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { VillagerRole } from "../../src/roles/VillagerRole";
import {
  GamePhase,
  PlayerAction,
  ModelConfig,
  RoleType,
  Faction,
  ActionType,
} from "../../src/core/types";
import { MockEnvironment } from "../mocks/mockEnvironment";

// Mock fs to avoid actual file system operations
jest.mock("fs", () => ({
  readFileSync: jest.fn().mockReturnValue(
    JSON.stringify({
      systemPrompt: "You are a villager in Werewolf game.",
      roleInformation: "You are a Villager",
      goals: "",
      actions: {},
    }),
  ),
}));

describe("VillagerRole - Public API Tests", () => {
  const playerId = 1;
  const modelConfig: ModelConfig = {
    baseURL: "https://api.example.com",
    apiKey: "test-api-key",
    model: "test-model",
    temperature: 0.7,
    maxTokens: 1024,
  };

  let villager: VillagerRole;
  let mockEnv: MockEnvironment;

  beforeEach(() => {
    villager = new VillagerRole(playerId, modelConfig);
    mockEnv = new MockEnvironment();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Test 1: Basic properties
  describe("basic properties", () => {
    it("has correct role type", () => {
      expect(villager.roleType).toBe(RoleType.Villager);
    });

    it("has correct faction", () => {
      expect(villager.faction).toBe(Faction.Villager);
    });

    it("has player ID", () => {
      expect(villager.playerId).toBe(playerId);
    });

    it("returns system prompt", () => {
      expect(villager.getSystemPrompt()).toBe(
        "You are a villager in Werewolf game.",
      );
    });
  });

  // Test 2: Phase activation
  describe("canActInPhase", () => {
    it("returns true for SequentialSpeech phase", () => {
      expect(villager.canActInPhase(GamePhase.SequentialSpeech)).toBe(true);
    });

    it("returns true for Vote phase", () => {
      expect(villager.canActInPhase(GamePhase.Vote)).toBe(true);
    });

    it("returns false for WolfAction phase", () => {
      expect(villager.canActInPhase(GamePhase.WolfAction)).toBe(false);
    });

    it("returns false for SeerAction phase", () => {
      expect(villager.canActInPhase(GamePhase.SeerAction)).toBe(false);
    });

    it("returns false for WitchAction phase", () => {
      expect(villager.canActInPhase(GamePhase.WitchAction)).toBe(false);
    });
  });

  // Test 3: Observe method
  describe("observe", () => {
    it("successfully observes environment", async () => {
      // Setup mock environment with basic game state
      const mockGameState = {
        phase: GamePhase.SequentialSpeech,
        round: 1,
        players: [
          {
            id: 1,
            name: "Player 1",
            isAlive: true,
            faction: Faction.Villager,
            modelConfig,
            role: {
              roleType: RoleType.Villager,
              faction: Faction.Villager,
              playerId: 1,
              canActInPhase: jest.fn(),
              getSystemPrompt: jest.fn(),
              observe: jest.fn(),
              think: jest.fn(),
              act: jest.fn(),
            } as any,
          },
        ],
        deadPlayerIds: [],
        history: [],
        witchHasAntidote: true,
        witchHasPoison: true,
        currentSpeechIndex: 0,
        phaseStack: [{ phase: GamePhase.SequentialSpeech }],
      };

      jest.spyOn(mockEnv, "getGameState").mockReturnValue(mockGameState);
      jest.spyOn(mockEnv, "getVisibleHistory").mockReturnValue([]);

      await villager.observe(mockEnv as any);

      // The observe method should complete without error
      expect(mockEnv.getGameState).toHaveBeenCalled();
      expect(mockEnv.getVisibleHistory).toHaveBeenCalledWith(playerId);
    });
  });

  // Test 4: Act method with mocked LLM
  describe("act", () => {
    it("returns vote action when LLM responds with vote", async () => {
      // Mock the client.chat method with explicit type
      const mockChat = jest.fn<
        () => Promise<{
          thought: string;
          action: { type: string; targetId: number };
        }>
      >();
      mockChat.mockResolvedValue({
        thought: "I suspect player 3 is a wolf",
        action: { type: "vote", targetId: 3 },
      });

      (villager as any).client = {
        chat: mockChat,
      };
      // Set up observation context
      (villager as any).lastObservation = "Mock observation for villager";
      // Set current phase to Vote so act() doesn't fast-fail
      (villager as any).currentPhase = GamePhase.Vote;

      const action = await villager.act();

      expect(action.playerId).toBe(playerId);
      expect(action.roleType).toBe(RoleType.Villager);
      expect(action.actionType).toBe(ActionType.Vote);
      expect(action.targetId).toBe(3);
      expect(typeof action.thought).toBe("string");
      expect(typeof action.timestamp).toBe("number");
    });

    it("returns speak action when LLM responds with speak", async () => {
      // Mock the client.chat method with explicit type
      const mockChat = jest.fn<
        () => Promise<{
          thought: string;
          action: { type: string; content: string };
        }>
      >();
      mockChat.mockResolvedValue({
        thought: "I will share my suspicions",
        action: { type: "speak", content: "I think player 3 is suspicious" },
      });

      (villager as any).client = {
        chat: mockChat,
      };
      // Set up observation context
      (villager as any).lastObservation = "Mock observation for villager";
      // Set current phase to SequentialSpeech so act() doesn't fast-fail
      (villager as any).currentPhase = GamePhase.SequentialSpeech;

      const action = await villager.act();

      expect(action.playerId).toBe(playerId);
      expect(action.roleType).toBe(RoleType.Villager);
      expect(action.actionType).toBe(ActionType.Speak);
      expect(action.content).toContain("I think player 3 is suspicious");
      expect(typeof action.thought).toBe("string");
      expect(typeof action.timestamp).toBe("number");
    });

    it("returns no_action when not in valid phase", async () => {
      const action = await villager.act();

      // By default, if no observation has been made, act should return no_action
      expect(action.actionType).toBe(ActionType.NoAction);
    }, 30000); // Increased timeout
  });

  // Test 5: Think method
  describe("think", () => {
    it("returns thought from LLM", async () => {
      // First need to set up lastThought
      (villager as any).lastThought = "I suspect player 3 is a wolf";

      const thought = await villager.think();

      expect(thought).toBe("I suspect player 3 is a wolf");
    });

    it("returns empty string when no thought", async () => {
      (villager as any).lastThought = "";

      const thought = await villager.think();

      expect(thought).toBe("");
    });
  });
});
