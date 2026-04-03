import {
  GameState,
  GamePhase,
  Player,
  PlayerAction,
  GameConfig,
  Faction,
  RoleType,
  ActionType,
  BroadcastEventType,
  BroadcastEvent,
  PublicGameState,
  PublicPlayer,
} from "./types";
import { Environment } from "./Environment";
import { AgentController } from "../agent/AgentController";
import { GameLogger } from "../logger/GameLogger";
import { Broadcaster } from "../broadcaster/Broadcaster";

export class GameEngine {
  private env: Environment;
  private config: GameConfig;
  private agentController: AgentController;
  private logger: GameLogger;
  private broadcaster: Broadcaster;
  private isRunning: boolean = false;
  private abortController: AbortController | null = null;

  constructor(
    config: GameConfig,
    players: Player[],
    logger: GameLogger,
    broadcaster: Broadcaster,
  ) {
    this.config = config;
    this.logger = logger;
    this.broadcaster = broadcaster;
    this.env = new Environment(config, players);
    this.agentController = new AgentController(this.env, this.broadcaster);

    this.env.getEventBus().on("broadcast", (event: BroadcastEvent) => {
      this.broadcaster.broadcast(event);
      this.logger.logEvent(event);
    });

    this.env.getEventBus().on("playerDied", (data: { playerId: number }) => {
      const player = this.env.getPlayerById(data.playerId);
      this.env.broadcast({
        type: BroadcastEventType.PlayerDied,
        data: {
          playerId: data.playerId,
          roleType: player?.role.roleType,
        },
        timestamp: Date.now(),
      });
    });
  }

  getEnvironment(): Environment {
    return this.env;
  }

  getGameState(): GameState {
    return this.env.getGameState();
  }

  /**
   * Export clean public game state without circular references or sensitive data
   */
  exportGameState(): PublicGameState {
    return this.env.getPublicGameState();
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn("Game is already running");
      return;
    }

    this.isRunning = true;
    this.abortController = new AbortController();
    this.logger.startNewGame();

    // Initialize game state
    this.env.setGameState({
      phase: GamePhase.NightStart,
      round: 1,
    });

    this.env.broadcast({
      type: BroadcastEventType.GameStarted,
      data: {
        players: this.exportGameState().players.map((p) => ({
          id: p.id,
          name: p.name,
          isAlive: p.isAlive,
          // Don't send role information to frontend - spectators don't get to know
        })),
        round: 1,
      },
      timestamp: Date.now(),
    });

    this.env.broadcastGameState();
    this.logger.logGameState(this.exportGameState());

