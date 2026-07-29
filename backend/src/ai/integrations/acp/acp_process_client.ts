import { spawn, ChildProcess } from "node:child_process";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { Readable, Writable } from "node:stream";
import * as acp from "@agentclientprotocol/sdk";
import { AcpTurnRegistry } from "./acp_turn_registry";
import { WerewolfMcpControlServer } from "./werewolf_mcp_control";

const ACP_CANCEL_TIMEOUT_MS = 300;
const ACP_SESSION_CLOSE_TIMEOUT_MS = 1_000;
// codex-acp notices stdin closure and gives its nested Codex process two seconds
// to stop before killing it. Leave a small margin for that intentional teardown.
const ACP_PROCESS_GRACEFUL_EXIT_TIMEOUT_MS = 2_500;
const ACP_PROCESS_TERMINATE_TIMEOUT_MS = 750;
const ACP_PROCESS_KILL_TIMEOUT_MS = 750;

async function settleWithin(promise: Promise<unknown>, timeoutMs: number): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise.then(
        () => true,
        () => false,
      ),
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(false), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

async function waitForProcessExit(process: ChildProcess, timeoutMs: number): Promise<boolean> {
  if (process.exitCode !== null || process.signalCode !== null) {
    return true;
  }
  return new Promise((resolve) => {
    const onExit = () => finish(true);
    const timer = setTimeout(() => finish(false), timeoutMs);
    const finish = (exited: boolean) => {
      clearTimeout(timer);
      process.off("exit", onExit);
      resolve(exited);
    };
    process.once("exit", onExit);
  });
}

function signalProcess(process: ChildProcess, signal: NodeJS.Signals): void {
  if (process.exitCode !== null || process.signalCode !== null) {
    return;
  }
  try {
    process.kill(signal);
  } catch {
    // The process can exit between the state check and signal delivery.
  }
}

export interface AcpSessionUpdate {
  actorId: number;
  update: unknown;
}

export interface AcpSession {
  readonly sessionId: string;
  prompt(text: string): Promise<void>;
  cancel(): Promise<void>;
  close(): Promise<void>;
}

export interface AcpSessionFactory {
  createSession(input: {
    actorId: number;
    registry: AcpTurnRegistry;
    /** 仅在 session 创建后注入一次的固定协议/身份提示。 */
    initialPrompt?: string;
  }): Promise<AcpSession>;
}

export interface AcpProcessClientOptions {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd: string;
  onUpdate?: (update: AcpSessionUpdate) => void;
}

/** ACP stdio client. One instance/session is intentionally created per player. */
export class AcpProcessClient implements AcpSessionFactory {
  constructor(private readonly options: AcpProcessClientOptions) {}

