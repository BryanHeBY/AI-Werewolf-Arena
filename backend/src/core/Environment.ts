import {
  GameState,
  PlayerAction,
  EnvironmentInterface,
  GameConfig,
  Player,
  BroadcastEvent,
  BroadcastEventType,
  ActionType,
  PublicGameState,
  PublicPlayer,
  Faction,
  RoleType,
} from "./types";
import { EventBus } from "./EventBus";

export class Environment implements EnvironmentInterface {
  private gameState: GameState;
  private eventBus: EventBus;
  private gameConfig: GameConfig;

  constructor(config: GameConfig, players: Player[]) {
    this.gameConfig = config;
    this.eventBus = new EventBus();

    this.gameState = {
      phase: undefined as any,
      round: 0,
      players,
      deadPlayerIds: [],
      history: [],
      witchHasAntidote: true,
      witchHasPoison: true,
      currentSpeechIndex: 0,
      phaseStack: [],
    };
  }

  getGameState(): GameState {
    return { ...this.gameState };
  }

  /**
   * Get clean public game state without sensitive data or circular references
   */
  getPublicGameState(): PublicGameState {
    const publicPlayers: PublicPlayer[] = this.gameState.players.map(
      (player) => ({
        id: player.id,
        name: player.name,
        roleType: player.role.roleType,
        faction: player.faction,
        isAlive: player.isAlive,
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

  setGameState(newState: Partial<GameState>): void {
    this.gameState = { ...this.gameState, ...newState };
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

  getVisibleHistory(playerId: number): PlayerAction[] {
    const player = this.gameState.players.find((p) => p.id === playerId);
    if (!player) return [];

    const visibleHistory: PlayerAction[] = [];

    for (const action of this.gameState.history) {
      const shouldShow = this.shouldShowAction(
        action,
        playerId,
        player.role.faction,
      );
      if (shouldShow) {
        visibleHistory.push(action);
      }
    }

    return visibleHistory;
  }

  private shouldShowAction(
    action: PlayerAction,
    observerId: number,
    observerFaction: Faction,
  ): boolean {
    if (action.playerId === -1) {
      return true;
    }

    if (action.playerId === observerId) {
      return true;
    }

    if (
      action.actionType === ActionType.Speak ||
      action.actionType === ActionType.Vote
    ) {
      return true;
    }

    if (
      observerFaction === Faction.Wolf &&
      action.roleType === RoleType.Wolf &&
      action.actionType === ActionType.Kill
    ) {
      return true;
    }

    return false;
  }

  getAlivePlayers(): Player[] {
    return this.gameState.players.filter((p) => p.isAlive);
  }

  getPlayerById(id: number): Player | undefined {
    return this.gameState.players.find((p) => p.id === id);
  }

  markPlayerDead(playerId: number): void {
    const player = this.getPlayerById(playerId);
    if (player && player.isAlive) {
      player.isAlive = false;
      if (!this.gameState.deadPlayerIds.includes(playerId)) {
        this.gameState.deadPlayerIds.push(playerId);
      }
      this.eventBus.emit("playerDied", { playerId });
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

  clearHistory(): void {
    this.gameState.history = [];
  }
}