    await this.runStateMachine();
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    await this.logger.flush();
  }

  get isGameRunning(): boolean {
    return this.isRunning;
  }

  private async runStateMachine(): Promise<void> {
    while (this.isRunning) {
      const currentPhase = this.env.getGameState().phase;

      if (currentPhase === GamePhase.GameOver) {
        break;
      }

      try {
        await this.processPhase(currentPhase);
        if (!this.isRunning) break;

        if (currentPhase !== GamePhase.CheckWinCondition) {
          const nextPhase = this.getNextPhase(currentPhase);
          this.env.setGameState({ phase: nextPhase });
        }
        this.env.broadcastGameState();

        this.logger.logGameState(this.exportGameState());
      } catch (error) {
        if (this.abortController?.signal.aborted) {
          console.log("游戏已中止");
          break;
        }
        console.error("Error processing phase", currentPhase, error);
        this.isRunning = false;
        break;
      }
    }

    if (
      this.isRunning ||
      this.env.getGameState().phase === GamePhase.GameOver
    ) {
      this.endGame();
    }
  }

  private getNextPhase(current: GamePhase): GamePhase {
    switch (current) {
      case GamePhase.NightStart:
        return GamePhase.WolfAction;
      case GamePhase.WolfAction:
        return GamePhase.SeerAction;
      case GamePhase.SeerAction:
        return GamePhase.WitchAction;
      case GamePhase.WitchAction:
        return GamePhase.DayStart;
      case GamePhase.DayStart:
        return GamePhase.PublishNightResult;
      case GamePhase.PublishNightResult:
        return GamePhase.CheckWinCondition;
      case GamePhase.CheckWinCondition:
        return GamePhase.SequentialSpeech;
      case GamePhase.SequentialSpeech:
        return GamePhase.Vote;
      case GamePhase.Vote:
        return GamePhase.CheckWinCondition;
      case GamePhase.GameOver:
        return GamePhase.GameOver;
      default:
        console.warn(`Unknown phase: ${current}`);
        return GamePhase.GameOver;
    }
  }

  private async processPhase(phase: GamePhase): Promise<void> {
    const players = this.env.getAlivePlayers();
    const state = this.env.getGameState();

    switch (phase) {
      case GamePhase.NightStart:
        await this.processNightStart();
        break;

      case GamePhase.WolfAction:
        await this.processWolfAction();
        break;

      case GamePhase.SeerAction:
        await this.processSeerAction();
        break;

      case GamePhase.WitchAction:
        await this.processWitchAction();
        break;

      case GamePhase.DayStart:
        this.processDayStart();
        break;

      case GamePhase.PublishNightResult:
        await this.processPublishNightResult();
        break;

      case GamePhase.CheckWinCondition:
        if (this.checkWinCondition()) {
          this.env.setGameState({ phase: GamePhase.GameOver });
        } else {
          const currentState = this.env.getGameState();
          if (currentState.votedDeadId !== undefined) {
            this.env.setGameState({
              phase: GamePhase.NightStart,
              round: currentState.round + 1,
              votedDeadId: undefined,
            });
          } else {
            this.env.setGameState({ phase: GamePhase.SequentialSpeech });
          }
        }
        break;

      case GamePhase.SequentialSpeech:
        await this.processSequentialSpeech();
        break;

      case GamePhase.Vote:
        await this.processVote();
        break;

      case GamePhase.GameOver:
        // Game is already ended
        break;

      default:
        console.warn(`Unknown phase: ${phase}`);
    }
  }

  private async processNightStart(): Promise<void> {
    this.logger.logPhaseStart(GamePhase.NightStart);
    this.env.setGameState({
      nightResult: {
        deadPlayerIds: [],
        killedByWolf: undefined,
        savedByWitch: undefined,
        poisonedByWitch: undefined,
      },
      votedDeadId: undefined,
    });
    await this.sleep(1000);
  }

  private async processWolfAction(): Promise<void> {
    this.logger.logPhaseStart(GamePhase.WolfAction);
    const wolves = this.env
      .getGameState()
      .players.filter((p) => p.isAlive && p.role.roleType === RoleType.Wolf);

    const historyBefore = this.env.getGameState().history.length;

    await Promise.all(
      wolves.map((wolf) => this.agentController.runAgentCycle(wolf.role)),
    );

    const nightResult = this.env.getGameState().nightResult!;
    const history = this.env.getGameState().history;
    const killActions = history
      .slice(historyBefore)
      .filter(
        (a) =>
          a.actionType === ActionType.Kill &&
          a.roleType === RoleType.Wolf &&
          a.targetId !== undefined,
      );

    nightResult.deadPlayerIds = [];
    nightResult.killedByWolf = undefined;

    if (killActions.length > 0) {
      nightResult.killedByWolf = killActions[0].targetId!;
      nightResult.deadPlayerIds = [killActions[0].targetId!];
    }

    this.env.setGameState({ nightResult });

    await this.sleep(1000);
  }

  private async processSeerAction(): Promise<void> {
    this.logger.logPhaseStart(GamePhase.SeerAction);
    const seers = this.env
      .getGameState()
      .players.filter((p) => p.isAlive && p.role.roleType === RoleType.Seer);

    // Sequential just in case (but should only be one seer in MVP)
    for (const seer of seers) {
      if (!seer.isAlive) continue;
      await this.agentController.runAgentCycle(seer.role);
      await this.sleep(500);
    }
  }

  private async processWitchAction(): Promise<void> {
    this.logger.logPhaseStart(GamePhase.WitchAction);
    const witches = this.env
      .getGameState()
      .players.filter((p) => p.isAlive && p.role.roleType === RoleType.Witch);

    for (const witch of witches) {
      if (!witch.isAlive) continue;
      await this.agentController.runAgentCycle(witch.role);
      await this.sleep(500);
    }
    await this.sleep(1000);
  }

  private processDayStart(): void {
    this.logger.logPhaseStart(GamePhase.DayStart);
  }

  private async processPublishNightResult(): Promise<void> {
    this.logger.logPhaseStart(GamePhase.PublishNightResult);
    const nightResult = this.env.getGameState().nightResult!;
    const deadIds = nightResult.deadPlayerIds;

    for (const deadId of deadIds) {
      this.env.markPlayerDead(deadId);
    }

    this.env.broadcast({
      type: BroadcastEventType.NightResult,
      data: {
        deadPlayerIds: deadIds,
        deadPlayerNames: deadIds.map(
          (id) => this.env.getPlayerById(id)?.name.split(" (")[0],
        ), // Don't reveal role in name
      },
      timestamp: Date.now(),
    });

    // Add public announcement to history - don't reveal dead player's role!
    if (deadIds.length === 0) {
      this.publishPublicAnnouncement("昨晚是平安夜，没有玩家死亡。");
    } else if (deadIds.length === 1) {
      const deadPlayer = this.env.getPlayerById(deadIds[0]);
      const cleanName =
        deadPlayer?.name.split(" (")[0] || `Player ${deadIds[0]}`;
      this.publishPublicAnnouncement(`${cleanName}昨晚被杀害了。`);
    } else {
      const names = deadIds
        .map(
          (id) =>
            this.env.getPlayerById(id)?.name.split(" (")[0] || `Player ${id}`,
        )
        .join("和");
      this.publishPublicAnnouncement(`昨晚${names}被杀害了。`);
    }

    await this.sleep(1500);
  }

  private async processSequentialSpeech(): Promise<void> {
    this.logger.logPhaseStart(GamePhase.SequentialSpeech);
    const alivePlayers = this.env.getAlivePlayers();
    this.env.setGameState({ currentSpeechIndex: 0 });

    // Broadcast total speakers info at the start
    this.env.broadcast({
      type: BroadcastEventType.SpeechStart,
      data: {
        totalSpeakers: alivePlayers.length,
      },
      timestamp: Date.now(),
    });

    // Strictly sequential - each player speaks in order
    for (let i = 0; i < alivePlayers.length; i++) {
      if (!this.isRunning) break;

      const player = alivePlayers[i];
      if (!player.isAlive) continue;

      this.env.setGameState({ currentSpeechIndex: i });

      // Broadcast speech start for this specific player
      this.env.broadcast({
        type: BroadcastEventType.SpeechStart,
        data: {
          playerId: player.id,
          playerName: player.name,
          totalSpeakers: alivePlayers.length,
          currentIndex: i,
        },
        timestamp: Date.now(),
      });

      await this.agentController.runAgentCycle(player.role);
      await this.sleep(1000); // Pause between speeches for readability
    }
  }

  private async processVote(): Promise<void> {
    this.logger.logPhaseStart(GamePhase.Vote);
    const alivePlayers = this.env.getAlivePlayers();

    await Promise.all(
      alivePlayers
        .filter((p) => p.isAlive)
        .map((player) => this.agentController.runAgentCycle(player.role)),
    );

    const voteMap = new Map<number, number>();
    const history = this.env.getGameState().history;

    const votingPlayerIds = new Set<number>();

    for (
      let i = history.length - 1;
      i >= 0 && votingPlayerIds.size < alivePlayers.length;
      i--
    ) {
      const action = history[i];
      if (
        action.actionType === ActionType.Vote &&
        action.targetId !== undefined &&
        !votingPlayerIds.has(action.playerId)
      ) {
        votingPlayerIds.add(action.playerId);
        voteMap.set(action.targetId, (voteMap.get(action.targetId) || 0) + 1);
      }
    }

    let maxVotes = 0;
    let votedOutId: number | undefined;
    let tie = false;

    for (const [targetId, count] of voteMap) {
      if (count > maxVotes) {
        maxVotes = count;
        votedOutId = targetId;
        tie = false;
      } else if (count === maxVotes && maxVotes > 0) {
        tie = true;
      }
    }

    if (tie) {
      votedOutId = undefined;
    }

    if (votedOutId !== undefined) {
      this.env.markPlayerDead(votedOutId);
      this.env.setGameState({ votedDeadId: votedOutId });

      const deadPlayer = this.env.getPlayerById(votedOutId);
      this.publishPublicAnnouncement(
        `投票结果：${deadPlayer?.name}被公投放逐出局。`,
      );

      this.env.broadcast({
        type: BroadcastEventType.VoteResult,
        data: {
          votedOutId,
          votedOutName: deadPlayer?.name,
          voteCounts: Object.fromEntries(voteMap),
        },
        timestamp: Date.now(),
      });
    } else {
      this.publishPublicAnnouncement("投票平票，没有人被放逐。");
    }

    await this.sleep(1500);
  }

  private checkWinCondition(): boolean {
    const aliveByFaction = this.env.getAlivePlayers().reduce(
      (acc, player) => {
        acc[player.faction] = (acc[player.faction] || 0) + 1;
        return acc;
      },
      {} as Record<Faction, number>,
    );

    const wolfCount = aliveByFaction[Faction.Wolf] || 0;
    const villagerCount = aliveByFaction[Faction.Villager] || 0;

    if (wolfCount === 0) {
      // Villagers win
      this.env.setGameState({ winner: Faction.Villager });
      return true;
    }

    if (wolfCount >= villagerCount) {
      // Wolves win - equal number means wolves win in standard rules
      this.env.setGameState({ winner: Faction.Wolf });
      return true;
    }

    return false;
  }

  private endGame(): void {
    this.logger.logPhaseStart(GamePhase.GameOver);
    const publicState = this.exportGameState();
    const winner = publicState.winner!;

    this.env.broadcast({
      type: BroadcastEventType.GameOver,
      data: {
        winner,
        deadPlayerIds: publicState.deadPlayerIds,
        finalRoles: publicState.players.map((p) => ({
          id: p.id,
          name: p.name,
          role: p.roleType,
          isAlive: p.isAlive,
        })),
      },
      timestamp: Date.now(),
    });

    this.env.broadcast({
      type: BroadcastEventType.WinnerDeclared,
      data: { winner },
      timestamp: Date.now(),
    });

    this.logger.logGameOver(publicState);
    this.isRunning = false;
    this.logger.flush().catch(console.error);
  }

  private publishPublicAnnouncement(content: string): void {
    const action: PlayerAction = {
      playerId: -1, // -1 represents the judge
      roleType: undefined as any,
      actionType: ActionType.Speak,
      content,
      thought: "",
      timestamp: Date.now(),
    };
    this.env.publishAction(action);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
