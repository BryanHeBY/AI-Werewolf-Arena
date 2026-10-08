import * as path from "node:path";
import { AcpProcessClient } from "../integrations/acp/acp_process_client";
import { AcpSession, AcpSessionFactory } from "../integrations/acp/session";
import { ACP_CLOSE_TIMEOUT_MS, AcpInitializationCleanupError, closeAcpSession } from "../integrations/acp/session_lifecycle";
import { awaitBeforeDeadline, awaitWithAbort } from "../runtime/turn_deadline";
import { AcpMcpBridgeFactory } from "../integrations/acp/acp_mcp_bridge";
import { ResolvedAgentRuntimeProfile } from "../../runtime/config/contracts";
import { AgentTurnOptions } from "../runtime/agent_turn_executor";
import { AuditAgentExecutor } from "./contracts";
import { auditSystemPrompt, auditTurnPrompt } from "./prompts";
import { AuditMcpControlServer } from "./audit_mcp_control";
import { AuditSubmission, AuditToolContext, AuditToolTurnRegistry } from "./audit_tool_protocol";
export interface AcpAuditAgentExecutorOptions {
  profile: ResolvedAgentRuntimeProfile;
  workspaceRoot: string;
  sessionFactoryResolver?: (
    registry: AuditToolTurnRegistry,
    workspace: string,
  ) => AcpSessionFactory<AuditToolTurnRegistry>;
}

/** ACP + MCP 适配器；每个并行审计任务使用独立进程和独立 registry。 */
export class AcpAuditAgentExecutor implements AuditAgentExecutor {
  private nextSession = 0;
  private readonly pending = new Set<AbortController>();
  private readonly sessions = new Set<AcpSession>();
  private closed = false;
  private readonly creating = new Set<Promise<AcpSession>>();
  private readonly retiring = new Set<Promise<void>>();
  private readonly retired = new WeakMap<AcpSession, Promise<void>>();
  private readonly cleanupFailures: unknown[] = [];

  get runtimeState() { return { closed: this.closed, pending: this.pending.size, sessions: this.sessions.size, creating: this.creating.size, retiring: this.retiring.size }; }

  constructor(private readonly options: AcpAuditAgentExecutorOptions) {}

  async runTurn(
    context: AuditToolContext,
    options: AgentTurnOptions,
  ): Promise<AuditSubmission | null> {
    if (this.closed || options.timeoutMs <= 0) return null;
    const registry = new AuditToolTurnRegistry(context.locale);
    const workspace = path.join(
      this.options.workspaceRoot,
      `${String(context.taskName).replace(/[^a-zA-Z0-9_-]/g, "_")}-${++this.nextSession}`,
    );
    const factory = this.options.sessionFactoryResolver?.(registry, workspace)
      ?? this.createProcessFactory(registry, workspace);
    if (this.closed) return null;
    let session: AcpSession | undefined;
    let primary: unknown;
    let hasPrimary = false;
    const controller = new AbortController();
    this.pending.add(controller);
    const deadlineAtMs = Date.now() + options.timeoutMs;
    const timer = setTimeout(
      () => controller.abort(new Error("audit_acp_timeout")),
      options.timeoutMs,
    );
    try {
      const sessionTask = Promise.resolve().then(() => factory.createSession({
        actorId: 0,
        registry,
        initialPrompt: auditSystemPrompt(registry.locale, true),
        deadlineAtMs,
        signal: controller.signal,
      }));
      this.creating.add(sessionTask);
      void sessionTask.then(lateSession => {
        this.creating.delete(sessionTask);
        if (controller.signal.aborted || this.closed) void this.retire(lateSession, true).catch(() => undefined);
      }, error => {
        this.creating.delete(sessionTask);
        if (error instanceof AcpInitializationCleanupError || (controller.signal.aborted && error !== controller.signal.reason)) this.cleanupFailures.push(error);
      });
      session = await awaitWithAbort(sessionTask, controller.signal);
      this.sessions.add(session);
      controller.signal.throwIfAborted();
      const turn = registry.openTurn(context, session.sessionId);
      const promptTask = session.prompt(auditTurnPrompt(turn.turnId, context.mode, registry.locale));
      return await awaitWithAbort(Promise.race([
        turn.result,
        promptTask.then(() => null, error => { if (!controller.signal.aborted && !hasPrimary) { primary = error; hasPrimary = true; } return null; }),
      ]), controller.signal);
    } catch (error) {
      primary = error;
      hasPrimary = true;
      return null;
    } finally {
      clearTimeout(timer);
      registry.closeTurn();
      this.pending.delete(controller);
      const force = controller.signal.aborted;
      controller.abort(new Error("audit_acp_turn_closed"));
      if (session) {
        this.sessions.delete(session);
        try { await this.retire(session, force); }
        catch (error) { if (hasPrimary) throw new AggregateError([primary, error], "audit_acp_turn_and_cleanup_failed"); throw error; }
      }
    }
  }

  async close(): Promise<void> {
    this.closed = true;
    for (const controller of this.pending) {
      controller.abort(new Error("audit_acp_executor_closed"));
    }
    for (const session of this.sessions) void this.retire(session, true).catch(() => undefined);
    this.sessions.clear();
    try { await awaitBeforeDeadline(() => Promise.allSettled([...this.creating]), Date.now() + ACP_CLOSE_TIMEOUT_MS); }
    catch (error) { this.cleanupFailures.push(error); }
    while (this.retiring.size) await Promise.all([...this.retiring]);
    const failures = this.cleanupFailures.splice(0);
    if (failures.length) throw new AggregateError(failures, "audit_acp_close_failed");
  }

  private retire(session: AcpSession, force: boolean): Promise<void> {
    const existing = this.retired.get(session); if (existing) return existing;
    const closing = closeAcpSession(session, force);
    this.retired.set(session, closing);
    const accounted = closing.catch(error => { this.cleanupFailures.push(error); });
    this.retiring.add(accounted); void accounted.then(() => this.retiring.delete(accounted));
    return closing;
  }

  private createProcessFactory(
    registry: AuditToolTurnRegistry,
    workspace: string,
  ): AcpSessionFactory<AuditToolTurnRegistry> {
    const profile = this.options.profile;
    if (profile.kind !== "acp" || profile.provider.type !== "acp") {
      throw new Error("audit_acp_profile_required");
    }
    const extension = path.extname(__filename) === ".ts" ? ".ts" : ".js";
    const bridge: AcpMcpBridgeFactory<AuditToolTurnRegistry> = {
      serverName: "werewolf-audit",
      createControl: (turnRegistry) => new AuditMcpControlServer(turnRegistry),
      serverEntrypoint: () => path.join(__dirname, `audit_mcp_server${extension}`),
    };
    return new AcpProcessClient<AuditToolTurnRegistry>({
      command: profile.provider.command,
      args: [...(profile.provider.args ?? []), ...(profile.spawnArgs ?? [])],
      env: profile.provider.env,
      initializeTimeoutMs: profile.provider.initializeTimeoutMs,
      sessionConfigOptions: profile.provider.sessionConfigOptions,
      cwd: workspace,
      mcpBridge: bridge,
    });
  }
}
