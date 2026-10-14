/**
 * 负责 ACP stdio 会话创建、协议连接、进程与 MCP 控制面的关闭；输入原工厂配置、registry、玩家与创建期限。
 * 输出原会话或创建／清理失败；游戏回合和行动授权归调用方 registry，不从文本或更新提交行动。
 * 创建期限取外部绝对期限与初始化预算的较早值；创建等待中止不抢占底层 Promise，迟到资源和有界关闭仍沿原所有者处理。
 * 本模块拥有子进程、连接和控制面；已发生的配置／资源副作用不回滚，收尾失败保留原错误并继续汇总。
 */
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
// codex-acp 收到 stdin 关闭后给其嵌套 Codex 进程两秒退出；这里为该收尾预留少量余量。
const ACP_PROCESS_GRACEFUL_EXIT_TIMEOUT_MS = 2_500;
const ACP_PROCESS_TERMINATE_TIMEOUT_MS = 750;
const ACP_PROCESS_KILL_TIMEOUT_MS = 750;
const ACP_AUDIT_TEXT_MAX_CHARS = 4_000;
const ACP_INITIALIZE_TIMEOUT_MS = 45_000;
/** 只等根进程的退出状态／事件；超时返回 false，清自己的计时器和监听器，不发送终止信号。 */
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
    // 状态检查与信号投递之间进程组可能已退出；只忽略 ESRCH，其余失败仍交关闭路径处理。
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
  }
}

/** 每次创建独立进程会话；玩家工厂按玩家装配，审计工厂按任务装配，复用与退役归各调用方。 */
export class AcpProcessClient<TRegistry = AcpTurnRegistry> implements AcpSessionFactory<TRegistry> {
  constructor(private readonly options: AcpProcessClientOptions<TRegistry>) {}

