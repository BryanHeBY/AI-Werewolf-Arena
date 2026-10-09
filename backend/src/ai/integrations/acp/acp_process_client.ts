import { spawn, ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { Readable, Writable } from "node:stream";
import * as acp from "@agentclientprotocol/sdk";
import { AcpTurnRegistry } from "./acp_turn_registry";
import { WerewolfMcpControlServer } from "./werewolf_mcp_control";
import { AcpMcpBridgeFactory, AcpMcpControlServer } from "./acp_mcp_bridge";
import { applyAcpSessionConfigOptions } from "./acp_session_config";
import {
  AcpSession,
  AcpSessionAuditTrace,
  AcpSessionCreateInput,
  AcpSessionFactory,
  AcpProcessClientOptions,
  AcpSessionUpdate,
} from "./session";
import { AcpInitializationCleanupError, closeAcpSession } from "./session_lifecycle";
import { awaitBeforeDeadline, awaitWithAbort } from "../../runtime/turn_deadline";

const ACP_CANCEL_TIMEOUT_MS = 300;
const ACP_SESSION_CLOSE_TIMEOUT_MS = 1_000;
// codex-acp notices stdin closure and gives its nested Codex process two seconds
// to stop before killing it. Leave a small margin for that intentional teardown.
const ACP_PROCESS_GRACEFUL_EXIT_TIMEOUT_MS = 2_500;
const ACP_PROCESS_TERMINATE_TIMEOUT_MS = 750;
const ACP_PROCESS_KILL_TIMEOUT_MS = 750;
const ACP_AUDIT_TEXT_MAX_CHARS = 4_000;
const ACP_INITIALIZE_TIMEOUT_MS = 45_000;
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
  } catch (error) {
    // The process group can exit between the state check and signal delivery.
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
  }
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
      if (processSession) return closeAcpSession(processSession, true);
      const failures: unknown[] = [];
      try { connection?.close(); } catch (error) { failures.push(error); }
      if (child) {
        try { signalProcess(child, "SIGKILL"); } catch (error) { failures.push(error); }
        child.stdin?.destroy();
        child.stdout?.destroy();
        child.stderr?.destroy();
        if (!await waitForProcessExit(child, ACP_PROCESS_KILL_TIMEOUT_MS)) failures.push(new Error("acp_process_did_not_exit"));
        child.unref();
      }
      if (mcpControl) try { await awaitBeforeDeadline(() => mcpControl!.close({ force: true }), Date.now() + ACP_SESSION_CLOSE_TIMEOUT_MS); } catch (error) { failures.push(error); }
      if (failures.length) throw new AggregateError(failures, "acp_initialization_resource_close_failed");
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
        await awaitBeforeDeadline(() => control.close({ force: true }), Date.now() + ACP_SESSION_CLOSE_TIMEOUT_MS);
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
        // Node converts the binary stdout pipe to a WHATWG byte stream.
        // Bun and @types/node declare incompatible getReader overloads for that same runtime object.
        Readable.toWeb(spawnedChild.stdout) as unknown as Parameters<typeof acp.ndJsonStream>[1],
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
      await applyAcpSessionConfigOptions(
        protocolConnection.agent,
        session,
        this.options.sessionConfigOptions ?? {},
      );
      const registrySessionId = randomUUID();
      control.bindSession(registrySessionId);
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
        this.options.onPromptEnd,
        registrySessionId,
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
      return await awaitWithAbort(task, controller.signal);
    } catch (error) {
      controller.abort(error);
      try { await cleanup(); } catch (cleanupError) { throw new AcpInitializationCleanupError(error, cleanupError); }
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
  private closing?: Promise<void>;
  private reclaimed = false;
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
    private readonly onPromptEnd?: (actorId: number) => void,
    private readonly registrySessionId = session.sessionId,
  ) {}

  get sessionId(): string {
    return this.registrySessionId;
  }

  async prompt(text: string): Promise<void> {
    if (this.closed) throw new Error("acp_session_closed");
    this.resetAuditTrace();
    const prompt = this.session.prompt(text);
    const updates = this.consumeUpdates().catch(() => undefined);
    try {
      await prompt;
    } finally {
      await updates;
    }
  }

  async cancel(): Promise<void> {
    if (!this.closed && this.process.exitCode === null && this.process.signalCode === null) {
      await awaitBeforeDeadline(() => this.client.notify(acp.methods.agent.session.cancel, { sessionId: this.session.sessionId }), Date.now() + ACP_CANCEL_TIMEOUT_MS);
    }
  }

  async close(options: { force?: boolean } = {}): Promise<void> {
    let forcedError: unknown;
    let forceFailed = false;
    // A force request must still reach a process already in graceful teardown.
    if (options.force && !this.reclaimed) try { signalProcess(this.process, "SIGKILL"); } catch (error) { forcedError = error; forceFailed = true; }
    if (!this.closing) {
      this.closed = true;
      this.closing = this.closeResources(options.force ?? false);
    }
    try { await this.closing; }
    catch (error) { if (forceFailed) throw new AggregateError([forcedError, error], "acp_process_close_failed"); throw error; }
    if (forceFailed) throw forcedError;
  }

  private async closeResources(force: boolean): Promise<void> {
    const failures: unknown[] = [];
    if (!force && this.process.exitCode === null && this.process.signalCode === null) {
      try {
        await awaitBeforeDeadline(() => this.client.notify(acp.methods.agent.session.cancel, { sessionId: this.session.sessionId }), Date.now() + ACP_CANCEL_TIMEOUT_MS);
      } catch (error) { failures.push(error); }
      if (this.supportsSessionClose) try {
        await awaitBeforeDeadline(() => this.client.request(acp.methods.agent.session.close, { sessionId: this.session.sessionId }), Date.now() + ACP_SESSION_CLOSE_TIMEOUT_MS);
      } catch (error) { failures.push(error); }
    }
    try { this.session.dispose(); } catch (error) { failures.push(error); }
    try { this.connection?.close(); } catch (error) { failures.push(error); }
    try { this.process.stdin?.end(); } catch (error) { failures.push(error); }
    let exited = await waitForProcessExit(this.process, force ? ACP_PROCESS_KILL_TIMEOUT_MS : ACP_PROCESS_GRACEFUL_EXIT_TIMEOUT_MS);
    if (!exited) {
      try { signalProcess(this.process, "SIGTERM"); } catch (error) { failures.push(error); }
      exited = await waitForProcessExit(this.process, ACP_PROCESS_TERMINATE_TIMEOUT_MS);
    }
    if (!exited) {
      try { signalProcess(this.process, "SIGKILL"); } catch (error) { failures.push(error); }
      exited = await waitForProcessExit(this.process, ACP_PROCESS_KILL_TIMEOUT_MS);
    }
    if (!exited) {
      failures.push(new Error("acp_process_did_not_exit"));
      this.process.stdin?.destroy(); this.process.stdout?.destroy(); this.process.stderr?.destroy(); this.process.unref();
    }
    // Descendants can outlive the root. Reclaim the owned process group too.
    try { signalProcess(this.process, "SIGKILL"); } catch (error) { failures.push(error); }
    let controlClosed = !this.mcpControl;
    if (this.mcpControl) try {
      await awaitBeforeDeadline(() => this.mcpControl!.close({ force: true }), Date.now() + ACP_SESSION_CLOSE_TIMEOUT_MS);
      controlClosed = true;
    } catch (error) { failures.push(error); }
    this.reclaimed = exited && controlClosed;
    if (failures.length) throw new AggregateError(failures, "acp_process_close_failed");
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
    try {
      for (;;) {
        const message = await this.session.nextUpdate();
        if (message.kind === "stop") return;
        this.trackInjectedMcpToolCall(message.update);
        this.captureAuditUpdate(message.update);
        this.onUpdate?.({ actorId: this.actorId, update: message.update });
      }
    } finally {
      this.flushAuditMessage();
      this.onPromptEnd?.(this.actorId);
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
