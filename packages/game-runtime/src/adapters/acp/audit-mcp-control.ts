/**
 * 负责审计会话的 loopback MCP 控制适配。输入为 sidecar 命令、绑定 session 与工具参数；
 * 输出为原工具回包及启动配置，网络监听、token、会话复核与关闭由实际 delegate 拥有。
 * 此层不自设期限／计时器；关闭等待 delegate，取消不撤回已经交给 registry 的提交。
 * 上下文与发现只作用于审计 turn，不授游戏写权、读取任意文件或发布游戏事件。
 */
import { toolFailure } from "@ai-werewolf-arena/game-text";
import { AcpMcpServerConfig } from "./acp-mcp-bridge";
import { LoopbackMcpControlServer } from "./loopback-mcp-control-server";
import { AuditToolTurnRegistry } from "../../audit/agents/audit-tool-protocol";

/** 原 loopback token／session 生命周期保持唯一 delegate，不在此保存另一套认证或 pending。 */
export class AuditMcpControlServer {
  private readonly delegate: LoopbackMcpControlServer;

  constructor(private readonly registry: AuditToolTurnRegistry) {
    this.delegate = new LoopbackMcpControlServer({
      serverName: "werewolf-audit",
      controlUrlEnvironmentName: "AUDIT_MCP_CONTROL_URL",
      tokenEnvironmentName: "AUDIT_MCP_TOKEN",
      sessionNotReadyError: "session_not_ready",
      invalidRequestPrefix: "invalid_audit_mcp_request",
      locale: registry.locale,
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
    // schema 是静态说明；具体上下文／提交再由 registry 核当前 turn，HTTP认证仍先由 delegate 检查。
    if (tool === "get_audit_schema") return this.registry.getSchema();
    if (tool === "get_audit_context") return this.registry.getContext(sessionId, args);
    if (tool === "submit_audit_findings") return this.registry.submitFindings(sessionId, args);
    if (tool === "submit_audit_summary") return this.registry.submitSummary(sessionId, args);
    return toolFailure(this.registry.locale, "unknown_mcp_tool");
  }
}
