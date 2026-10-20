/**
 * 负责将同一 ACP 会话 sidecar 的 MCP 调用路由给原游戏 registry；输入本机控制配置与工具参数，输出原回包。
 * token、会话绑定和 HTTP 副作用归 loopback delegate；行动许可与失败窗口仍由 registry 复验。
 * 此适配器不另设期限或执行库存提交；关闭只等待 delegate，不取消已经交出的领域任务。
 */
import { toolFailure } from "@ai-werewolf-arena/game-text";
import { AcpTurnRegistry, McpReportBugParams, McpSubmitActionParams } from "./acp-turn-registry";
import { AcpMcpServerConfig } from "./acp-mcp-bridge";
import { LoopbackMcpControlServer } from "./loopback-mcp-control-server";

export type WerewolfMcpServerConfig = AcpMcpServerConfig;

/**
 * 仅供同一 ACP session 拉起的 stdio MCP sidecar 调用的 loopback 控制面。
 * MCP 是 Agent 可见接口；随机 token 隔离各控制实例，delegate 持绑定会话，registry 持实际回合。
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
      locale: registry.locale,
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

  // delegate 已核 token／会话；此处仅按工具路由，不把类型断言当 schema 或游戏行动权限。
  private dispatch(sessionId: string, tool: unknown, args: unknown): unknown {
    if (tool === "get_game_schema") return this.registry.getSchema();
    // 无效提交的 turn_id 仍交原 owner 决定是否关闭自己的窗口；不能消耗别的会话／回合。
    if (tool === "reject_submission_input") {
      const turnId =
        args && typeof args === "object" && !Array.isArray(args)
          ? (args as Record<string, unknown>).turn_id
          : undefined;
      return this.registry.rejectSubmissionInput(sessionId, turnId);
    }
    if (tool === "submit_action") {
      if (!args || typeof args !== "object")
        return toolFailure(this.registry.locale, "invalid_submit_action_arguments");
      return this.registry.submitAction(sessionId, args as McpSubmitActionParams);
    }
    if (tool === "report_bug") {
      if (!args || typeof args !== "object")
        return toolFailure(this.registry.locale, "invalid_report_bug_arguments");
      return this.registry.reportBug(sessionId, args as McpReportBugParams);
    }
    return toolFailure(this.registry.locale, "unknown_mcp_tool");
  }
}
