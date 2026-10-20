/**
 * 负责本地工作台 HTTP 数据边界；输入受限 JSON 请求，输出配置、目录、运行及回放。
 * 变更请求校验同源，实际持久化与进程交各自所有者；不接受任意命令或绝对文件路径。
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import type { ConfigKind, ConfigDocument, JsonObject } from "@ai-werewolf-arena/workbench-contract";
import { ConfigDocuments, containedFile, WorkbenchError, objectDocument } from "./config-documents";
import { ConfigService, diagnostic } from "./config-service";
import { SessionStore } from "./session-store";
import { RunManager } from "./run-manager";
import { describeModelCatalog } from "ai-werewolf-arena-backend/config/models";
import { normalizeListenHost, workbenchRequestHosts } from "./listen-address";

export interface WorkbenchOptions {
  repository: string;
  configs: string;
  records: string;
  jobs: string;
  dist?: string;
  host?: string;
}
export function createWorkbench(options: WorkbenchOptions) {
  const acceptedHosts = workbenchRequestHosts(options.host ?? "127.0.0.1");
  let models: ReturnType<typeof describeModelCatalog> | undefined;
  const documents = new ConfigDocuments(options.configs),
    configs = new ConfigService(documents, path.join(options.repository, "configs.example"));
  const sessions = new SessionStore(options.records),
    runs = new RunManager(options.repository, options.configs, sessions, options.jobs);
  return {
    documents,
    configs,
    sessions,
    runs,
    async fetch(request: Request): Promise<Response> {
      const url = new URL(request.url);
      try {
        let parts: string[];
        try {
          parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
        } catch {
          throw new WorkbenchError("invalid_path");
        }
        if (!acceptedHosts.has(normalizeListenHost(url.hostname)))
          throw new WorkbenchError("host_rejected", 403);
        if (url.pathname.startsWith("/api/") && !["GET", "HEAD"].includes(request.method)) {
          const origin = request.headers.get("origin");
          if (
            origin &&
            origin !== url.origin &&
            origin !== "http://127.0.0.1:5174" &&
            origin !== "http://localhost:5174"
          )
            throw new WorkbenchError("origin_rejected", 403);
          if (request.headers.get("sec-fetch-site") === "cross-site")
            throw new WorkbenchError("origin_rejected", 403);
          if (!request.headers.get("content-type")?.startsWith("application/json"))
            throw new WorkbenchError("json_required", 415);
        }
        if (parts[0] === "api") {
          let body: any = {};
          if (!["GET", "HEAD"].includes(request.method)) {
            if (Number(request.headers.get("content-length")) > 2_000_000)
              throw new WorkbenchError("request_too_large", 413);
            const text = await request.text();
            if (text.length > 2_000_000) throw new WorkbenchError("request_too_large", 413);
            body = objectDocument(text);
          }
          let result: unknown;
          if (parts[1] === "health" && request.method === "GET") result = { status: "ok" };
          else if (parts[1] === "models" && request.method === "GET")
            result = await (models ??= describeModelCatalog());
          else if (parts[1] === "catalog" && request.method === "GET")
            result = { ...(await configs.summary()), boards: await configs.boards() };
          else if (parts[1] === "initialize" && request.method === "POST") {
            await documents.initialize(path.join(options.repository, "configs.example"));
            result = { ok: true };
          } else if (parts[1] === "documents" && parts.length === 4) {
            const kind = parts[2] as ConfigKind,
              name = parts[3];
            if (request.method === "GET")
              result = await documents.read(kind, name, url.searchParams.get("reveal") === "true");
            else if (request.method === "PUT") {
              if (
                typeof body.text !== "string" ||
                !(body.revision === null || typeof body.revision === "string")
              )
                throw new WorkbenchError("invalid_document");
              result = await documents.save(
                { kind, name, text: body.text, revision: body.revision },
                (raw) => configs.validate(kind, name, raw),
              );
            } else throw new WorkbenchError("method_not_allowed", 405);
          } else if (
            parts[1] === "board-template" &&
            parts.length === 3 &&
            request.method === "GET"
          )
            result = await configs.boardRaw(parts[2]);
          else if (parts[1] === "validate" && request.method === "POST") {
            if (typeof body.text !== "string" || typeof body.name !== "string")
              throw new WorkbenchError("invalid_document");
            try {
              await configs.validate(body.kind, body.name, objectDocument(body.text));
              result = { valid: true, diagnostics: [] };
            } catch (error) {
              result = { valid: false, diagnostics: [diagnostic(error)] };
            }
          } else if (parts[1] === "runs" && parts.length === 2) {
            if (request.method === "GET") result = await runs.list();
            else if (request.method === "POST") {
              if (typeof body.gameName !== "string")
                throw new WorkbenchError("invalid_config_name");
              await configs.ensureGameBoard(body.gameName);
              result = { sessionId: await runs.start(body.gameName) };
            } else throw new WorkbenchError("method_not_allowed", 405);
          } else if (parts[1] === "runs" && parts.length === 4) {
            const id = parts[2];
            if (parts[3] === "stop" && request.method === "POST") {
              await sessions.stop(id);
              result = { accepted: true };
            } else if (parts[3] === "logs" && request.method === "GET") {
              const after = Number(url.searchParams.get("after") ?? 0);
              if (!Number.isSafeInteger(after) || after < 0)
                throw new WorkbenchError("invalid_cursor");
              result = await runs.logs(id, after);
            } else if (parts[3] === "replay" && request.method === "GET") {
              const file = await sessions.file(id, "replay.json");
              if (!(await Bun.file(file).exists()))
                throw new WorkbenchError("replay_not_found", 404);
              return new Response(Bun.file(file), {
                headers: { "content-type": "application/json", "cache-control": "no-store" },
              });
            } else throw new WorkbenchError("not_found", 404);
          } else if (parts[1] === "codex-import" && request.method === "POST") {
            // 只读取固定认证文件，响应不包含任何令牌；转换为现有 Pi OAuth 原生字段。
            const auth = JSON.parse(
              await fs.readFile(path.join(os.homedir(), ".codex/auth.json"), "utf8"),
            );
            const tokens = auth.tokens;
            if (
              !tokens ||
              typeof tokens.access_token !== "string" ||
              typeof tokens.refresh_token !== "string"
            )
              throw new WorkbenchError("codex_auth_unavailable", 409);
            let expires = Date.now();
            try {
              const claims = JSON.parse(
                Buffer.from(tokens.access_token.split(".")[1], "base64url").toString(),
              );
              if (typeof claims.exp === "number") expires = claims.exp * 1000;
            } catch {}
            const current = await documents.read("backends", "backends", true),
              raw = objectDocument(current.text);
            if (typeof body.backend !== "string") throw new WorkbenchError("invalid_config_name");
            const items = raw.items as JsonObject,
              backend = items?.[body.backend] as JsonObject;
            if (backend?.kind !== "pi") throw new WorkbenchError("invalid_backend");
            const config = backend.config as JsonObject;
            config.auth = {
              ...((config.auth as JsonObject) ?? {}),
              "openai-codex": {
                type: "oauth",
                access: tokens.access_token,
                refresh: tokens.refresh_token,
                expires,
                ...(typeof tokens.account_id === "string" ? { accountId: tokens.account_id } : {}),
              },
            };
            await documents.save({ ...current, text: JSON.stringify(raw) }, (value) =>
              configs.validate("backends", "backends", value),
            );
            result = { ok: true };
          } else throw new WorkbenchError("not_found", 404);
          return Response.json(result, { headers: { "cache-control": "no-store" } });
        }
        if (request.method !== "GET") return new Response(null, { status: 405 });
        if (options.dist) {
          const relative = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
          const file = await containedFile(options.dist, relative);
          if (await Bun.file(file).exists()) return new Response(Bun.file(file));
          if (!path.extname(relative))
            return new Response(Bun.file(path.join(options.dist, "index.html")));
        }
        return new Response("Build the workbench client first: bun run build:workbench", {
          status: 404,
        });
      } catch (error) {
        const entry = diagnostic(error);
        return Response.json(
          { error: entry.code, diagnostics: [entry] },
          {
            status: error instanceof WorkbenchError ? error.status : 400,
            headers: { "cache-control": "no-store" },
          },
        );
      }
    },
  };
}
