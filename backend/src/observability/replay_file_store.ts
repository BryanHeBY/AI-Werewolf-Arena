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

  private async write(relativePath: string, content: string, kind: string): Promise<void> {
    const target = path.join(this.sessionDir, relativePath);
    const temporary = `${target}.tmp`;
    try {
      await fs.writeFile(temporary, content, "utf-8");
      await fs.rename(temporary, target);
    } catch (error) {
      console.warn(
        `[observability] write_${kind}_failed file=${relativePath} err=${String(error)}`,
      );
    }
  }
}
