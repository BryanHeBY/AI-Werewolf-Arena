import { randomBytes } from "node:crypto";
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { AddressInfo } from "node:net";
import { AcpMcpControlServer, AcpMcpServerConfig } from "./acp_mcp_bridge";

export interface LoopbackMcpControlOptions {
  serverName: string;
  controlUrlEnvironmentName: string;
  tokenEnvironmentName: string;
  sessionNotReadyError: string;
  invalidRequestPrefix: string;
  dispatch(sessionId: string, tool: unknown, args: unknown): unknown | Promise<unknown>;
}

/**
 * MCP sidecar 的通用 loopback 控制面模板。
 * 领域适配器只提供 dispatch 策略；token、session 绑定和生命周期由模板统一处理。
 */
export class LoopbackMcpControlServer implements AcpMcpControlServer {
  private readonly token = randomBytes(32).toString("base64url");
  private readonly server = createServer((request, response) => void this.handle(request, response));
  private endpoint: string | null = null;
  private sessionId: string | null = null;

  constructor(private readonly options: LoopbackMcpControlOptions) {}

  async start(command: string, args: string[]): Promise<AcpMcpServerConfig> {
    await new Promise<void>((resolve, reject) => {
      this.server.once("error", reject);
      this.server.listen(0, "127.0.0.1", () => {
        this.server.off("error", reject);
        resolve();
      });
    });
    const address = this.server.address();
    if (!address || typeof address === "string") {
      throw new Error(`${this.options.serverName}_control_server_address_unavailable`);
    }
    this.endpoint = `http://127.0.0.1:${(address as AddressInfo).port}`;
    return {
      name: this.options.serverName,
      command,
      args,
      env: [
        { name: this.options.controlUrlEnvironmentName, value: this.endpoint },
        { name: this.options.tokenEnvironmentName, value: this.token },
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
      return this.respond(response, 409, {
        ok: false,
        error: this.options.sessionNotReadyError,
      });
    }
    try {
      const body = await this.readJson(request);
      if (!body || typeof body !== "object") throw new Error("request_body_must_be_object");
      const input = body as { tool?: unknown; arguments?: unknown };
      const result = await this.options.dispatch(this.sessionId, input.tool, input.arguments);
      this.respond(response, isFailure(result) ? 400 : 200, result);
    } catch (error) {
      this.respond(response, 400, {
        ok: false,
        error: `${this.options.invalidRequestPrefix}:${String(error)}`,
      });
    }
  }

  private async readJson(request: IncomingMessage): Promise<unknown> {
    const chunks: Buffer[] = [];
    for await (const chunk of request) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  }

  private respond(response: ServerResponse, status: number, body: unknown): void {
    response.writeHead(status, { "content-type": "application/json" });
    response.end(JSON.stringify(body));
  }
}

function isFailure(result: unknown): boolean {
  return !!result && typeof result === "object" && (result as { ok?: unknown }).ok === false;
}

