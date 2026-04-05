import { GameEngineV2 } from "../../src/core/GameEngineV2";
import { GameLogger } from "../../src/logger/GameLogger";
import { Broadcaster } from "../../src/broadcaster/Broadcaster";
import { GameFactory } from "../../src/core/GameFactory";
import { appConfig } from "../../src/config";
import { GamePhase } from "../../src/core/types";

describe("Backend API Integration Tests", () => {
  test("V2 backend should be compatible with server API", () => {
    const mockIo = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };

    const broadcaster = new Broadcaster(mockIo as any);
    const logger = new GameLogger(appConfig.gameRecordsDir);
    const factory = new GameFactory(
      appConfig.gameConfig,
      appConfig.modelDefaults,
    );

    const players = factory.createPlayers();

    const engine = new GameEngineV2(
      appConfig.gameConfig,
      players,
      logger,
      broadcaster,
    );

    expect(engine).toBeInstanceOf(GameEngineV2);

    const gameState = engine.exportGameState();

    expect(gameState).toHaveProperty("phase");
    expect(gameState).toHaveProperty("players");
    expect(gameState).toHaveProperty("phaseStack");

    expect(gameState.phase).toBe(GamePhase.NightStart);
    expect(Array.isArray(gameState.players)).toBe(true);
    expect(Array.isArray(gameState.phaseStack)).toBe(true);
  });

  test("Server can start V2 game engine", () => {
    const mockIo = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };

    const broadcaster = new Broadcaster(mockIo as any);
    const logger = new GameLogger(appConfig.gameRecordsDir);
    const factory = new GameFactory(
      appConfig.gameConfig,
      appConfig.modelDefaults,
    );

    const players = factory.createPlayers();

    const engine = new GameEngineV2(
      appConfig.gameConfig,
      players,
      logger,
      broadcaster,
    );

    const gameState = engine.exportGameState();

    expect(gameState.players).toHaveLength(players.length);

    players.forEach((player, index) => {
      expect(gameState.players[index].id).toBe(player.id);
      expect(gameState.players[index].name).toBe(player.name);
    });
  });

  test("V2 architecture provides phase stack feature", () => {
    const mockIo = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };

    const broadcaster = new Broadcaster(mockIo as any);
    const logger = new GameLogger(appConfig.gameRecordsDir);
    const factory = new GameFactory(
      appConfig.gameConfig,
      appConfig.modelDefaults,
    );

    const players = factory.createPlayers();

    const engine = new GameEngineV2(
      appConfig.gameConfig,
      players,
      logger,
      broadcaster,
    );

    const gameState = engine.exportGameState();

    expect(gameState.phaseStack).toBeDefined();
    expect(Array.isArray(gameState.phaseStack)).toBe(true);

    if (gameState.phaseStack.length > 0) {
      expect(gameState.phaseStack[0]).toHaveProperty("phase");
      expect(gameState.phaseStack[0].phase).toBe(GamePhase.NightStart);
    }
  });
});
