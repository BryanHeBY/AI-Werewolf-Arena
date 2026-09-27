import * as path from "node:path";
import { AcpProcessClient } from "../integrations/acp/acp_process_client";
import { AcpSession, AcpSessionFactory } from "../integrations/acp/session";
import { closeAcpSession } from "../integrations/acp/session_lifecycle";
import { awaitWithAbort } from "../runtime/turn_deadline";
import { AcpMcpBridgeFactory } from "../integrations/acp/acp_mcp_bridge";
import { ResolvedAgentRuntimeProfile } from "../../runtime/config/contracts";
import { AgentTurnOptions } from "../runtime/agent_turn_executor";
import { AuditAgentExecutor } from "./contracts";
import { auditTurnPrompt } from "./prompts";
import { AuditMcpControlServer } from "./audit_mcp_control";
import { AuditSubmission, AuditToolContext, AuditToolTurnRegistry } from "./audit_tool_protocol";
function auditSessionPrompt(): string {
  return [
    "你是狼人杀复盘审计智能体。唯一职责是从随后被授权的结构化上下文中发现可验证的问题。",
    "每个实际审计回合会提供 turn_id；届时先调用 get_audit_context，再使用与模式对应的 submit 工具。",
    "普通 assistant 文本仅视为思考，不会成为审计结果。不要读取本地文件、终端或其他任务。",
    "当前仅初始化会话，尚无有效 turn_id，请不要调用任何工具。",
  ].join("\n");
}
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

  constructor(private readonly options: AcpAuditAgentExecutorOptions) {}

  async runTurn(
    context: AuditToolContext,
    options: AgentTurnOptions,
  ): Promise<AuditSubmission | null> {
    if (this.closed || options.timeoutMs <= 0) return null;
    const registry = new AuditToolTurnRegistry();
    const workspace = path.join(
      this.options.workspaceRoot,
      `${String(context.taskName).replace(/[^a-zA-Z0-9_-]/g, "_")}-${++this.nextSession}`,
    );
    const factory = this.options.sessionFactoryResolver?.(registry, workspace)
      ?? this.createProcessFactory(registry, workspace);
    let session: AcpSession | undefined;
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
        initialPrompt: auditSessionPrompt(),
        deadlineAtMs,
        signal: controller.signal,
      }));
      void sessionTask.then((lateSession) => {
        if (controller.signal.aborted) void closeAcpSession(lateSession, true);
      }, () => undefined);
      session = await awaitWithAbort(sessionTask, controller.signal);
      this.sessions.add(session);
      controller.signal.throwIfAborted();
      const turn = registry.openTurn(context, session.sessionId);
      const promptTask = session.prompt(auditTurnPrompt(turn.turnId, context.mode));
      return await awaitWithAbort(Promise.race([
        turn.result,
        promptTask.then(() => null, () => null),
      ]), controller.signal);
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
      registry.closeTurn();
      this.pending.delete(controller);
      const force = controller.signal.aborted;
      controller.abort(new Error("audit_acp_turn_closed"));
      if (session) {
        this.sessions.delete(session);
        await closeAcpSession(session, force);
      }
    }
  }

  async close(): Promise<void> {
    this.closed = true;
    for (const controller of this.pending) {
      controller.abort(new Error("audit_acp_executor_closed"));
    }
    await Promise.all([...this.sessions].map((session) => closeAcpSession(session, true)));
    this.sessions.clear();
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
