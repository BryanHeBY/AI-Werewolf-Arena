import {
  AcpTurnRegistry,
  McpReportBugParams,
  McpSubmitActionParams,
} from "./acp_turn_registry";
import { AcpMcpServerConfig } from "./acp_mcp_bridge";
import { LoopbackMcpControlServer } from "./loopback_mcp_control_server";

export type WerewolfMcpServerConfig = AcpMcpServerConfig;

/**
 * 仅供同一 ACP session 拉起的 stdio MCP sidecar 调用的 loopback 控制面。
 * MCP 是 Agent 可见接口；此处不是公开 HTTP API，随机 token 将每个玩家隔离。
 */
export class WerewolfMcpControlServer {
  private readonly delegate: LoopbackMcpControlServer;

  constructor(private readonly registry: AcpTurnRegistry) {
    this.delegate = new LoopbackMcpControlServer({
      serverName: "werewolf-game",
      controlUrlEnvironmentName: "WEREWOLF_MCP_CONTROL_URL",
      tokenEnvironmentName: "WEREWOLF_MCP_TOKEN",
      sessionNotReadyError: "session_not_ready",
      invalidRequestPrefix: "invalid_mcp_control_request",
      dispatch: (sessionId, tool, args) => this.dispatch(sessionId, tool, args),
    });
  }

  async start(command: string, args: string[]): Promise<WerewolfMcpServerConfig> {
    return this.delegate.start(command, args);
  }

  bindSession(sessionId: string): void {
    this.delegate.bindSession(sessionId);
  }

  async close(options: { force?: boolean } = {}): Promise<void> {
    await this.delegate.close(options);
  }

  private dispatch(sessionId: string, tool: unknown, args: unknown): unknown {
    if (tool === "get_game_schema") return this.registry.getSchema();
    if (tool === "submit_action") {
      if (!args || typeof args !== "object") return { ok: false, error: "invalid_submit_action_arguments" };
      return this.registry.submitAction(sessionId, args as McpSubmitActionParams);
    }
    if (tool === "report_bug") {
      if (!args || typeof args !== "object") return { ok: false, error: "invalid_report_bug_arguments" };
      return this.registry.reportBug(sessionId, args as McpReportBugParams);
    }
    return { ok: false, error: "unknown_mcp_tool" };
  }
}
