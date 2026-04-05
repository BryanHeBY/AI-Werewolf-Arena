import {
  GameState,
  Player,
  GamePhase,
  NightResult,
  PlayerAction,
  GameConfig,
  BroadcastEvent,
  PublicGameState,
  PublicPlayer,
  RoleType,
  Faction,
  ActionType,
  BroadcastEventType,
} from "../../src/core/types";
import { EventBus } from "../../src/core/EventBus";

export class MockEnvironment {
  private gameState: GameState;
  private eventBus: EventBus;
  private gameConfig: GameConfig;
  private broadcastCallback: (event: any) => void = () => {};

  constructor(initialState?: Partial<GameState>, config?: Partial<GameConfig>) {
    this.eventBus = new EventBus();
    this.gameConfig = {
      totalPlayers: 6,
      wolfCount: 2,
      villagerCount: 2,
      seerCount: 1,
      witchCount: 1,
      modelDefaults: {
        baseURL: "http://test.local",
        apiKey: "test-key",
        model: "gpt-4",
        temperature: 0.7,
        maxTokens: 1024,
      },

      ...config,
    };

    this.gameState = {
      phase: GamePhase.NightStart,
      round: 1,
      players: [],
      deadPlayerIds: [],
      history: [],
      witchHasAntidote: true,
      witchHasPoison: true,
      currentSpeechIndex: 0,
      phaseStack: [{ phase: GamePhase.NightStart }],
      ...initialState,
    };
  }

  getGameState(): GameState {
    return { ...this.gameState };
  }

  getPublicGameState(): PublicGameState {
    const publicPlayers: PublicPlayer[] = this.gameState.players.map(
      (player) => ({
        id: player.id,
        name: player.name,
        roleType: player.role?.roleType,
        faction: player.faction,
        isAlive: !this.gameState.deadPlayerIds.includes(player.id),
      }),
    );

    return {
      phase: this.gameState.phase,
      round: this.gameState.round,
      players: publicPlayers,
      deadPlayerIds: this.gameState.deadPlayerIds,
      history: this.gameState.history,
      nightResult: this.gameState.nightResult,
      votedDeadId: this.gameState.votedDeadId,
      winner: this.gameState.winner,
      witchHasAntidote: this.gameState.witchHasAntidote,
      witchHasPoison: this.gameState.witchHasPoison,
      currentSpeechIndex: this.gameState.currentSpeechIndex,
      phaseStack: this.gameState.phaseStack,
    };
  }

  setGameState(state: GameState): void {
    this.gameState = { ...state };
    this.eventBus.emit("stateChanged", this.getGameState());
  }

  getEventBus(): EventBus {
    return this.eventBus;
  }

  getGameConfig(): GameConfig {
    return { ...this.gameConfig };
  }

  publishAction(action: PlayerAction): void {
    this.gameState.history.push(action);
    this.eventBus.emit("playerAction", action);
  }

  getVisibleHistory(viewerId: number): PlayerAction[] {
    return [...this.gameState.history];
  }

  getVisibleHistoryForPlayer(playerId: number): PlayerAction[] {
    return this.getVisibleHistory(playerId);
  }

  private shouldShowAction(action: PlayerAction, viewerId: number): boolean {
    return true;
  }

  getVisiblePlayerInfo(viewerId: number): any[] {
    return this.gameState.players.map((player) => ({
      id: player.id,
      name: player.name,
      roleType: player.role?.roleType,
      faction: player.faction,
      isAlive: !this.gameState.deadPlayerIds.includes(player.id),
    }));
  }

  getAlivePlayers(): Player[] {
    return this.gameState.players.filter(
      (player) => !this.gameState.deadPlayerIds.includes(player.id),
    );
  }

  getPlayerById(id: number): Player | undefined {
    return this.gameState.players.find((player) => player.id === id);
  }

  markPlayerDead(playerId: number): void {
    if (!this.gameState.deadPlayerIds.includes(playerId)) {
      this.gameState.deadPlayerIds.push(playerId);
    }
  }

  broadcast(event: BroadcastEvent): void {
    this.eventBus.emit("broadcast", event);
  }

  broadcastGameState(): void {
    this.broadcast({
      type: BroadcastEventType.PhaseChanged,
      data: {
        phase: this.gameState.phase,
        round: this.gameState.round,
        gameState: this.getPublicGameState(),
      },
      timestamp: Date.now(),
      gameStateForView: this.gameState,
    });
  }

  addPlayer(player: Player): void {
    this.gameState.players.push(player);
  }

  setNightResult(result: NightResult): void {
    this.gameState.nightResult = result;
  }

  getPhaseStack(): any[] {
    return [...this.gameState.phaseStack];
  }

  setPhaseStack(stack: any[]): void {
    this.gameState.phaseStack = [...stack];
  }

  clearHistory(): void {
    this.gameState.history = [];
  }
}

// We can't create proper Role instances here without importing role classes
// This function should be updated to use createSimplePlayer from testData.ts
// For now, we'll comment it out since it's causing type errors
/*
export function createMockPlayers(count: number = 6): Player[] {
  const players: Player[] = [];
  const roles: RoleType[] = [
    RoleType.Wolf,
    RoleType.Wolf,
    RoleType.Seer,
    RoleType.Witch,
    RoleType.Villager,
    RoleType.Villager,
  ];

  for (let i = 0; i < count; i++) {
    const role = roles[i % roles.length];
    const faction = role === RoleType.Wolf ? Faction.Wolf : Faction.Villager;

    players.push({
      id: i + 1,
      name: `Player ${i + 1}`,
      roleType: role,
      faction: faction,
      modelConfig: {
        baseURL: "http://test.local",
        apiKey: "test-key",
        model: "gpt-4",
        temperature: 0.7,
        maxTokens: 1024,
      },
    });
  }

  return players;
}
*/

import { createSimplePlayer } from "./testData";

export function createMockGameState(
  overrides: Partial<GameState> = {},
): GameState {
  const players = [
    createSimplePlayer(1, RoleType.Wolf),
    createSimplePlayer(2, RoleType.Wolf),
    createSimplePlayer(3, RoleType.Seer),
    createSimplePlayer(4, RoleType.Witch),
    createSimplePlayer(5, RoleType.Villager),
    createSimplePlayer(6, RoleType.Villager),
  ];

  const baseState: GameState = {
    phase: GamePhase.NightStart,
    round: 1,
    players,
    deadPlayerIds: [],
    history: [],
    witchHasAntidote: true,
    witchHasPoison: true,
    currentSpeechIndex: 0,
    phaseStack: [{ phase: GamePhase.NightStart }],
  };

  return { ...baseState, ...overrides };
}