  async createSession(input: AcpSessionCreateInput<TRegistry>): Promise<AcpSession> {
    const controller = new AbortController();
    // 外部创建期限与本次初始化预算在这里合并；后续取消／关闭尝试使用各自原有时限。
    const deadlineAt = Math.min(
      input.deadlineAtMs ?? Infinity,
      Date.now() + (this.options.initializeTimeoutMs ?? ACP_INITIALIZE_TIMEOUT_MS),
    );
    const abort = () =>
      controller.abort(input.signal?.reason ?? new Error("acp_initialization_aborted"));
    input.signal?.addEventListener("abort", abort, { once: true });
    if (input.signal?.aborted) abort();
    const timeout = setTimeout(
      () => controller.abort(new Error("acp_initialize_timeout")),
      Math.max(0, deadlineAt - Date.now()),
    );
    if (deadlineAt <= Date.now()) controller.abort(new Error("acp_initialize_timeout"));
    let child: ChildProcess | undefined;
    let mcpControl: AcpMcpControlServer | undefined;
    let connection: acp.ClientConnection | undefined;
    let processSession: AcpProcessSession | undefined;
    // 只处理已经登记的原资源引用：先连接／进程，再控制面；失败累积，不把等待结束当全部回收成功。
    const cleanup = async () => {
      if (processSession) return closeAcpSession(processSession, true);
      const failures: unknown[] = [];
      try {
        connection?.close();
      } catch (error) {
        failures.push(error);
      }
      if (child) {
        try {
          signalProcess(child, "SIGKILL");
        } catch (error) {
          failures.push(error);
        }
        child.stdin?.destroy();
        child.stdout?.destroy();
        child.stderr?.destroy();
        if (!(await waitForProcessExit(child, ACP_PROCESS_KILL_TIMEOUT_MS)))
          failures.push(new Error("acp_process_did_not_exit"));
        child.unref();
      }
      if (mcpControl)
        try {
          await awaitBeforeDeadline(
            () => mcpControl!.close({ force: true }),
            Date.now() + ACP_SESSION_CLOSE_TIMEOUT_MS,
          );
        } catch (error) {
          failures.push(error);
        }
      if (failures.length)
        throw new AggregateError(failures, "acp_initialization_resource_close_failed");
    };
    const initialize = async (): Promise<AcpSession> => {
      controller.signal.throwIfAborted();
      await fs.mkdir(this.options.cwd, { recursive: true });
      controller.signal.throwIfAborted();
      const bridge = this.options.mcpBridge ?? this.defaultWerewolfBridge();
      const control = bridge.createControl(input.registry);
      // 先登记控制面再等待启动；启动后若已中止，仍先尝试关闭该控制面，再传播原中止原因。
      mcpControl = control;
      const mcpServer = await control.start(process.execPath, [
        bridge.serverEntrypoint(__filename),
      ]);
      if (controller.signal.aborted) {
        await awaitBeforeDeadline(
          () => control.close({ force: true }),
          Date.now() + ACP_SESSION_CLOSE_TIMEOUT_MS,
        );
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
      if (!spawnedChild.stdin || !spawnedChild.stdout)
        throw new Error("acp_agent_stdio_unavailable");

      const stream = acp.ndJsonStream(
        Writable.toWeb(spawnedChild.stdin),
        // Node 将 stdout 管道转为 WHATWG 字节流；Bun 与 @types/node 的 getReader 类型重载不兼容。
        // 此断言仅处理同一运行对象的类型差异，不转换流或改变协议读取。
        Readable.toWeb(spawnedChild.stdout) as unknown as Parameters<typeof acp.ndJsonStream>[1],
      );
      // ACP 适配器调用 MCP 前可能请求批准；这里只记录更新中声明来自注入 server 的 toolCallId。
      // 批准仍要求 MCP 标记与该登记 ID，并按原顺序选 allow_session／allow_once；领域许可另由 registry 复验。
      const approvedInjectedMcpToolCallIds = new Set<string>();
      const protocolConnection = acp
        .client({ name: "ai-werewolf-arena" })
        .onRequest(acp.methods.client.session.requestPermission, async ({ params: request }) => {
          if (
            request._meta?.is_mcp_tool_approval === true &&
            approvedInjectedMcpToolCallIds.has(request.toolCall.toolCallId)
          ) {
            const option =
              request.options.find((item) => item.optionId === "allow_session") ??
              request.options.find((item) => item.kind === "allow_once");
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
      const initializeResponse = await protocolConnection.agent.request(
        acp.methods.agent.initialize,
        {
          protocolVersion: acp.PROTOCOL_VERSION,
          clientCapabilities: {
            session: { configOptions: { boolean: {} } },
          },
        },
      );
      controller.signal.throwIfAborted();
      const session = await protocolConnection.agent
        .buildSession({
          cwd: this.options.cwd,
          mcpServers: [mcpServer],
        })
        .start();
      controller.signal.throwIfAborted();
      await applyAcpSessionConfigOptions(
        protocolConnection.agent,
        session,
        this.options.sessionConfigOptions ?? {},
      );
      // 配置应用完成后另建本机 registry 身份；它与 ACP wire sessionId 分开，控制面先绑定再交出会话。
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
      // 中止只拒绝这层等待，initialize 仍可能继续兑现；原检查点／cleanup 与调用方迟到退役负责后续处理。
      return await awaitWithAbort(task, controller.signal);
    } catch (error) {
      controller.abort(error);
      try {
        await cleanup();
      } catch (cleanupError) {
        // 清理失败不能吞掉创建主错误，按原对象保留两类失败；已有副作用不在这里补偿。
        throw new AcpInitializationCleanupError(error, cleanupError);
      }
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

/** 持有实际进程、协议会话和控制面；文本审计与工具批准登记不替代游戏回合的提交／授权。 */
class AcpProcessSession implements AcpSession {
  private closed = false;
  // closed 封住新 prompt，closing 复用首次关闭任务；reclaimed 只表示根进程退出且控制面关闭。
  private closing?: Promise<void>;
  private reclaimed = false;
  // 本次 prompt 的消息／思考缓冲与当前消息 ID；取审计 trace 后清空，不把文本解析成行动。
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
    // prompt 与 update 消费并行；finally 仍等 update，消费／回调失败按原策略接住，不表示会话已关闭。
    const updates = this.consumeUpdates().catch(() => undefined);
    try {
      await prompt;
    } finally {
      await updates;
    }
  }

  /** 只向仍活动的 ACP wire 会话发有界取消通知；不关闭 registry 回合、进程或 MCP 控制面。 */
  async cancel(): Promise<void> {
    if (!this.closed && this.process.exitCode === null && this.process.signalCode === null) {
      await awaitBeforeDeadline(
        () =>
          this.client.notify(acp.methods.agent.session.cancel, {
            sessionId: this.session.sessionId,
          }),
        Date.now() + ACP_CANCEL_TIMEOUT_MS,
      );
    }
  }

  async close(options: { force?: boolean } = {}): Promise<void> {
    let forcedError: unknown;
    let forceFailed = false;
    // 即使已有普通关闭任务，force 仍先尝试杀进程，再等待同一 closing；两类失败按原顺序保留。
    if (options.force && !this.reclaimed)
      try {
        signalProcess(this.process, "SIGKILL");
      } catch (error) {
        forcedError = error;
        forceFailed = true;
      }
    if (!this.closing) {
      this.closed = true;
      this.closing = this.closeResources(options.force ?? false);
    }
    try {
      await this.closing;
    } catch (error) {
      if (forceFailed) throw new AggregateError([forcedError, error], "acp_process_close_failed");
      throw error;
    }
    if (forceFailed) throw forcedError;
  }

  private async closeResources(force: boolean): Promise<void> {
    // 普通路径先尝试 cancel／可用的 session.close，再 dispose、断连接和 stdin；这些已捕获的失败不阻止其余收尾。
    const failures: unknown[] = [];
    if (!force && this.process.exitCode === null && this.process.signalCode === null) {
      try {
        await awaitBeforeDeadline(
          () =>
            this.client.notify(acp.methods.agent.session.cancel, {
              sessionId: this.session.sessionId,
            }),
          Date.now() + ACP_CANCEL_TIMEOUT_MS,
        );
      } catch (error) {
        failures.push(error);
      }
      if (this.supportsSessionClose)
        try {
          await awaitBeforeDeadline(
            () =>
              this.client.request(acp.methods.agent.session.close, {
                sessionId: this.session.sessionId,
              }),
            Date.now() + ACP_SESSION_CLOSE_TIMEOUT_MS,
          );
        } catch (error) {
          failures.push(error);
        }
    }
    try {
      this.session.dispose();
    } catch (error) {
      failures.push(error);
    }
    try {
      this.connection?.close();
    } catch (error) {
      failures.push(error);
    }
    try {
      this.process.stdin?.end();
    } catch (error) {
      failures.push(error);
    }
    let exited = await waitForProcessExit(
      this.process,
      force ? ACP_PROCESS_KILL_TIMEOUT_MS : ACP_PROCESS_GRACEFUL_EXIT_TIMEOUT_MS,
    );
    if (!exited) {
      try {
        signalProcess(this.process, "SIGTERM");
      } catch (error) {
        failures.push(error);
      }
      exited = await waitForProcessExit(this.process, ACP_PROCESS_TERMINATE_TIMEOUT_MS);
    }
    if (!exited) {
      try {
        signalProcess(this.process, "SIGKILL");
      } catch (error) {
        failures.push(error);
      }
      exited = await waitForProcessExit(this.process, ACP_PROCESS_KILL_TIMEOUT_MS);
    }
    if (!exited) {
      failures.push(new Error("acp_process_did_not_exit"));
      this.process.stdin?.destroy();
      this.process.stdout?.destroy();
      this.process.stderr?.destroy();
      this.process.unref();
    }
    // 根进程退出不代表子孙都已退出，仍向拥有的进程组发 SIGKILL；投递失败继续进入账本。
    try {
      signalProcess(this.process, "SIGKILL");
    } catch (error) {
      failures.push(error);
    }
    let controlClosed = !this.mcpControl;
    if (this.mcpControl)
      try {
        await awaitBeforeDeadline(
          () => this.mcpControl!.close({ force: true }),
          Date.now() + ACP_SESSION_CLOSE_TIMEOUT_MS,
        );
        controlClosed = true;
      } catch (error) {
        failures.push(error);
      }
    // 两项状态成立也不证明每个子孙已确认退出；已捕获的收尾失败仍按原顺序聚合抛出。
    this.reclaimed = exited && controlClosed;
    if (failures.length) throw new AggregateError(failures, "acp_process_close_failed");
  }

  /** 消息先归并，再返回消息数组副本／规范化思考并清缓冲；字符上限不是完整协议事件归档。 */
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
      event.sessionUpdate === "tool_call" &&
      event.rawInput?.server === this.approvedMcpServerName &&
      typeof event.toolCallId === "string"
    ) {
      this.approvedInjectedMcpToolCallIds.add(event.toolCallId);
      return;
    }
    if (
      event.sessionUpdate === "tool_call_update" &&
      typeof event.toolCallId === "string" &&
      (event.status === "completed" || event.status === "failed")
    ) {
      this.approvedInjectedMcpToolCallIds.delete(event.toolCallId);
    }
  }
}
