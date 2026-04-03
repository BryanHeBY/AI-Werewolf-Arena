import {
  Role as RoleInterface,
  RoleType,
  Faction,
  OODACycle,
  PlayerAction,
  GamePhase,
  EnvironmentInterface,
} from "../core/types";
import { ModelConfig } from "../core/types";
import { OpenAIClient } from "../llm/OpenAIClient";

export abstract class BaseRole implements RoleInterface, OODACycle {
  abstract roleType: RoleType;
  abstract faction: Faction;
  playerId: number;

  protected modelConfig: ModelConfig;
  protected client: OpenAIClient;
  protected systemPrompt: string = "";
  protected lastObservation: string = "";
  protected lastThought: string = "";
  protected privateMemory: string[] = [];

  constructor(
    playerId: number,
    modelConfig: ModelConfig,
    systemPrompt: string,
  ) {
    this.playerId = playerId;
    this.modelConfig = modelConfig;
    this.systemPrompt = systemPrompt;
    this.client = new OpenAIClient(modelConfig);
    this.privateMemory = [];
    this.lastThought = "";
  }

  abstract canActInPhase(phase: GamePhase): boolean;
  abstract getSystemPrompt(): string;

  async observe(env: EnvironmentInterface): Promise<void> {
    const history = env.getVisibleHistory(this.playerId);
    const gameState = env.getGameState();

    let observation = this.buildObservationPrompt(history, gameState);
    this.lastObservation = observation;
  }

  async think(): Promise<string> {
    // Thought is already part of LLM output
    // We just keep it here for act() to use
    return this.lastThought;
  }

  async act(): Promise<PlayerAction> {
    const output = await this.client.chat(
      this.getSystemPrompt(),
      this.lastObservation,
    );
    this.lastThought = output.thought;
    // Save thought to private memory for future context
    this.privateMemory.push(output.thought);

    return {
      playerId: this.playerId,
      roleType: this.roleType,
      actionType: output.action.type,
      targetId: output.action.targetId,
      content: output.action.content,
      thought: output.thought,
      timestamp: Date.now(),
    };
  }

  protected abstract buildObservationPrompt(
    history: PlayerAction[],
    gameState: any,
  ): string;

  protected sanitizeGameStateForObservation(gameState: any): any {
    const sanitizedState: any = {
      ...gameState,
      players: gameState.players.map((p: any) => {
        if (p.id === this.playerId) {
          return p;
        }
        if (this.faction === Faction.Wolf && p.role?.faction === Faction.Wolf) {
          return {
            id: p.id,
            name: p.name,
            isAlive: p.isAlive,
            roleType: p.role?.roleType,
            faction: p.role?.faction,
          };
        }
        return {
          id: p.id,
          name: p.name,
          isAlive: p.isAlive,
        };
      }),
    };

    if (sanitizedState.nightResult) {
      if (this.roleType === RoleType.Wolf) {
        sanitizedState.nightResult = {
          deadPlayerIds: sanitizedState.nightResult.deadPlayerIds,
          killedByWolf: sanitizedState.nightResult.killedByWolf,
        };
      } else if (this.roleType === RoleType.Witch) {
        sanitizedState.nightResult = { ...sanitizedState.nightResult };
      } else {
        sanitizedState.nightResult = {
          deadPlayerIds: sanitizedState.nightResult.deadPlayerIds,
        };
      }
    }

    return sanitizedState;
  }

  /**
   * Get list of valid alive player IDs for targeting
   */
  protected getValidTargetIds(gameState: any): number[] {
    return gameState.players
      .filter((p: any) => p.isAlive && p.id !== this.playerId)
      .map((p: any) => p.id)
      .sort((a: number, b: number) => a - b);
  }

  protected formatHistory(history: PlayerAction[]): string {
    if (history.length === 0) return "(无历史记录)";

    return history
      .map((action) => {
        if (action.playerId === -1) {
          return `[法官] ${action.content}`;
        }
        const prefix = `[玩家 ${action.playerId}] `;
        if (action.actionType === "speak" && action.content) {
          return `${prefix}发言: ${action.content}`;
        }
        return `${prefix}动作: ${action.actionType} -> ${action.targetId}`;
      })
      .join("\n");
  }
}
