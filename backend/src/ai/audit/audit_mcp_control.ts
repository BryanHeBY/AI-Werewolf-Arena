import { randomBytes } from "node:crypto";
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { AddressInfo } from "node:net";
import { AcpMcpServerConfig } from "../integrations/acp/acp_mcp_bridge";
import { AuditToolTurnRegistry } from "./audit_tool_protocol";

/** 单个审计 ACP session 的 loopback MCP 控制面。 */
export class AuditMcpControlServer {
  private readonly token = randomBytes(32).toString("base64url");
  private readonly server = createServer((request, response) => void this.handle(request, response));
  private endpoint: string | null = null;
  private sessionId: string | null = null;

  constructor(private readonly registry: AuditToolTurnRegistry) {}

  async start(command: string, args: string[]): Promise<AcpMcpServerConfig> {
    await new Promise<void>((resolve, reject) => {
      this.server.once("error", reject);
      this.server.listen(0, "127.0.0.1", () => {
        this.server.off("error", reject);
        resolve();
      });
    });
    const address = this.server.address();
    if (!address || typeof address === "string") throw new Error("audit_mcp_address_unavailable");
    this.endpoint = `http://127.0.0.1:${(address as AddressInfo).port}`;
    return {
      name: "werewolf-audit",
      command,
      args,
      env: [
        { name: "AUDIT_MCP_CONTROL_URL", value: this.endpoint },
        { name: "AUDIT_MCP_TOKEN", value: this.token },
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
    if (options.force) this.server.closeAllConnections();
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }

  private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    if (request.method !== "POST" || request.url !== "/invoke") {
      return this.respond(response, 404, { ok: false, error: "not_found" });
    }
    if (request.headers.authorization !== `Bearer ${this.token}`) {
      return this.respond(response, 401, { ok: false, error: "unauthorized" });
    }
    if (!this.sessionId) {
      return this.respond(response, 409, { ok: false, error: "session_not_ready" });
    }
    try {
      const body = await this.readJson(request) as { tool?: unknown; arguments?: unknown };
      let result: unknown;
      if (body.tool === "get_audit_schema") result = this.registry.getSchema();
      else if (body.tool === "get_audit_context") {
        result = this.registry.getContext(this.sessionId, body.arguments);
      } else if (body.tool === "submit_audit_findings") {
        result = this.registry.submitFindings(this.sessionId, body.arguments);
      } else if (body.tool === "submit_audit_summary") {
        result = this.registry.submitSummary(this.sessionId, body.arguments);
      } else result = { ok: false, error: "unknown_mcp_tool" };
      this.respond(response, (result as any)?.ok === false ? 400 : 200, result);
    } catch (error) {
      this.respond(response, 400, { ok: false, error: `invalid_audit_mcp_request:${String(error)}` });
    }
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
