import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { WolfRole } from "../../src/roles/WolfRole";
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
      systemPrompt: "You are a wolf in Werewolf game.",
      roleInformation: "You are a Wolf",
      goals: "",
      actions: {},
    }),
  ),
}));

describe("WolfRole - Public API Tests", () => {
  const playerId = 1;
  const modelConfig: ModelConfig = {
    baseURL: "https://api.example.com",
    apiKey: "test-api-key",
    model: "test-model",
    temperature: 0.7,
    maxTokens: 1024,
  };

  let wolf: WolfRole;
  let mockEnv: MockEnvironment;

  beforeEach(() => {
    wolf = new WolfRole(playerId, modelConfig);
    mockEnv = new MockEnvironment();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Test 1: Basic properties
  describe("basic properties", () => {
    it("has correct role type", () => {
      expect(wolf.roleType).toBe(RoleType.Wolf);
    });

    it("has correct faction", () => {
      expect(wolf.faction).toBe(Faction.Wolf);
    });

    it("has player ID", () => {
      expect(wolf.playerId).toBe(playerId);
    });

    it("returns system prompt", () => {
      expect(wolf.getSystemPrompt()).toBe("You are a wolf in Werewolf game.");
    });
  });

  // Test 2: Phase activation
  describe("canActInPhase", () => {
    it("returns true for WolfAction phase", () => {
      expect(wolf.canActInPhase(GamePhase.WolfAction)).toBe(true);
    });

    it("returns true for SequentialSpeech phase", () => {
      expect(wolf.canActInPhase(GamePhase.SequentialSpeech)).toBe(true);
    });

    it("returns true for Vote phase", () => {
      expect(wolf.canActInPhase(GamePhase.Vote)).toBe(true);
    });

    it("returns false for SeerAction phase", () => {
      expect(wolf.canActInPhase(GamePhase.SeerAction)).toBe(false);
    });

    it("returns false for WitchAction phase", () => {
      expect(wolf.canActInPhase(GamePhase.WitchAction)).toBe(false);
    });
  });

  // Test 3: Observe method
  describe("observe", () => {
    it("successfully observes environment in WolfAction phase", async () => {
      // Setup mock environment with WolfAction phase
      const mockGameState: GameState = {
        phase: GamePhase.WolfAction,
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
        witchHasAntidote: true,
        witchHasPoison: true,
        currentSpeechIndex: 0,
        phaseStack: [{ phase: GamePhase.WolfAction }],
      };

      jest.spyOn(mockEnv, "getGameState").mockReturnValue(mockGameState);
      jest.spyOn(mockEnv, "getVisibleHistory").mockReturnValue([]);

      await wolf.observe(mockEnv as any);

      expect(mockEnv.getGameState).toHaveBeenCalled();
      expect(mockEnv.getVisibleHistory).toHaveBeenCalledWith(playerId);
    });
  });

  // Test 4: Act method with mocked LLM - Wolf actions
  describe("act", () => {
    it("returns kill action when LLM responds with kill", async () => {
      // Mock the client.chat method with explicit type
      const mockChat = jest.fn<
        () => Promise<{
          thought: string;
          action: { type: string; targetId: number };
        }>
      >();
      mockChat.mockResolvedValue({
        thought: "I will kill player 2 who seems suspicious",
        action: { type: "kill", targetId: 2 },
      });

      (wolf as any).client = {
        chat: mockChat,
      };

      // Set up observation context
      (wolf as any).lastObservation = "Mock observation for wolf";
      // Set current phase to WolfAction so act() doesn't fast-fail
      (wolf as any).currentPhase = GamePhase.WolfAction;

      const action = await wolf.act();

      expect(action.playerId).toBe(playerId);
      expect(action.roleType).toBe(RoleType.Wolf);
      expect(action.actionType).toBe(ActionType.Kill);
      expect(action.targetId).toBe(2);
      expect(typeof action.thought).toBe("string");
      expect(typeof action.timestamp).toBe("number");
    });

    it("returns no_action when not in valid phase", async () => {
      const action = await wolf.act();

      // By default, if no observation has been made, act should return no_action
      expect(action.actionType).toBe(ActionType.NoAction);
    }, 30000); // Increased timeout
  });

  // Test 5: Think method
  describe("think", () => {
    it("returns thought from LLM", async () => {
      // First need to set up lastThought
      (wolf as any).lastThought =
        "I will kill player 2 who seems like a threat";

      const thought = await wolf.think();

      expect(thought).toBe("I will kill player 2 who seems like a threat");
    });

    it("returns empty string when no thought", async () => {
      (wolf as any).lastThought = "";

      const thought = await wolf.think();

      expect(thought).toBe("");
    });
  });
});
