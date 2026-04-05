import { PlayerAction, GameState } from "../../src/core/types";

export class MockLogger {
  private logs: any[] = [];
  private gameLogs: any[] = [];
  private currentGameId: string = "mock-game-" + Date.now();

  log(message: string, data?: any): void {
    this.logs.push({ message, data, timestamp: Date.now() });
  }

  logGameEvent(event: string, data?: any): void {
    this.gameLogs.push({ event, data, timestamp: Date.now() });
  }

  logPlayerAction(action: PlayerAction): void {
    this.gameLogs.push({
      type: "player_action",
      action,
      timestamp: Date.now(),
    });
  }

  logGameState(state: GameState): void {
    this.gameLogs.push({ type: "game_state", state, timestamp: Date.now() });
  }

  startNewGame(): void {
    this.currentGameId = "mock-game-" + Date.now();
    this.gameLogs = [];
    this.log("New game started", { gameId: this.currentGameId });
  }

  endGame(): void {
    this.log("Game ended", { gameId: this.currentGameId });
  }

  getLogs(): any[] {
    return [...this.logs];
  }

  getGameLogs(): any[] {
    return [...this.gameLogs];
  }

  getCurrentGameId(): string {
    return this.currentGameId;
  }

  getCurrentFilePath(): string {
    return `/mock/path/${this.currentGameId}.jsonl`;
  }

  clear(): void {
    this.logs = [];
    this.gameLogs = [];
  }

  hasLog(message: string): boolean {
    return this.logs.some((log) => log.message === message);
  }

  hasGameEvent(event: string): boolean {
    return this.gameLogs.some((log) => log.event === event);
  }

  getLastLog(): any | null {
    return this.logs.length > 0 ? this.logs[this.logs.length - 1] : null;
  }

  getLastGameEvent(): any | null {
    return this.gameLogs.length > 0
      ? this.gameLogs[this.gameLogs.length - 1]
      : null;
  }
}

export function createMockPlayerAction(
  playerId: number = 1,
  actionType: string = "test_action",
  targetPlayerId?: number,
  data: any = {},
): PlayerAction {
  return {
    playerId,
    actionType,
    targetPlayerId,
    data,
    timestamp: Date.now(),
  };
}