  async createSession(input: {
    actorId: number;
    registry: AcpTurnRegistry;
    initialPrompt?: string;
  }): Promise<AcpSession> {
    await fs.mkdir(this.options.cwd, { recursive: true });
    const mcpControl = new WerewolfMcpControlServer(input.registry);
    const mcpServer = await mcpControl.start(
      process.execPath,
      [this.werewolfMcpEntrypoint()],
    );
    const child = spawn(this.options.command, this.options.args ?? [], {
      cwd: this.options.cwd,
      // 游戏 MCP sidecar 由当前 Bun/Node runtime 执行。外层 bwrap runner 据此只读
      // 挂载真实可执行文件目录，避免假定用户的 Bun 固定安装在某一路径。
      env: {
        ...process.env,
        ...this.options.env,
        ACP_MCP_RUNTIME_EXECUTABLE: process.execPath,
      },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let childError: Error | null = null;
    child.on("error", (error) => {
      childError = error;
    });
    if (!child.stdin || !child.stdout) {
      child.kill();
      throw new Error("acp_agent_stdio_unavailable");
    }

    const stream = acp.ndJsonStream(
      Writable.toWeb(child.stdin),
      Readable.toWeb(child.stdout) as ReadableStream<Uint8Array>,
    );
    let activeSessionId: string | null = null;
    // ACP adapters such as codex-acp ask for an explicit permission immediately
    // before invoking an MCP tool. Remember only tool calls announced by our
    // injected server, so an adapter cannot turn a generic MCP approval into
    // approval for some other configured server.
    const approvedWerewolfMcpToolCallIds = new Set<string>();
    const connection = acp
      .client({ name: "ai-werewolf-arena" })
      .onRequest(acp.methods.client.session.requestPermission, async ({ params: request }) => {
        // Codex 将 MCP tool approval 也转为 ACP permission request。游戏只允许
        // 已注入 MCP 工具的调用；终端、文件修改和额外权限请求仍一律取消。
        if (
          request._meta?.is_mcp_tool_approval === true
          && approvedWerewolfMcpToolCallIds.has(request.toolCall.toolCallId)
        ) {
          const option = request.options.find((item) => item.optionId === "allow_session")
            ?? request.options.find((item) => item.kind === "allow_once");
          if (option) {
            return {
              outcome: { outcome: "selected" as const, optionId: option.optionId },
            };
          }
        }
        return { outcome: { outcome: "cancelled" as const } };
      })
      .connect(stream);

    try {
      if (childError) {
        throw childError;
      }
      const initializeResponse = await connection.agent.request(acp.methods.agent.initialize, {
        protocolVersion: acp.PROTOCOL_VERSION,
        clientCapabilities: {},
      });
      const session = await connection.agent.buildSession({
        cwd: this.options.cwd,
        mcpServers: [mcpServer],
      }).start();
      activeSessionId = session.sessionId;
      mcpControl.bindSession(activeSessionId);
      const processSession = new AcpProcessSession(
        session,
        connection.agent,
        child,
        input.actorId,
        this.options.onUpdate,
        mcpControl,
        approvedWerewolfMcpToolCallIds,
        connection,
        initializeResponse.agentCapabilities?.sessionCapabilities?.close != null,
      );
      if (input.initialPrompt?.trim()) {
        await processSession.prompt(input.initialPrompt);
      }
      return processSession;
    } catch (error) {
      connection.close(error);
      child.kill();
      await mcpControl.close();
      throw error;
    }
  }

  private werewolfMcpEntrypoint(): string {
    const extension = path.extname(__filename) === ".ts" ? ".ts" : ".js";
    return path.join(__dirname, `werewolf_mcp_server${extension}`);
  }
}

class AcpProcessSession implements AcpSession {
  private closed = false;

  constructor(
    private readonly session: acp.ActiveSession,
    private readonly client: acp.ClientContext,
    private readonly process: ChildProcess,
    private readonly actorId: number,
    private readonly onUpdate?: (update: AcpSessionUpdate) => void,
    private readonly mcpControl?: WerewolfMcpControlServer,
    private readonly approvedWerewolfMcpToolCallIds?: Set<string>,
    private readonly connection?: acp.ClientConnection,
    private readonly supportsSessionClose = false,
  ) {}

  get sessionId(): string {
    return this.session.sessionId;
  }

  async prompt(text: string): Promise<void> {
    const prompt = this.session.prompt(text);
    void this.consumeUpdates();
    await prompt;
  }

  async cancel(): Promise<void> {
    if (!this.closed) {
      await this.client.notify(acp.methods.agent.session.cancel, { sessionId: this.session.sessionId });
    }
  }

  async close(): Promise<void> {
    if (this.closed) {
      return;
    }
    this.closed = true;
    try {
      await settleWithin(
        this.client.notify(acp.methods.agent.session.cancel, { sessionId: this.session.sessionId }),
        ACP_CANCEL_TIMEOUT_MS,
      );
      if (this.supportsSessionClose) {
        await settleWithin(
          this.client.request(acp.methods.agent.session.close, { sessionId: this.session.sessionId }),
          ACP_SESSION_CLOSE_TIMEOUT_MS,
        );
      }
    } finally {
      this.session.dispose();
      // Closing the transport closes stdin. codex-acp treats that as shutdown and
      // gives its nested Codex process a short graceful window before terminating it.
      this.connection?.close();
      this.process.stdin?.end();

      let exited = await waitForProcessExit(
        this.process,
        ACP_PROCESS_GRACEFUL_EXIT_TIMEOUT_MS,
      );
      if (!exited) {
        signalProcess(this.process, "SIGTERM");
        exited = await waitForProcessExit(this.process, ACP_PROCESS_TERMINATE_TIMEOUT_MS);
      }
      if (!exited) {
        signalProcess(this.process, "SIGKILL");
        exited = await waitForProcessExit(this.process, ACP_PROCESS_KILL_TIMEOUT_MS);
      }
      if (!exited) {
        // Do not let a non-cooperative external agent retain this game's event loop.
        this.process.stdin?.destroy();
        this.process.stdout?.destroy();
        this.process.stderr?.destroy();
        this.process.unref();
      }
      await this.mcpControl?.close({ force: true });
    }
  }

  private async consumeUpdates(): Promise<void> {
    for (;;) {
      const message = await this.session.nextUpdate();
      if (message.kind === "stop") {
        return;
      }
      this.trackInjectedMcpToolCall(message.update);
      this.onUpdate?.({ actorId: this.actorId, update: message.update });
    }
  }

  private trackInjectedMcpToolCall(update: unknown): void {
    if (!this.approvedWerewolfMcpToolCallIds || !update || typeof update !== "object") {
      return;
    }
    const event = update as {
      sessionUpdate?: unknown;
      toolCallId?: unknown;
      rawInput?: { server?: unknown };
      status?: unknown;
    };
    if (
      event.sessionUpdate === "tool_call"
      && event.rawInput?.server === "werewolf-game"
      && typeof event.toolCallId === "string"
    ) {
      this.approvedWerewolfMcpToolCallIds.add(event.toolCallId);
      return;
    }
    if (
      event.sessionUpdate === "tool_call_update"
      && typeof event.toolCallId === "string"
      && (event.status === "completed" || event.status === "failed")
    ) {
      this.approvedWerewolfMcpToolCallIds.delete(event.toolCallId);
    }
  }
}
