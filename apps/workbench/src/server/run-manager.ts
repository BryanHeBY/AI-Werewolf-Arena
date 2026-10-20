/**
 * 负责具名游戏的独立进程启动和启动失败登记；输入已校验游戏名，输出可发现的会话 ID。
 * 每局运行真实公共 CLI，不在服务内创建 World；父服务退出不杀进程，停止交实例控制协议。
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { applicationResource } from "@ai-werewolf-arena/project-paths";
import os from "node:os";
import { readProcessIdentity, readBootId } from "@ai-werewolf-arena/game-runtime/run-session";
import type { SessionEntry } from "@ai-werewolf-arena/workbench-contract";
import { checkConfig } from "@ai-werewolf-arena/game-runtime/config/check";
import { ConfigDocuments, containedFile, WorkbenchError } from "./config-documents";
import { SessionStore } from "./session-store";
import { runDeletionSnapshot, assertPlainDirectory } from "./run-deletion";
export class RunManager {
  private deletes = new Map<string, Promise<void>>();
  private finalizers = new Map<string, Promise<void>>();
  constructor(
    readonly repository: string,
    readonly configs: string,
    readonly sessions: SessionStore,
    readonly jobsRoot: string,
  ) {}
  async start(gameName: string, expectedRevision?: string): Promise<string> {
    if (!/^[a-z][a-z0-9_-]*$/.test(gameName)) throw new WorkbenchError("invalid_config_name");
    const documents = new ConfigDocuments(this.configs);
    if (
      expectedRevision !== undefined &&
      (await documents.read("games", gameName)).revision !== expectedRevision
    )
      throw new WorkbenchError("config_conflict", 409);
    const summary = await checkConfig(this.configs, gameName);
    if (
      expectedRevision !== undefined &&
      (await documents.read("games", gameName)).revision !== expectedRevision
    )
      throw new WorkbenchError("config_conflict", 409);
    const sessionId = `session_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    const file = await containedFile(this.jobsRoot, `${sessionId}.json`);
    const job: SessionEntry & {
      launcher?: { pid: number; processStart: string | null; host: string; bootId: string | null };
    } = {
      sessionId,
      board: summary.board,
      gameName,
      origin: "workbench",
      startedAt: new Date().toISOString(),
      state: "starting",
      game: "unfinished",
      recording: "partial",
      canStop: false,
      canReplay: false,
    };
    await fs.mkdir(this.jobsRoot, { recursive: true });
    await fs.writeFile(file, JSON.stringify(job), { flag: "wx", mode: 0o600 });
    // stdout 直接写文件，不让无人消费的管道反压卡住模型；会话 ANSI 另由运行层按序保存。
    const transcript = path.join(this.jobsRoot, `${sessionId}.startup.log`);
    const output = await fs.open(transcript, "a", 0o600);
    try {
      const child = Bun.spawn(
        [
          process.execPath,
          applicationResource("game", "src/cli/run-game.ts"),
          "--configs-dir",
          this.configs,
          "--game-config-name",
          gameName,
          "--record-root-dir",
          this.sessions.root,
          "--color",
          "true",
        ],
        {
          cwd: this.repository,
          detached: true,
          stdin: "ignore",
          stdout: output.fd,
          stderr: output.fd,
          env: { ...process.env, AWA_RUN_ORIGIN: "workbench", AWA_SESSION_ID: sessionId },
        },
      );
      child.unref();
      job.launcher = {
        pid: child.pid,
        processStart: await readProcessIdentity(child.pid),
        host: os.hostname(),
        bootId: await readBootId(),
      };
      await fs.writeFile(file, JSON.stringify(job), { mode: 0o600 });
      const finalizer = child.exited
        .then(async (code) => {
          job.state = code === 0 ? "completed" : code === 130 ? "cancelled" : "failed";
          job.endedAt = new Date().toISOString();
          if (code !== 0 && code !== 130) job.errorCode = "game_run_failed";
          const tmp = `${file}.tmp`;
          await fs.writeFile(tmp, JSON.stringify(job), { mode: 0o600 });
          await fs.rename(tmp, file);
        })
        .catch(() => {})
        .finally(() => this.finalizers.delete(sessionId));
      this.finalizers.set(sessionId, finalizer);
    } catch (error) {
      job.state = "failed";
      job.errorCode = "run_start_failed";
      await fs.writeFile(file, JSON.stringify(job));
      throw error;
    } finally {
      await output.close();
    }
    return sessionId;
  }
  async jobs(): Promise<SessionEntry[]> {
    try {
      const files = await fs.readdir(this.jobsRoot);
      return (
        await Promise.all(
          files
            .filter((n) => /^session_[a-zA-Z0-9_-]+\.json$/.test(n))
            .map(async (n) => {
              try {
                const job = JSON.parse(
                  await fs.readFile(await containedFile(this.jobsRoot, n), "utf8"),
                );
                if (
                  job.sessionId !== n.slice(0, -5) ||
                  typeof job.startedAt !== "string" ||
                  typeof job.board !== "string"
                )
                  return null;
                if (job.state === "starting" && Date.now() - Date.parse(job.startedAt) > 15000) {
                  const owner = job.launcher;
                  if (owner?.host === os.hostname() && owner.bootId && owner.processStart) {
                    const live =
                      owner.bootId === (await readBootId()) &&
                      owner.processStart === (await readProcessIdentity(owner.pid));
                    // 已越过启动租约却没有运行登记，即使进程尚存也不能继续宣称正在启动。
                    job.state = live ? "lost" : "interrupted";
                  } else job.state = "lost";
                }
                // 磁盘 JSON 的类型不可信；公开摘要只接受契约中的标量，不能仅裁键后转发嵌套认证。
                const entry: SessionEntry = {
                  sessionId: job.sessionId,
                  board: job.board,
                  startedAt: job.startedAt,
                  state: [
                    "starting",
                    "running",
                    "finalizing",
                    "completed",
                    "failed",
                    "cancelled",
                    "lost",
                    "interrupted",
                    "legacy",
                  ].includes(job.state)
                    ? job.state
                    : "lost",
                  game: ["decided", "unfinished", "unknown"].includes(job.game)
                    ? job.game
                    : "unknown",
                  recording: ["running", "complete", "partial", "legacy"].includes(job.recording)
                    ? job.recording
                    : "partial",
                  canStop: job.canStop === true,
                  canReplay: job.canReplay === true,
                };
                for (const key of ["gameName", "endedAt", "finishReason", "errorCode"] as const)
                  if (typeof job[key] === "string") entry[key] = job[key];
                if (job.origin === "cli" || job.origin === "workbench") entry.origin = job.origin;
                if (job.winner === null || typeof job.winner === "string")
                  entry.winner = job.winner;
                return entry;
              } catch {
                return null;
              }
            }),
        )
      ).filter((v): v is SessionEntry => v !== null);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }
  async list(): Promise<SessionEntry[]> {
    const [records, jobs] = await Promise.all([this.sessions.list(), this.jobs()]);
    const byId = new Map(jobs.map((job) => [job.sessionId, job]));
    for (const record of records) {
      const job = byId.get(record.sessionId);
      byId.set(
        record.sessionId,
        record.state === "legacy" && job
          ? {
              ...record,
              origin: job.origin,
              gameName: job.gameName,
              state: job.state,
              ...(job.errorCode ? { errorCode: job.errorCode } : {}),
            }
          : record,
      );
    }
    const entries = [...byId.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    return Promise.all(
      entries.map(async (entry) => {
        try {
          const snapshot = await runDeletionSnapshot(
            this.sessions.root,
            this.jobsRoot,
            entry.sessionId,
          );
          return {
            ...entry,
            revision: snapshot.revision,
            canDelete: snapshot.canDelete,
            ...(snapshot.deleteBlock ? { deleteBlock: snapshot.deleteBlock } : {}),
          };
        } catch {
          return { ...entry, canDelete: false, deleteBlock: "run_liveness_unknown" };
        }
      }),
    );
  }
  async delete(id: string, expected: string): Promise<void> {
    const operation = (this.deletes.get(id) ?? Promise.resolve())
      .catch(() => {})
      .then(async () => {
        const original = await runDeletionSnapshot(this.sessions.root, this.jobsRoot, id);
        if (original.revision !== expected) throw new WorkbenchError("run_conflict", 409);
        if (!original.canDelete) throw new WorkbenchError(original.deleteBlock!, 409);
        // 子进程已退出时，等待本服务尚未落盘的退出登记，避免删除后又生成同名 job。
        await this.finalizers.get(id);
        await assertPlainDirectory(original.directory);
        const current = await runDeletionSnapshot(this.sessions.root, this.jobsRoot, id);
        if (current.revision !== expected) throw new WorkbenchError("run_conflict", 409);
        if (!current.canDelete) throw new WorkbenchError(current.deleteBlock!, 409);
        // 只删除这一局的记录目录及同 ID 启动登记；不会触及共享配置或 output。
        await fs.rm(current.directory, { recursive: true, force: true });
        for (const file of current.files) await fs.rm(file, { force: true });
      });
    this.deletes.set(id, operation);
    try {
      await operation;
    } finally {
      if (this.deletes.get(id) === operation) this.deletes.delete(id);
    }
  }
  async logs(id: string, after: number) {
    const page = await this.sessions.logs(id, after);
    if (page.chunks.length || after > 0) return page;
    // 活动实例的半行不占用序号；已停止且不可能补完的半行不能永久遮住启动失败。
    const job = (await this.jobs()).find((job) => job.sessionId === id);
    if (!job || !["failed", "interrupted", "lost"].includes(job.state)) return page;
    const snapshot = await runDeletionSnapshot(this.sessions.root, this.jobsRoot, id);
    if (!snapshot.canDelete) return page;
    const file = await containedFile(this.jobsRoot, `${id}.startup.log`);
    try {
      // 启动诊断仅取末尾 64 KiB，不将整场 stdout 副本载入内存。
      const handle = await fs.open(file, "r");
      let tail: Buffer;
      try {
        const stat = await handle.stat();
        const length = Math.min(stat.size, 65536);
        const bytes = Buffer.alloc(length);
        const { bytesRead } = await handle.read(bytes, 0, length, Math.max(0, stat.size - length));
        tail = bytes.subarray(0, bytesRead);
      } finally {
        await handle.close();
      }
      return {
        chunks: [
          {
            seq: 1,
            timestamp: job.endedAt ?? job.startedAt,
            text: tail.toString("utf8"),
          },
        ],
        cursor: 1,
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { chunks: [], cursor: after };
      throw error;
    }
  }
}
