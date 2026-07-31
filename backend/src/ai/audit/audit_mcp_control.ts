import { AcpMcpServerConfig } from "../integrations/acp/acp_mcp_bridge";
import { LoopbackMcpControlServer } from "../integrations/acp/loopback_mcp_control_server";
import { AuditToolTurnRegistry } from "./audit_tool_protocol";

/** 单个审计 ACP session 的 loopback MCP 控制面。 */
export class AuditMcpControlServer {
  private readonly delegate: LoopbackMcpControlServer;

  constructor(private readonly registry: AuditToolTurnRegistry) {
    this.delegate = new LoopbackMcpControlServer({
      serverName: "werewolf-audit",
      controlUrlEnvironmentName: "AUDIT_MCP_CONTROL_URL",
      tokenEnvironmentName: "AUDIT_MCP_TOKEN",
      sessionNotReadyError: "session_not_ready",
      invalidRequestPrefix: "invalid_audit_mcp_request",
      dispatch: (sessionId, tool, args) => this.dispatch(sessionId, tool, args),
    });
  }

  async start(command: string, args: string[]): Promise<AcpMcpServerConfig> {
    return this.delegate.start(command, args);
  }

  bindSession(sessionId: string): void {
    this.delegate.bindSession(sessionId);
  }

  async close(options: { force?: boolean } = {}): Promise<void> {
    await this.delegate.close(options);
  }

  private dispatch(sessionId: string, tool: unknown, args: unknown): unknown {
    if (tool === "get_audit_schema") return this.registry.getSchema();
    if (tool === "get_audit_context") return this.registry.getContext(sessionId, args);
    if (tool === "submit_audit_findings") return this.registry.submitFindings(sessionId, args);
    if (tool === "submit_audit_summary") return this.registry.submitSummary(sessionId, args);
    return { ok: false, error: "unknown_mcp_tool" };
  }
}
