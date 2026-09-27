import { spawn, ChildProcess } from "node:child_process";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { Readable, Writable } from "node:stream";
import * as acp from "@agentclientprotocol/sdk";
import { AcpTurnRegistry } from "./acp_turn_registry";
import { WerewolfMcpControlServer } from "./werewolf_mcp_control";
import { AcpMcpBridgeFactory, AcpMcpControlServer } from "./acp_mcp_bridge";
import {
  AcpSessionConfigOptionValue,
  applyAcpSessionConfigOptions,
} from "./acp_session_config";

const ACP_CANCEL_TIMEOUT_MS = 300;
const ACP_SESSION_CLOSE_TIMEOUT_MS = 1_000;
// codex-acp notices stdin closure and gives its nested Codex process two seconds
// to stop before killing it. Leave a small margin for that intentional teardown.
const ACP_PROCESS_GRACEFUL_EXIT_TIMEOUT_MS = 2_500;
const ACP_PROCESS_TERMINATE_TIMEOUT_MS = 750;
const ACP_PROCESS_KILL_TIMEOUT_MS = 750;
const ACP_AUDIT_TEXT_MAX_CHARS = 4_000;
const ACP_INITIALIZE_TIMEOUT_MS = 45_000;
export const ACP_CLOSE_TIMEOUT_MS = 6_000;


export function awaitAcpOperation<T>(task: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason ?? new Error("acp_operation_aborted"));
    if (signal.aborted) {
      void task.catch(() => undefined);
      abort();
      return;
    }
    signal.addEventListener("abort", abort, { once: true });
    void task.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}

export async function closeAcpSession(session: AcpSession, force = false): Promise<void> {
  await settleAcpWithin(Promise.resolve().then(() => session.close({ force })), ACP_CLOSE_TIMEOUT_MS);
}

