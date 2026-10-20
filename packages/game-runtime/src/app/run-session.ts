/**
 * 负责真实运行实例的本机登记、心跳和 ANSI 日志；输入为 runner 创建的会话与取消命令，输出私有运行文件。
 * 本实例拥有定时器、控制端口和串行写队列；退出先停心跳再排空写入，失败明确交回 CLI。
 * 控制请求必须匹配随机令牌，不用文件 PID 授权；本模块不判胜、不写 replay 或恢复行动权限。
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import type { RunMetadata, RunState, ConsoleChunk } from "@ai-werewolf-arena/workbench-contract";
import { readProcessIdentity, readBootId } from "./process-identity";
export { readProcessIdentity, readBootId } from "./process-identity";

export class RunSession {
  private queue: Promise<void> = Promise.resolve();
  private failure: unknown;
  private hasFailure = false;
  private seq = 0;
  private timer?: ReturnType<typeof setInterval>;
  private server?: ReturnType<typeof Bun.serve>;
  private constructor(
    readonly directory: string,
    readonly metadata: RunMetadata,
  ) {}

  static async open(input: {
    sessionId: string;
    sessionDir: string;
    board: string;
    gameName: string;
    origin: "cli" | "workbench";
    stop: () => void;
  }): Promise<RunSession> {
    const now = new Date().toISOString();
    const instance = new RunSession(input.sessionDir, {
      schemaVersion: 1,
      sessionId: input.sessionId,
      instanceId: crypto.randomUUID(),
      pid: process.pid,
      processStart: await readProcessIdentity(process.pid),
      host: os.hostname(),
      bootId: await readBootId(),
      origin: input.origin,
      gameName: input.gameName,
      board: input.board,
      startedAt: now,
      heartbeatAt: now,
      state: "starting",
    });
    const token = crypto.randomUUID();
    instance.server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch(request) {
        if (
          request.method !== "POST" ||
          new URL(request.url).pathname !== "/stop" ||
          request.headers.get("authorization") !== `Bearer ${token}`
        )
          return new Response(null, { status: 403 });
        input.stop();
        return Response.json({ accepted: true });
      },
    });
    instance.server.unref();
    instance.metadata.control = { url: `http://127.0.0.1:${instance.server.port}/stop`, token };
    try {
      await fs.writeFile(
        path.join(instance.directory, "runtime.json"),
        JSON.stringify(instance.metadata),
        { flag: "wx", mode: 0o600 },
      );
      instance.timer = setInterval(() => instance.persist(), 2000);
      instance.timer.unref();
      return instance;
    } catch (error) {
      await instance.server.stop(true);
      throw error;
    }
  }

  private enqueue(write: () => Promise<void>): void {
    // 保留首次失败，同时继续尝试后续终态；失败不会成为未处理的 Promise 拒绝。
    this.queue = this.queue.then(write).catch((error) => {
      if (!this.hasFailure) {
        this.hasFailure = true;
        this.failure = error;
      }
    });
  }
  private persist(): void {
    this.metadata.heartbeatAt = new Date().toISOString();
    const content = JSON.stringify(this.metadata);
    this.enqueue(async () => {
      const file = path.join(this.directory, "runtime.json");
      await fs.writeFile(`${file}.tmp`, content, { mode: 0o600 });
      await fs.rename(`${file}.tmp`, file);
    });
  }
  state(state: "running" | "finalizing"): void {
    this.metadata.state = state;
    this.persist();
  }
  append(text: string): void {
    const entry: ConsoleChunk = {
      seq: ++this.seq,
      timestamp: new Date().toISOString(),
      text: `${text}\n`,
    };
    this.enqueue(() =>
      fs.appendFile(path.join(this.directory, "console.jsonl"), `${JSON.stringify(entry)}\n`, {
        mode: 0o600,
      }),
    );
  }
  async finish(
    state: Extract<RunState, "completed" | "failed" | "cancelled">,
    errorCode?: string,
  ): Promise<void> {
    clearInterval(this.timer);
    // 先等已有日志／心跳落盘；即使只有一次瞬时写失败，也不能发布成功运行快照。
    await this.queue;
    this.metadata.state = this.hasFailure ? "failed" : state;
    this.metadata.endedAt = new Date().toISOString();
    if (this.hasFailure) this.metadata.errorCode = "run_recording_failed";
    else if (errorCode) this.metadata.errorCode = errorCode;
    delete this.metadata.control;
    this.persist();
    try {
      await this.queue;
    } finally {
      await this.server?.stop(true);
    }
    if (this.hasFailure) throw this.failure;
  }
}
