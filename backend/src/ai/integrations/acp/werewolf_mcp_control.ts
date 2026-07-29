import { randomBytes } from "node:crypto";
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { AddressInfo } from "node:net";
import {
  AcpTurnRegistry,
  McpBridgeResult,
  McpReportBugParams,
  McpSubmitActionParams,
} from "./acp_turn_registry";

export interface WerewolfMcpServerConfig {
  name: string;
  command: string;
  args: string[];
  env: Array<{ name: string; value: string }>;
}

/**
 * 仅供同一 ACP session 拉起的 stdio MCP sidecar 调用的 loopback 控制面。
 * MCP 是 Agent 可见接口；此处不是公开 HTTP API，随机 token 将每个玩家隔离。
 */
export class WerewolfMcpControlServer {
  private readonly token = randomBytes(32).toString("base64url");
  private readonly server = createServer((request, response) => {
    void this.handle(request, response);
  });
  private endpoint: string | null = null;
  private sessionId: string | null = null;

  constructor(private readonly registry: AcpTurnRegistry) {}

  async start(command: string, args: string[]): Promise<WerewolfMcpServerConfig> {
    await new Promise<void>((resolve, reject) => {
      this.server.once("error", reject);
      this.server.listen(0, "127.0.0.1", () => {
        this.server.off("error", reject);
        resolve();
      });
    });
    const address = this.server.address();
    if (!address || typeof address === "string") {
      throw new Error("werewolf_mcp_control_server_address_unavailable");
    }
    this.endpoint = `http://127.0.0.1:${(address as AddressInfo).port}`;
    return {
      name: "werewolf-game",
      command,
      args,
      env: [
        { name: "WEREWOLF_MCP_CONTROL_URL", value: this.endpoint },
        { name: "WEREWOLF_MCP_TOKEN", value: this.token },
      ],
    };
  }

  bindSession(sessionId: string): void {
    this.sessionId = sessionId;
  }

  async close(options: { force?: boolean } = {}): Promise<void> {
    this.sessionId = null;
    if (!this.endpoint) return;
    this.endpoint = null;
    if (options.force) {
      this.server.closeAllConnections();
    }
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }

  private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    if (request.method !== "POST" || request.url !== "/invoke") {
      this.respond(response, 404, { ok: false, error: "not_found" });
      return;
    }
    if (request.headers.authorization !== `Bearer ${this.token}`) {
      this.respond(response, 401, { ok: false, error: "unauthorized" });
      return;
    }
    const sessionId = this.sessionId;
    if (!sessionId) {
      this.respond(response, 409, { ok: false, error: "session_not_ready" });
      return;
    }
    try {
      const body = await this.readJson(request);
      const result = this.dispatch(sessionId, body);
      this.respond(response, "ok" in result && result.ok ? 200 : 400, result);
    } catch (error) {
      this.respond(response, 400, { ok: false, error: `invalid_mcp_control_request:${String(error)}` });
    }
  }

  private dispatch(sessionId: string, body: unknown): McpBridgeResult | typeof import("./acp_turn_registry").WEREWOLF_MCP_SCHEMA {
    if (!body || typeof body !== "object") {
      return { ok: false, error: "request_body_must_be_object" };
    }
    const input = body as { tool?: unknown; arguments?: unknown };
    if (input.tool === "get_game_schema") return this.registry.getSchema();
    if (input.tool === "submit_action") {
      const args = input.arguments;
      if (!args || typeof args !== "object") return { ok: false, error: "invalid_submit_action_arguments" };
      return this.registry.submitAction(sessionId, args as McpSubmitActionParams);
    }
    if (input.tool === "report_bug") {
      const args = input.arguments;
      if (!args || typeof args !== "object") return { ok: false, error: "invalid_report_bug_arguments" };
      return this.registry.reportBug(sessionId, args as McpReportBugParams);
    }
    return { ok: false, error: "unknown_mcp_tool" };
  }

  private async readJson(request: IncomingMessage): Promise<unknown> {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  }

  private respond(response: ServerResponse, status: number, body: unknown): void {
    response.writeHead(status, { "content-type": "application/json" });
    response.end(JSON.stringify(body));
  }
}
