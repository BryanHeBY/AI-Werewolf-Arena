import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { SeerRole } from "../../src/roles/SeerRole";
import {
  GamePhase,
  PlayerAction,
  ModelConfig,
  RoleType,
  Faction,
  ActionType,
  GameState,
} from "../../src/core/types";
import { MockEnvironment } from "../mocks/mockEnvironment";

// Mock fs to avoid actual file system operations
jest.mock("fs", () => ({
  readFileSync: jest.fn().mockReturnValue(
    JSON.stringify({
      systemPrompt: "You are a seer in Werewolf game.",
      roleInformation: "You are a Seer",
      goals: "",
      actions: {},
    }),
  ),
}));

describe("SeerRole - Public API Tests", () => {
  const playerId = 2;
  const modelConfig: ModelConfig = {
    baseURL: "https://api.example.com",
    apiKey: "test-api-key",
    model: "test-model",
    temperature: 0.7,
    maxTokens: 1024,
  };

  let seer: SeerRole;
  let mockEnv: MockEnvironment;

  beforeEach(() => {
    seer = new SeerRole(playerId, modelConfig);
    mockEnv = new MockEnvironment();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Test 1: Basic properties
  describe("basic properties", () => {
    it("has correct role type", () => {
      expect(seer.roleType).toBe(RoleType.Seer);
    });

    it("has correct faction", () => {
      expect(seer.faction).toBe(Faction.Villager);
    });

    it("has player ID", () => {
      expect(seer.playerId).toBe(playerId);
    });

    it("returns system prompt", () => {
      expect(seer.getSystemPrompt()).toBe("You are a seer in Werewolf game.");
    });
  });

  // Test 2: Phase activation
  describe("canActInPhase", () => {
    it("returns true for SeerAction phase", () => {
      expect(seer.canActInPhase(GamePhase.SeerAction)).toBe(true);
    });

    it("returns true for SequentialSpeech phase", () => {
      expect(seer.canActInPhase(GamePhase.SequentialSpeech)).toBe(true);
    });

    it("returns true for Vote phase", () => {
      expect(seer.canActInPhase(GamePhase.Vote)).toBe(true);
    });

    it("returns false for WolfAction phase", () => {
      expect(seer.canActInPhase(GamePhase.WolfAction)).toBe(false);
    });

    it("returns false for WitchAction phase", () => {
      expect(seer.canActInPhase(GamePhase.WitchAction)).toBe(false);
    });
  });

  // Test 3: Observe method
  describe("observe", () => {
    it("successfully observes environment in SeerAction phase", async () => {
      // Setup mock environment with SeerAction phase
      const mockGameState: GameState = {
        phase: GamePhase.SeerAction,
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
              roleType: RoleType.Seer,
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
        witchHasAntidote: true,
        witchHasPoison: true,
        currentSpeechIndex: 0,
        phaseStack: [{ phase: GamePhase.SeerAction }],
      };

      jest.spyOn(mockEnv, "getGameState").mockReturnValue(mockGameState);
      jest.spyOn(mockEnv, "getVisibleHistory").mockReturnValue([]);

      await seer.observe(mockEnv as any);

      expect(mockEnv.getGameState).toHaveBeenCalled();
      expect(mockEnv.getVisibleHistory).toHaveBeenCalledWith(playerId);
    });
  });

  // Test 4: Act method with mocked LLM - Seer actions
  describe("act", () => {
    it("returns check action when LLM responds with verify", async () => {
      // Mock the client.chat method with explicit type
      const mockChat = jest.fn<
        () => Promise<{
          thought: string;
          action: { type: string; targetId: number };
        }>
      >();
      mockChat.mockResolvedValue({
        thought: "I will check player 1 to see if they are a wolf",
        action: { type: "check", targetId: 1 },
      });

      (seer as any).client = {
        chat: mockChat,
      };

      // Set up observation context
      (seer as any).lastObservation = "Mock observation for seer";
      // Set current phase to SeerAction so act() doesn't fast-fail
      (seer as any).currentPhase = GamePhase.SeerAction;

      const action = await seer.act();

      expect(action.playerId).toBe(playerId);
      expect(action.roleType).toBe(RoleType.Seer);
      expect(action.actionType).toBe(ActionType.Check);
      expect(action.targetId).toBe(1);
      expect(typeof action.thought).toBe("string");
      expect(typeof action.timestamp).toBe("number");
    });

    it("returns no_action when not in valid phase", async () => {
      const action = await seer.act();

      // By default, if no observation has been made, act should return no_action
      expect(action.actionType).toBe(ActionType.NoAction);
    }, 30000); // Increased timeout
  });

  // Test 5: Think method
  describe("think", () => {
    it("returns thought from LLM", async () => {
      // First need to set up lastThought
      (seer as any).lastThought =
        "I suspect player 1 is a wolf and will check them";

      const thought = await seer.think();

      expect(thought).toBe("I suspect player 1 is a wolf and will check them");
    });

    it("returns empty string when no thought", async () => {
      (seer as any).lastThought = "";

      const thought = await seer.think();

      expect(thought).toBe("");
    });
  });
});