export async function settleAcpWithin(promise: Promise<unknown>, timeoutMs: number): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise.then(() => true, () => false),
      new Promise<boolean>((resolve) => { timer = setTimeout(() => resolve(false), timeoutMs); }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
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

function signalProcess(child: ChildProcess, signal: NodeJS.Signals): void {
  try {
    if (process.platform !== "win32" && child.pid !== undefined) {
      process.kill(-child.pid, signal);
    } else if (child.exitCode === null && child.signalCode === null) {
      child.kill(signal);
    }
  } catch {
    // The process group can exit between the state check and signal delivery.
  }
}

export interface AcpSessionUpdate {
  actorId: number;
  update: unknown;
}

/** ACP 回合结束后供复盘记录器读取的限长语义轨迹。 */
export interface AcpSessionAuditTrace {
  messages: string[];
  thoughts: string[];
}

export interface AcpSession {
  readonly sessionId: string;
  prompt(text: string): Promise<void>;
  cancel(): Promise<void>;
  close(options?: { force?: boolean }): Promise<void>;
  /** 返回并清空最近一次 prompt 的语义轨迹；适配器可不实现。 */
  takeAuditTrace?(): AcpSessionAuditTrace;
}

export interface AcpSessionCreateInput<TRegistry = AcpTurnRegistry> {
  actorId: number;
  registry: TRegistry;
  /** Fixed identity/protocol prompt; part of initialization's deadline. */
  initialPrompt?: string;
  deadlineAtMs?: number;
  signal?: AbortSignal;
}

export interface AcpSessionFactory<TRegistry = AcpTurnRegistry> {
  createSession(input: AcpSessionCreateInput<TRegistry>): Promise<AcpSession>;
}

export interface AcpProcessClientOptions<TRegistry = AcpTurnRegistry> {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd: string;
  initializeTimeoutMs?: number;
  onUpdate?: (update: AcpSessionUpdate) => void;
  mcpBridge?: AcpMcpBridgeFactory<TRegistry>;
  /** session/new 后通过标准 ACP session/set_config_option 应用。 */
  sessionConfigOptions?: Record<string, AcpSessionConfigOptionValue>;
}

/** ACP stdio client. One instance/session is intentionally created per player. */
export class AcpProcessClient<TRegistry = AcpTurnRegistry>
  implements AcpSessionFactory<TRegistry> {
  constructor(private readonly options: AcpProcessClientOptions<TRegistry>) {}

  async createSession(input: AcpSessionCreateInput<TRegistry>): Promise<AcpSession> {
    const controller = new AbortController();
    const deadlineAt = Math.min(
      input.deadlineAtMs ?? Infinity,
      Date.now() + (this.options.initializeTimeoutMs ?? ACP_INITIALIZE_TIMEOUT_MS),
    );
    const abort = () => controller.abort(input.signal?.reason ?? new Error("acp_initialization_aborted"));
    input.signal?.addEventListener("abort", abort, { once: true });
    if (input.signal?.aborted) abort();
    const timeout = setTimeout(() => controller.abort(new Error("acp_initialize_timeout")), Math.max(0, deadlineAt - Date.now()));
    if (deadlineAt <= Date.now()) controller.abort(new Error("acp_initialize_timeout"));
    let child: ChildProcess | undefined;
    let mcpControl: AcpMcpControlServer | undefined;
    let connection: acp.ClientConnection | undefined;
    let processSession: AcpProcessSession | undefined;
    const cleanup = async () => {
      if (processSession) return processSession.close({ force: true });
      connection?.close();
      if (child) {
        signalProcess(child, "SIGKILL");
        child.stdin?.destroy();
        child.stdout?.destroy();
        child.stderr?.destroy();
        await waitForProcessExit(child, ACP_PROCESS_KILL_TIMEOUT_MS);
        child.unref();
      }
      if (mcpControl) await settleAcpWithin(mcpControl.close({ force: true }), ACP_SESSION_CLOSE_TIMEOUT_MS);
    };
    const initialize = async (): Promise<AcpSession> => {
      controller.signal.throwIfAborted();
      await fs.mkdir(this.options.cwd, { recursive: true });
      controller.signal.throwIfAborted();
      const bridge = this.options.mcpBridge ?? this.defaultWerewolfBridge();
      const control = bridge.createControl(input.registry);
      mcpControl = control;
      const mcpServer = await control.start(
        process.execPath,
        [bridge.serverEntrypoint(__filename)],
      );
      if (controller.signal.aborted) {
        await control.close({ force: true });
        controller.signal.throwIfAborted();
      }
      child = spawn(this.options.command, this.options.args ?? [], {
        cwd: this.options.cwd,
        env: { ...process.env, ...this.options.env, ACP_MCP_RUNTIME_EXECUTABLE: process.execPath },
        detached: process.platform !== "win32",
        stdio: ["pipe", "pipe", "pipe"],
      });
      child.on("error", (error) => controller.abort(error));
      child.stderr?.resume();
      if (!child.stdin || !child.stdout) throw new Error("acp_agent_stdio_unavailable");

      const spawnedChild = child;
      if (!spawnedChild.stdin || !spawnedChild.stdout) throw new Error("acp_agent_stdio_unavailable");

      const stream = acp.ndJsonStream(
        Writable.toWeb(spawnedChild.stdin),
        Readable.toWeb(spawnedChild.stdout) as ReadableStream<Uint8Array>,
      );
      // ACP adapters such as codex-acp ask for an explicit permission immediately
      // before invoking an MCP tool. Remember only tool calls announced by our
      // injected server, so an adapter cannot turn a generic MCP approval into
      // approval for some other configured server.
      const approvedInjectedMcpToolCallIds = new Set<string>();
      const protocolConnection = acp
        .client({ name: "ai-werewolf-arena" })
        .onRequest(acp.methods.client.session.requestPermission, async ({ params: request }) => {
          if (
            request._meta?.is_mcp_tool_approval === true
            && approvedInjectedMcpToolCallIds.has(request.toolCall.toolCallId)
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
      connection = protocolConnection;

      controller.signal.throwIfAborted();
      const initializeResponse = await protocolConnection.agent.request(acp.methods.agent.initialize, {
        protocolVersion: acp.PROTOCOL_VERSION,
        clientCapabilities: {
          session: { configOptions: { boolean: {} } },
        },
      });
      controller.signal.throwIfAborted();
      const session = await protocolConnection.agent.buildSession({
        cwd: this.options.cwd,
        mcpServers: [mcpServer],
      }).start();
      controller.signal.throwIfAborted();
      const activeSessionId = session.sessionId;
      await applyAcpSessionConfigOptions(
        protocolConnection.agent,
        session,
        this.options.sessionConfigOptions ?? {},
      );
      control.bindSession(activeSessionId);
      const createdSession = new AcpProcessSession(
        session,
        protocolConnection.agent,
        spawnedChild,
        input.actorId,
        this.options.onUpdate,
        control,
        approvedInjectedMcpToolCallIds,
        bridge.serverName,
        protocolConnection,
        initializeResponse.agentCapabilities?.sessionCapabilities?.close != null,
      );
      processSession = createdSession;
      controller.signal.throwIfAborted();
      if (input.initialPrompt?.trim()) {
        await createdSession.prompt(input.initialPrompt);
        // 初始化回复不属于任何游戏回合，不混入首回合审计。
        createdSession.takeAuditTrace();
      }
      return createdSession;
    };
    try {
      const task = initialize();
      void task.then((session) => {
        if (controller.signal.aborted) void closeAcpSession(session, true);
      }, () => undefined);
      return await awaitAcpOperation(task, controller.signal);
    } catch (error) {
      controller.abort(error);
      await cleanup();
      throw error;
    } finally {
      clearTimeout(timeout);
      input.signal?.removeEventListener("abort", abort);
    }
  }

  private defaultWerewolfBridge(): AcpMcpBridgeFactory<TRegistry> {
    return {
      serverName: "werewolf-game",
      createControl: (registry) =>
        new WerewolfMcpControlServer(registry as unknown as AcpTurnRegistry),
      serverEntrypoint: (currentFilename) => {
        const extension = path.extname(currentFilename) === ".ts" ? ".ts" : ".js";
        return path.join(path.dirname(currentFilename), `werewolf_mcp_server${extension}`);
      },
    };
  }
}

class AcpProcessSession implements AcpSession {
  private closed = false;
  private auditMessages: string[] = [];
  private auditThoughtText = "";
  private auditMessageId: string | null = null;
  private auditMessageText = "";

  constructor(
    private readonly session: acp.ActiveSession,
    private readonly client: acp.ClientContext,
    private readonly process: ChildProcess,
    private readonly actorId: number,
    private readonly onUpdate?: (update: AcpSessionUpdate) => void,
    private readonly mcpControl?: AcpMcpControlServer,
    private readonly approvedInjectedMcpToolCallIds?: Set<string>,
    private readonly approvedMcpServerName = "werewolf-game",
    private readonly connection?: acp.ClientConnection,
    private readonly supportsSessionClose = false,
  ) {}

  get sessionId(): string {
    return this.session.sessionId;
  }

  async prompt(text: string): Promise<void> {
    if (this.closed) throw new Error("acp_session_closed");
    this.resetAuditTrace();
    const prompt = this.session.prompt(text);
    void this.consumeUpdates().catch(() => undefined);
    await prompt;
  }

  async cancel(): Promise<void> {
    if (!this.closed) {
      await settleAcpWithin(this.client.notify(acp.methods.agent.session.cancel, { sessionId: this.session.sessionId }), ACP_CANCEL_TIMEOUT_MS);
    }
  }

  async close(options: { force?: boolean } = {}): Promise<void> {
    if (this.closed) {
      return;
    }
    this.closed = true;
    if (options.force) signalProcess(this.process, "SIGKILL");
    try {
      if (!options.force) {
        await settleAcpWithin(
          this.client.notify(acp.methods.agent.session.cancel, { sessionId: this.session.sessionId }),
          ACP_CANCEL_TIMEOUT_MS,
        );
        if (this.supportsSessionClose) {
          await settleAcpWithin(
            this.client.request(acp.methods.agent.session.close, { sessionId: this.session.sessionId }),
            ACP_SESSION_CLOSE_TIMEOUT_MS,
          );
        }
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
      // The ACP root can exit before MCP descendants release their process group.
      signalProcess(this.process, "SIGKILL");
      if (this.mcpControl) await settleAcpWithin(this.mcpControl.close({ force: true }), ACP_SESSION_CLOSE_TIMEOUT_MS);
    }
  }

  takeAuditTrace(): AcpSessionAuditTrace {
    this.flushAuditMessage();
    const trace = {
      messages: [...this.auditMessages],
      thoughts: this.auditThoughtText ? [this.normalizeAuditText(this.auditThoughtText)] : [],
    };
    this.resetAuditTrace();
    return trace;
  }

  private async consumeUpdates(): Promise<void> {
    for (;;) {
      const message = await this.session.nextUpdate();
      if (message.kind === "stop") {
        this.flushAuditMessage();
        return;
      }
      this.trackInjectedMcpToolCall(message.update);
      this.captureAuditUpdate(message.update);
      this.onUpdate?.({ actorId: this.actorId, update: message.update });
    }
  }

  private captureAuditUpdate(update: unknown): void {
    if (!update || typeof update !== "object") return;
    const event = update as Record<string, unknown>;
    if (event.sessionUpdate === "agent_message_chunk") {
      const messageId = typeof event.messageId === "string" ? event.messageId : "unknown";
      if (this.auditMessageId !== null && this.auditMessageId !== messageId) {
        this.flushAuditMessage();
      }
      this.auditMessageId = messageId;
      this.auditMessageText = this.appendAuditText(
        this.auditMessageText,
        this.readAuditText(event.content),
      );
      return;
    }
    if (event.sessionUpdate === "agent_thought_chunk") {
      this.auditThoughtText = this.appendAuditText(
        this.auditThoughtText,
        this.readAuditText(event.content),
      );
    }
  }

  private flushAuditMessage(): void {
    const text = this.normalizeAuditText(this.auditMessageText);
    if (text && !/^\*?conversation interrupted\*?$/i.test(text)) {
      const used = this.auditMessages.reduce((total, item) => total + item.length, 0);
      const remaining = ACP_AUDIT_TEXT_MAX_CHARS - used;
      if (remaining > 0) this.auditMessages.push(text.slice(0, remaining));
    }
    this.auditMessageId = null;
    this.auditMessageText = "";
  }

  private resetAuditTrace(): void {
    this.auditMessages = [];
    this.auditThoughtText = "";
    this.auditMessageId = null;
    this.auditMessageText = "";
  }

  private appendAuditText(current: string, chunk: string): string {
    if (!chunk || current.length >= ACP_AUDIT_TEXT_MAX_CHARS) return current;
    return `${current}${chunk}`.slice(0, ACP_AUDIT_TEXT_MAX_CHARS);
  }

  private normalizeAuditText(value: string): string {
    return value.replace(/\s+/g, " ").trim().slice(0, ACP_AUDIT_TEXT_MAX_CHARS);
  }

  private readAuditText(value: unknown): string {
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.map((item) => this.readAuditText(item)).join("");
    if (!value || typeof value !== "object") return "";
    const record = value as Record<string, unknown>;
    if (typeof record.text === "string") return record.text;
    if (typeof record.content === "string") return record.content;
    return "";
  }

  private trackInjectedMcpToolCall(update: unknown): void {
    if (!this.approvedInjectedMcpToolCallIds || !update || typeof update !== "object") {
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
      && event.rawInput?.server === this.approvedMcpServerName
      && typeof event.toolCallId === "string"
    ) {
      this.approvedInjectedMcpToolCallIds.add(event.toolCallId);
      return;
    }
    if (
      event.sessionUpdate === "tool_call_update"
      && typeof event.toolCallId === "string"
      && (event.status === "completed" || event.status === "failed")
    ) {
      this.approvedInjectedMcpToolCallIds.delete(event.toolCallId);
    }
  }
}
