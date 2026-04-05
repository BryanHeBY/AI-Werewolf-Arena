import {
  GameState,
  PublicGameState,
  PublicPlayer,
  Player,
  RoleType,
  Faction,
  PlayerAction,
  ChatMessage,
  BroadcastEvent,
  World,
  IdentityComponent,
} from "./types";

/**
 * ViewSanitizer - 视角隔离系统
 *
 * 提供铁桶般的视角隔离，确保：
 * - 上帝视角 (viewId === 0) 可以看到所有信息
 * - 玩家自己可以看到自己的完整信息
 * - 存活狼人可以看到其他存活狼人的完整信息
 * - 其他情况下，roleType 和 faction 必须设为 undefined
 */
export class ViewSanitizer {
  private world: World | null;

  constructor(world?: World) {
    this.world = world || null;
  }
  /**
   * 判断查看者是否能看到目标玩家的完整信息
   */
  canSeePlayerRole(
    targetPlayer: Player,
    viewerId: number,
    viewerRole?: RoleType,
    allPlayers?: Player[],
  ): boolean {
    // 上帝视角
    if (viewerId === 0) {
      return true;
    }

    // 玩家自己
    if (targetPlayer.id === viewerId) {
      return true;
    }

    // 存活狼人可以看到其他存活狼人
    if (viewerRole === RoleType.Wolf && allPlayers) {
      const viewer = allPlayers.find((p) => p.id === viewerId);
      if (viewer && viewer.isAlive && targetPlayer.isAlive) {
        // 从 ECS World 获取目标玩家的角色信息
        if (this.world) {
          const targetIdentity = this.world.getComponent<IdentityComponent>(
            targetPlayer.id,
            "IdentityComponent",
          );
          if (targetIdentity?.roleType === RoleType.Wolf) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * 判断查看者是否能看到 privateThought
   */
  canSeePrivateThought(message: ChatMessage, viewerId: number): boolean {
    // 上帝视角
    if (viewerId === 0) {
      return true;
    }

    // 消息发送者自己
    if (message.playerId !== undefined && message.playerId === viewerId) {
      return true;
    }

    return false;
  }

  /**
   * 视角隔离单个玩家信息
   */
  sanitizePlayerInfoForViewer(
    player: Player,
    viewerId: number,
    viewerRole?: RoleType,
    allPlayers?: Player[],
  ): PublicPlayer {
    const canSee = this.canSeePlayerRole(
      player,
      viewerId,
      viewerRole,
      allPlayers,
    );

    // 从 ECS World 获取角色信息
    let roleType: RoleType | undefined;
    let faction: Faction | undefined;

    if (canSee && this.world) {
      const identity = this.world.getComponent<IdentityComponent>(
        player.id,
        "IdentityComponent",
      );
      if (identity) {
        roleType = identity.roleType;
        faction = identity.faction;
      }
    }

    return {
      id: player.id,
      name: player.name,
      roleType,
      faction,
      isAlive: player.isAlive,
    };
  }

  /**
   * 视角隔离游戏状态
   */
  sanitizeGameStateForViewer(
    gameState: GameState,
    viewerId: number,
  ): PublicGameState {
    const viewer = gameState.players.find((p) => p.id === viewerId);

    // 从 ECS World 获取查看者的角色信息
    let viewerRole: RoleType | undefined;
    if (viewer && this.world) {
      const identity = this.world.getComponent<IdentityComponent>(
        viewer.id,
        "IdentityComponent",
      );
      viewerRole = identity?.roleType;
    }

    const sanitizedPlayers: PublicPlayer[] = gameState.players.map((player) =>
      this.sanitizePlayerInfoForViewer(
        player,
        viewerId,
        viewerRole,
        gameState.players,
      ),
    );

    return {
      phase: gameState.phase,
      round: gameState.round,
      players: sanitizedPlayers,
      deadPlayerIds: gameState.deadPlayerIds,
      history: gameState.history,
      nightResult: gameState.nightResult,
      votedDeadId: gameState.votedDeadId,
      winner: gameState.winner,
      witchHasAntidote: gameState.witchHasAntidote,
      witchHasPoison: gameState.witchHasPoison,
      currentSpeechIndex: gameState.currentSpeechIndex,
      phaseStack: gameState.phaseStack,
    };
  }

  /**
   * 视角隔离聊天消息
   *
   * 注意：当前系统使用 PlayerAction 作为消息格式，
   * 此方法同时支持 PlayerAction 和 ChatMessage 格式
   */
  sanitizeChatMessageForViewer(
    message: PlayerAction | ChatMessage,
    viewerId: number,
  ): ChatMessage {
    const isPlayerAction = "actionType" in message;
    const canSeePrivateThought = this.canSeePrivateThought(
      message as ChatMessage,
      viewerId,
    );

    const baseMessage: ChatMessage = {
      id: isPlayerAction
        ? `action-${message.timestamp}`
        : (message as ChatMessage).id,
      type: isPlayerAction ? "action" : (message as ChatMessage).type,
      playerId: message.playerId === -1 ? undefined : message.playerId,
      playerName: (message as ChatMessage).playerName,
      content: message.content || "",
      timestamp: message.timestamp,
    };

    // privateThought/thought 只在允许时包含
    if (canSeePrivateThought) {
      baseMessage.privateThought = isPlayerAction
        ? (message as PlayerAction).thought
        : (message as ChatMessage).privateThought;
    } else {
      baseMessage.privateThought = undefined;
    }

    return baseMessage;
  }

  /**
   * 视角隔离玩家动作历史
   */
  sanitizeHistoryForViewer(
    history: PlayerAction[],
    viewerId: number,
  ): ChatMessage[] {
    return history.map((action) =>
      this.sanitizeChatMessageForViewer(action, viewerId),
    );
  }

  /**
   * 过滤广播事件数据
   * 根据事件类型和接收者视角过滤敏感信息
   */
  sanitizeBroadcastEvent(event: BroadcastEvent): BroadcastEvent {
    // TODO: 根据事件类型实现具体的过滤逻辑
    // 目前返回原始事件，需要实现：
    // 1. 对于 PlayerDied 事件，可能需要过滤 roleType
    // 2. 对于 RoleReveal 事件，需要根据接收者视角决定是否显示
    // 3. 对于其他事件，可能需要过滤玩家身份信息

    return event;
  }
}
