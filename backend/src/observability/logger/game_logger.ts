import * as fs from "fs";
import * as path from "path";

/**
 * JSONL 单行日志结构。
 */
export interface GameLogLine {
  timestamp: number;
  type: string;
  payload: Record<string, unknown>;
}

/**
 * 对局 JSONL 日志写入器：
 * 每行一条事件，便于离线回放和问题定位。
 */
export class GameLogger {
  private readonly logPath: string;

  constructor(baseDir: string) {
    fs.mkdirSync(baseDir, { recursive: true });
    const fileName = `v3-${Date.now()}.jsonl`;
    this.logPath = path.join(baseDir, fileName);
  }

  /**
   * 追加写入一条事件日志。
   */
  append(line: GameLogLine): void {
    fs.appendFileSync(this.logPath, `${JSON.stringify(line)}\n`, "utf8");
  }

  /**
   * 返回当前日志文件路径。
   */
  getPath(): string {
    return this.logPath;
  }
}
