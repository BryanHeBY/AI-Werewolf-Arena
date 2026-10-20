/**
 * 负责发现会话、核对进程身份及分页读取 ANSI 日志；输入记录根和会话 ID，输出无控制令牌的运行摘要。
 * 只消费运行与录制文件，不修改游戏状态；停止先复验本机进程和控制地址，不以 PID 直接杀进程。
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { inspectRunOwner } from "./run-owner";
import {
  ACTIVE_RUN_STATES,
  type RunMetadata,
  type SessionEntry,
  type ConsoleChunk,
} from "@ai-werewolf-arena/workbench-contract";
import { containedFile, WorkbenchError } from "./config-documents";
import { ConsoleLogReader } from "./console-log-reader";

export class SessionStore {
  private readonly consoleLogs = new ConsoleLogReader();
  constructor(readonly root: string) {}
  async file(id: string, name: string): Promise<string> {
    if (!/^session_[a-zA-Z0-9_-]+$/.test(id)) throw new WorkbenchError("invalid_session");
    return containedFile(this.root, `${id}/${name}`);
  }
  async json(id: string, name: string): Promise<any | null> {
    const file = await this.file(id, name);
    try {
      return JSON.parse(await fs.readFile(file, "utf8"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT" || error instanceof SyntaxError)
        return null;
      throw error;
    }
  }
  async owns(runtime: RunMetadata): Promise<boolean> {
    return (await inspectRunOwner(runtime)) === "live";
  }
  async get(id: string): Promise<SessionEntry | null> {
    const manifest = await this.json(id, "manifest.json");
    if (
      !manifest ||
      manifest.session_id !== id ||
      typeof manifest.board !== "string" ||
      typeof manifest.started_at !== "string" ||
      typeof manifest.finish_reason !== "string"
    )
      return null;
    const raw = await this.json(id, "runtime.json");
    const runtime: RunMetadata | null =
      raw?.schemaVersion === 1 &&
      raw.sessionId === id &&
      typeof raw.instanceId === "string" &&
      ["starting", "running", "finalizing", "completed", "failed", "cancelled"].includes(
        raw.state,
      ) &&
      typeof raw.heartbeatAt === "string"
        ? raw
        : null;
    let state: SessionEntry["state"] = runtime?.state ?? "legacy";
    let live = false;
    if (runtime && ACTIVE_RUN_STATES.includes(runtime.state)) {
      const ownership = await inspectRunOwner(runtime);
      live = ownership === "live";
      const fresh = Date.now() - Date.parse(runtime.heartbeatAt) < 12000;
      if (!live) state = ownership === "dead" ? "interrupted" : "lost";
      else if (!fresh) state = "lost";
    }
    const completion = await this.json(id, "completion.json");
    let complete =
      completion?.schemaVersion === 1 &&
      completion.sessionId === id &&
      typeof completion.endedAt === "string" &&
      completion.endedAt === manifest.ended_at &&
      manifest.finish_reason !== "in_progress" &&
      Array.isArray(completion.files) &&
      completion.files.includes("manifest.json") &&
      completion.files.includes("replay.json");
    if (complete)
      for (const name of completion.files) {
        if (!["manifest.json", "replay.json", "reproduction.json"].includes(name)) {
          complete = false;
          break;
        }
        try {
          const stat = await fs.stat(await this.file(id, name));
          if (!stat.isFile() || !stat.size) complete = false;
        } catch {
          complete = false;
        }
      }
    let canReplay = false;
    try {
      const replay = await fs.stat(await this.file(id, "replay.json"));
      canReplay = replay.isFile() && replay.size > 0;
    } catch {}
    return {
      sessionId: id,
      board: manifest.board,
      startedAt: manifest.started_at,
      ...(typeof runtime?.gameName === "string" ? { gameName: runtime.gameName } : {}),
      ...(runtime?.origin === "cli" || runtime?.origin === "workbench"
        ? { origin: runtime.origin }
        : {}),
      ...(typeof runtime?.endedAt === "string"
        ? { endedAt: runtime.endedAt }
        : manifest.finish_reason !== "in_progress" && typeof manifest.ended_at === "string"
          ? { endedAt: manifest.ended_at }
          : {}),
      state,
      game: manifest.game_result
        ? "decided"
        : manifest.finish_reason === "in_progress"
          ? "unknown"
          : "unfinished",
      recording: complete
        ? "complete"
        : runtime && ACTIVE_RUN_STATES.includes(state as any)
          ? "running"
          : completion || runtime
            ? "partial"
            : "legacy",
      ...(typeof manifest.winner === "string" || manifest.winner === null
        ? { winner: manifest.winner }
        : {}),
      finishReason: manifest.finish_reason,
      canStop: live && !!runtime?.control && ACTIVE_RUN_STATES.includes(runtime.state),
      canReplay,
      ...(typeof runtime?.errorCode === "string" ? { errorCode: runtime.errorCode } : {}),
    };
  }
  async list(): Promise<SessionEntry[]> {
    let entries: string[];
    try {
      entries = await fs.readdir(this.root);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
    const values = await Promise.all(
      entries
        .filter((name) => /^session_[a-zA-Z0-9_-]+$/.test(name))
        .map(async (name) => {
          try {
            return await this.get(name);
          } catch {
            return null;
          }
        }),
    );
    return values
      .filter((entry): entry is SessionEntry => entry !== null)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }
  async stop(id: string): Promise<void> {
    const runtime = (await this.json(id, "runtime.json")) as RunMetadata | null;
    if (
      !runtime ||
      runtime.sessionId !== id ||
      !ACTIVE_RUN_STATES.includes(runtime.state) ||
      !(await this.owns(runtime)) ||
      !runtime.control
    )
      throw new WorkbenchError("run_not_controllable", 409);
    const url = new URL(runtime.control.url);
    if (
      url.protocol !== "http:" ||
      url.hostname !== "127.0.0.1" ||
      url.pathname !== "/stop" ||
      !url.port
    )
      throw new WorkbenchError("run_not_controllable", 409);
    const response = await fetch(url, {
      method: "POST",
      headers: { authorization: `Bearer ${runtime.control.token}` },
      redirect: "error",
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) throw new WorkbenchError("run_stop_failed", 409);
  }
  async logs(id: string, after: number): Promise<{ chunks: ConsoleChunk[]; cursor: number }> {
    return this.consoleLogs.read(await this.file(id, "console.jsonl"), after);
  }
}
