/**
 * 负责本机 MCP 控制面服务与会话绑定。输入为 sidecar 配置、带 token 的 HTTP 请求及领域 dispatch，输出原工具回包与启动环境。
 * 副作用限本机端口、token 和 session 生命周期；异步读完请求后复核会话，领域许可与资源仍归 dispatch。
 * 请求期限不在本适配器计算，也不另设计时器；取消／关闭先清会话并等待原启动，再按 force 关闭连接，不取消已经交出的领域任务。
 */
import { toolFailure } from "@ai-werewolf-arena/game-text";
import { randomBytes } from "node:crypto";
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { AddressInfo } from "node:net";
import { AcpMcpControlServer, AcpMcpServerConfig } from "./acp-mcp-bridge";
import type { Locale } from "@ai-werewolf-arena/game-contract";

export interface LoopbackMcpControlOptions {
  serverName: string;
  controlUrlEnvironmentName: string;
  tokenEnvironmentName: string;
  sessionNotReadyError: string;
  invalidRequestPrefix: string;
  locale?: Locale;
  dispatch(sessionId: string, tool: unknown, args: unknown): unknown | Promise<unknown>;
}

/**
 * MCP sidecar 的通用 loopback 控制面模板。
 * 领域适配器只提供 dispatch 策略；token、session 绑定和生命周期由模板统一处理。
 */
export class LoopbackMcpControlServer implements AcpMcpControlServer {
  private readonly token = randomBytes(32).toString("base64url");
  private readonly server = createServer(
    (request, response) => void this.handle(request, response),
  );
  private endpoint: string | null = null;
  private sessionId: string | null = null;
  private closed = false;
  private starting?: Promise<AcpMcpServerConfig>;
  get snapshot() {
    return { closed: this.closed, listening: this.server.listening };
  }

  constructor(private readonly options: LoopbackMcpControlOptions) {}

  async start(command: string, args: string[]): Promise<AcpMcpServerConfig> {
    if (this.closed) throw new Error("acp_mcp_control_closed");
    if (this.starting) throw new Error("acp_mcp_control_already_started");
    this.starting = this.startListening(command, args);
    return this.starting;
  }

  private async startListening(command: string, args: string[]): Promise<AcpMcpServerConfig> {
    await new Promise<void>((resolve, reject) => {
      this.server.once("error", reject);
      this.server.listen(0, "127.0.0.1", () => {
        this.server.off("error", reject);
        resolve();
      });
    });
    if (this.closed) {
      await this.stopServer(true);
      throw new Error("acp_mcp_control_closed");
    }
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
        { name: "AWA_TASK_LOCALE", value: this.options.locale ?? "zh-CN" },
      ],
    };
  }

  bindSession(sessionId: string): void {
    if (this.closed) throw new Error("acp_mcp_control_closed");
    if (this.sessionId && this.sessionId !== sessionId)
      throw new Error("acp_mcp_control_already_bound");
    this.sessionId = sessionId;
  }

  async close(options: { force?: boolean } = {}): Promise<void> {
    this.closed = true;
    this.sessionId = null;
    await this.starting?.catch(() => undefined);
    await this.stopServer(options.force ?? false);
  }

  private async stopServer(force: boolean): Promise<void> {
    this.endpoint = null;
    if (force) this.server.closeAllConnections();
    if (!this.server.listening) return;
    await new Promise<void>((resolve, reject) =>
      this.server.close((error) => (error ? reject(error) : resolve())),
    );
  }

  private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    if (request.method !== "POST" || request.url !== "/invoke") {
      return this.respond(response, 404, toolFailure(this.options.locale ?? "zh-CN", "not_found"));
    }
    if (request.headers.authorization !== `Bearer ${this.token}`) {
      return this.respond(
        response,
        401,
        toolFailure(this.options.locale ?? "zh-CN", "unauthorized"),
      );
    }
    if (!this.sessionId) {
      return this.respond(
        response,
        409,
        toolFailure(this.options.locale ?? "zh-CN", this.options.sessionNotReadyError),
      );
    }
    try {
      const sessionId = this.sessionId;
      const body = await this.readJson(request);
      if (this.closed || this.sessionId !== sessionId)
        return this.respond(
          response,
          409,
          toolFailure(this.options.locale ?? "zh-CN", this.options.sessionNotReadyError),
        );
      if (!body || typeof body !== "object") throw new Error("request_body_must_be_object");
      const input = body as { tool?: unknown; arguments?: unknown };
      const result = await this.options.dispatch(sessionId, input.tool, input.arguments);
      this.respond(response, isFailure(result) ? 400 : 200, result);
    } catch {
      this.respond(
        response,
        400,
        toolFailure(this.options.locale ?? "zh-CN", this.options.invalidRequestPrefix),
      );
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
    if (response.destroyed || response.writableEnded) return;
    response.writeHead(status, { "content-type": "application/json" });
    response.end(JSON.stringify(body));
  }
}

function isFailure(result: unknown): boolean {
  return !!result && typeof result === "object" && (result as { ok?: unknown }).ok === false;
}
