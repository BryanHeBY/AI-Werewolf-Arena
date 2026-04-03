import * as fs from "fs";
import * as path from "path";
import {
  BroadcastEvent,
  GameState,
  GamePhase,
  PublicGameState,
} from "../core/types";

export class GameLogger {
  private logDir: string;
  private currentFilePath: string | null = null;
  private writeStream: fs.WriteStream | null = null;
  private buffer: string[] = [];
  private gameStartTime: number = 0;

  constructor(logDir: string = "./data/records") {
    this.logDir = logDir;
    this.ensureDirectoryExists();
  }

  startNewGame(): void {
    this.gameStartTime = Date.now();
    const filename = `game-${this.gameStartTime}.jsonl`;
    this.currentFilePath = path.join(this.logDir, filename);
    this.writeStream = fs.createWriteStream(this.currentFilePath, {
      flags: "a",
    });
    this.buffer = [];
    console.log(`游戏日志保存至: ${this.currentFilePath}`);
  }

  logEvent(event: BroadcastEvent): void {
    // Clean circular references
    const cleanEvent = JSON.parse(
      JSON.stringify(event, (key, value) => {
        if (key === "client") return undefined;
        if (
          key === "role" &&
          typeof value === "object" &&
          "roleType" in value
        ) {
          return { roleType: value.roleType, faction: value.faction };
        }
        return value;
      }),
    );
    this.appendLine(JSON.stringify(cleanEvent));
  }

  logGameState(state: PublicGameState): void {
    // PublicGameState is already clean - no circular references
    this.appendLine(
      JSON.stringify({ type: "gameState", data: state, timestamp: Date.now() }),
    );
  }

  logPhaseStart(phase: GamePhase): void {
    this.appendLine(
      JSON.stringify({ type: "phaseStart", phase, timestamp: Date.now() }),
    );
  }

  logGameOver(state: PublicGameState): void {
    this.appendLine(
      JSON.stringify({ type: "gameOver", state, timestamp: Date.now() }),
    );
  }

  async flush(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.buffer.length > 0 && this.writeStream) {
        const content = this.buffer.join("\n") + "\n";
        this.buffer = [];
        this.writeStream.write(content, (error) => {
          if (error) reject(error);
          else resolve();
        });
      } else {
        resolve();
      }
    });
  }

  close(): void {
    if (this.writeStream) {
      this.flush()
        .then(() => {
          this.writeStream!.end();
          this.writeStream = null;
          this.currentFilePath = null;
        })
        .catch(console.error);
    }
  }

  getCurrentFilePath(): string | null {
    return this.currentFilePath;
  }

  private appendLine(line: string): void {
    this.buffer.push(line);
    if (this.buffer.length >= 10) {
      this.flush().catch(console.error);
    }
  }

  private ensureDirectoryExists(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }
}
