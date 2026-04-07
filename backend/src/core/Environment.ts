import {
  GameState,
  PlayerAction,
  EnvironmentInterface,
  GameConfig,
  ModelConfig,
  Player,
  BroadcastEvent,
  BroadcastEventType,
  ActionType,
  PublicGameState,
  PublicPlayer,
  Faction,
  RoleType,
  World,
  IdentityComponent,
  StatusComponent,
} from "./types";
import { EventBus } from "./EventBus";

export class Environment implements EnvironmentInterface {
  private gameState: GameState;
  private eventBus: EventBus;
  private gameConfig: GameConfig;
  private world: World | null;
  private modelDefaults: ModelConfig;

  constructor(config: GameConfig, world: World) {
    this.gameConfig = config;
    this.modelDefaults = config.modelDefaults;
    this.eventBus = new EventBus();
    this.world = world;

    this.gameState = {
      phase: undefined as any,
      round: 0,
      players: [], // 初始为空，getGameState()会动态从World查询
      deadPlayerIds: [],
      history: [],
      witchHasAntidote: true,
      witchHasPoison: true,
      currentSpeechIndex: 0,
      phaseStack: [],
    };
  }

  getGameState(): GameState {
    // 从ECS World动态查询玩家信息
    const playersFromECS: Player[] = [];

    if (this.world) {
      const entities = this.world.query<{
        IdentityComponent: IdentityComponent;
        StatusComponent: StatusComponent;
      }>("IdentityComponent", "StatusComponent");

      entities.forEach((e: any) => {
        const identity = e.IdentityComponent;
        const status = e.StatusComponent;

        playersFromECS.push({
          id: identity.entityId,
          name: identity.name,
          isAlive: status.isAlive,
          isSheriff: status.isSheriff || false, // 添加警长状态
          faction: identity.faction,
          modelConfig: this.modelDefaults,
        });
      });
    }

    return {
      ...this.gameState,
      players: playersFromECS, // 动态填充玩家信息
    };
  }

  /**
   * Get clean public game state without sensitive data or circular references
   */
  getPublicGameState(): PublicGameState {
    const publicPlayers: PublicPlayer[] = [];

    // 从ECS World查询所有实体
    if (this.world) {
      const entities = this.world.query<{
        IdentityComponent: IdentityComponent;
        StatusComponent: StatusComponent;
      }>("IdentityComponent", "StatusComponent");

      entities.forEach((e: any) => {
        const identity = e.IdentityComponent;
        const status = e.StatusComponent;

        publicPlayers.push({
          id: identity.entityId,
          name: identity.name,
          roleType: identity.roleType,
          faction: identity.faction,
          isAlive: status.isAlive,
        });
      });
    }

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
    // 从ECS World查询玩家信息
    let faction: Faction | null = null;
    if (this.world) {
      const identity = this.world.getComponent<IdentityComponent>(
        playerId,
        "IdentityComponent",
      );
      if (!identity) {
        // 玩家不存在于ECS World中
        return [];
      }
      faction = identity.faction;
    } else {
      // 没有World，无法确定玩家阵营
      return [];
    }

    const visibleHistory: PlayerAction[] = [];

    for (const action of this.gameState.history) {
      const shouldShow = this.shouldShowAction(action, playerId, faction);
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
    const alivePlayers: Player[] = [];

    if (this.world) {
      const entities = this.world.query<{
        IdentityComponent: IdentityComponent;
        StatusComponent: StatusComponent;
      }>("IdentityComponent", "StatusComponent");

      entities.forEach((e: any) => {
        const identity = e.IdentityComponent;
        const status = e.StatusComponent;

        if (status.isAlive) {
          alivePlayers.push({
            id: identity.entityId,
            name: identity.name,
            isAlive: true,
            faction: identity.faction,
            modelConfig: this.modelDefaults,
          });
        }
      });
    }

    return alivePlayers;
  }

  getPlayerById(id: number): Player | undefined {
    if (!this.world) return undefined;

    const identity = this.world.getComponent<IdentityComponent>(
      id,
      "IdentityComponent",
    );
    const status = this.world.getComponent<StatusComponent>(
      id,
      "StatusComponent",
    );

    if (!identity || !status) return undefined;

    return {
      id: identity.entityId,
      name: identity.name,
      isAlive: status.isAlive,
      faction: identity.faction,
      modelConfig: this.modelDefaults,
    };
  }

  markPlayerDead(playerId: number): void {
    if (!this.world) return;

    const status = this.world.getComponent<StatusComponent>(
      playerId,
      "StatusComponent",
    );
    if (status && status.isAlive) {
      status.isAlive = false;

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
