import { promises as fs } from "fs";
import path from "path";

/** Atomic filesystem adapter for one replay session directory. */
export class ReplayFileStore {
  constructor(readonly sessionDir: string) {}

  async initialize(): Promise<void> {
    await fs.mkdir(path.join(this.sessionDir, "players"), { recursive: true });
  }

  async writeJson(relativePath: string, data: unknown): Promise<void> {
    await this.write(relativePath, JSON.stringify(data, null, 2), "json");
  }

  async writeText(relativePath: string, data: string): Promise<void> {
    await this.write(relativePath, data, "text");
  }

  /** 产品消费文件使用严格写入，失败由调用方感知，避免生成残缺复盘。 */
  async writeJsonStrict(relativePath: string, data: unknown): Promise<void> {
    await this.writeAtomic(relativePath, JSON.stringify(data, null, 2));
  }

  private async write(relativePath: string, content: string, kind: string): Promise<void> {
    try {
      await this.writeAtomic(relativePath, content);
    } catch (error) {
      console.warn(
        `[observability] write_${kind}_failed file=${relativePath} err=${String(error)}`,
      );
    }
  }

  private async writeAtomic(relativePath: string, content: string): Promise<void> {
    const target = path.join(this.sessionDir, relativePath);
    const temporary = `${target}.tmp`;
    await fs.writeFile(temporary, content, "utf-8");
    await fs.rename(temporary, target);
  }
}
