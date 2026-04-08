import * as fs from "fs";
import * as path from "path";

export interface GameLogLine {
  timestamp: number;
  type: string;
  payload: Record<string, unknown>;
}

export class GameLogger {
  private readonly logPath: string;

  constructor(baseDir: string) {
    fs.mkdirSync(baseDir, { recursive: true });
    const fileName = `v3-${Date.now()}.jsonl`;
    this.logPath = path.join(baseDir, fileName);
  }

  append(line: GameLogLine): void {
    fs.appendFileSync(this.logPath, `${JSON.stringify(line)}\n`, "utf8");
  }

  getPath(): string {
    return this.logPath;
  }
}
