/**
 * 负责工作台配置检查、可用板子目录与具名游戏摘要；输入原始文档，输出脱敏诊断及支持信息。
 * 实际解析和有限规则判断仍交 backend 唯一所有者；不启动 Agent，不把已解析认证写回原始文件。
 */
import {
  parseRuntimeConfig,
  parseRuntimeCatalog,
} from "@ai-werewolf-arena/game-runtime/config/parse";
import { parseBoardDefinition } from "@ai-werewolf-arena/game-runtime/config/board";
import { resolveGameSetup, resolveGameBoard } from "@ai-werewolf-arena/game-runtime/config/resolve";
import { configDiagnostic } from "@ai-werewolf-arena/game-runtime/config/diagnostics";
import { validateRuntimeNativeConfig } from "@ai-werewolf-arena/game-runtime/config/validate";
import { testAgentConnection } from "@ai-werewolf-arena/game-runtime/config/test-agent-connection";
import { resolveAgentProfileByName } from "@ai-werewolf-arena/game-runtime/config/resolve";
import { resolveDeclaredPath } from "@ai-werewolf-arena/project-paths";
import path from "node:path";
import type {
  BoardCard,
  ConfigKind,
  JsonObject,
  Diagnostic,
  GameCard,
} from "@ai-werewolf-arena/workbench-contract";
import { ConfigDocuments, WorkbenchError, objectDocument } from "./config-documents";

/** 损坏的原始文档仍可编辑，但目录摘要只投影有限字符串，不能借原生扩展对象带出认证。 */
function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function diagnostic(error: unknown): Diagnostic {
  if (error instanceof WorkbenchError)
    return {
      code: error.code,
      severity: "error",
      ...(error.fieldPath ? { path: error.fieldPath } : {}),
    };
  let filesystemCode: unknown;
  try {
    if (error instanceof Error)
      filesystemCode = Object.getOwnPropertyDescriptor(error, "code")?.value;
  } catch {
    /* 外来异常也不能借 getter 将正文或认证带进诊断。 */
  }
  if (filesystemCode === "EACCES" || filesystemCode === "EPERM")
    return { code: "file_access_denied", severity: "error" };
  if (filesystemCode === "ENOSPC") return { code: "disk_full", severity: "error" };
  return { ...configDiagnostic(error), severity: "error" };
}
export class ConfigService {
  private testingConnection = false;
  constructor(
    readonly documents: ConfigDocuments,
    readonly examplesRoot: string,
  ) {}
  /** 只测试磁盘中已保存的配置；一次一个探测，避免重复点击并发启动进程或计费请求。 */
  async testAgent(name: string, signal?: AbortSignal) {
    if (this.testingConnection) throw new WorkbenchError("connection_test_busy", 409);
    this.testingConnection = true;
    try {
      const runtime = parseRuntimeConfig({
        backends: await this.documents.raw("backends", "backends"),
        agents: await this.documents.raw("agents", "agents"),
        game: {},
      });
      await validateRuntimeNativeConfig(runtime);
      const profile = resolveAgentProfileByName(runtime, name);
      if (profile.provider.type === "acp") {
        const file = path.join(this.documents.root, "runtime/backends.json");
        profile.provider = {
          ...profile.provider,
          command: /[/\\]/.test(profile.provider.command)
            ? resolveDeclaredPath(profile.provider.command, file)
            : profile.provider.command,
          ...(profile.provider.cwd ? { cwd: resolveDeclaredPath(profile.provider.cwd, file) } : {}),
        };
      }
      return await testAgentConnection(profile, { signal });
    } finally {
      this.testingConnection = false;
    }
  }
  async validate(kind: ConfigKind, name: string, raw: JsonObject): Promise<void> {
    if (
      !["backends", "agents", "games", "boards"].includes(kind) ||
      !/^[a-z][a-z0-9_-]*$/.test(name)
    )
      throw new WorkbenchError("invalid_config_name");
    if (kind === "boards") {
      parseBoardDefinition(raw, name);
      return;
    }
    const backends = kind === "backends" ? raw : await this.documents.raw("backends", "backends");
    const agents = kind === "agents" ? raw : await this.documents.raw("agents", "agents");
    if (kind === "backends" || kind === "agents") {
      // 配置阶段允许先有连接、后有 Agent；已有条目照常校验，开局继续使用严格解析器。
      await validateRuntimeNativeConfig(parseRuntimeCatalog({ backends, agents }));
      return;
    }
    const game = kind === "games" ? raw : {};
    const runtime = parseRuntimeConfig({ backends, agents, game });
    await validateRuntimeNativeConfig(runtime);
    if (kind === "games") {
      const boardId = resolveGameBoard(runtime);
      const board = parseBoardDefinition(await this.documents.raw("boards", boardId), boardId);
      resolveGameSetup(runtime, {}, board);
    }
  }
  async boardRaw(name: string, source?: "local" | "example"): Promise<JsonObject> {
    if (source === "example") return new ConfigDocuments(this.examplesRoot).raw("boards", name);
    if (source === "local") return this.documents.raw("boards", name);
    try {
      return await this.documents.raw("boards", name);
    } catch (error) {
      if (!(error instanceof WorkbenchError) || error.status !== 404) throw error;
    }
    // 示例仅作为用户显式选择的模板来源；真实运行仍须保存本地板子。
    return new ConfigDocuments(this.examplesRoot).raw("boards", name);
  }
  async boards(source?: "example"): Promise<BoardCard[]> {
    // 示例库有独立身份：同 ID 已复制到本地，也不能让“新建”失去原始模板。
    const local = source === "example" ? [] : await this.documents.list("boards"),
      example = await new ConfigDocuments(this.examplesRoot).list("boards");
    return Promise.all(
      [...new Set([...local, ...example])].sort().map(async (name) => {
        let raw: JsonObject = {};
        let problem: Diagnostic | undefined;
        try {
          raw = await this.boardRaw(name, source);
          parseBoardDefinition(raw, name);
        } catch (error) {
          problem = diagnostic(error);
        }
        const board = raw.board as JsonObject | undefined;
        return {
          id: name,
          size: typeof board?.size === "number" ? board.size : 0,
          roles: Array.isArray(board?.roleSetups)
            ? board.roleSetups.flatMap((row) =>
                row &&
                typeof row === "object" &&
                !Array.isArray(row) &&
                typeof row.role === "string" &&
                typeof row.count === "number" &&
                Number.isSafeInteger(row.count) &&
                row.count > 0 &&
                row.count <= 128
                  ? [{ role: row.role, count: row.count }]
                  : [],
              )
            : [],
          supported: !problem,
          ...(problem ? { diagnostic: problem } : {}),
          source: local.includes(name) ? "local" : "example",
          ...(!problem
            ? {
                rules: raw.rules as JsonObject,
                mechanisms: raw.mechanisms as JsonObject,
                roleOptions: raw.roles as JsonObject,
              }
            : {}),
        };
      }),
    );
  }
  async summary() {
    let backends: JsonObject = {},
      agents: JsonObject = {};
    try {
      backends = await this.documents.raw("backends", "backends");
    } catch {}
    try {
      agents = await this.documents.raw("agents", "agents");
    } catch {}
    const connections =
      backends.items && typeof backends.items === "object" && !Array.isArray(backends.items)
        ? (backends.items as JsonObject)
        : {};
    const profiles =
      agents.items && typeof agents.items === "object" && !Array.isArray(agents.items)
        ? (agents.items as JsonObject)
        : {};
    return {
      games: await this.documents.list("games"),
      gameCards: await this.gameCards(stringValue(agents.default)),
      defaultAgent: stringValue(agents.default),
      agents: Object.entries(profiles).map(([name, value]) => {
        const entry = value as JsonObject,
          backend = typeof entry?.backend === "string" ? entry.backend : "";
        const connection = connections[backend] as JsonObject | undefined,
          options = entry?.options as JsonObject | undefined;
        return {
          name,
          backend,
          kind: stringValue(connection?.kind),
          provider: stringValue(options?.defaultProvider),
          model: stringValue(options?.model) ?? stringValue(options?.defaultModel),
        };
      }),
      backends: Object.entries(connections).map(([name, value]) => ({
        name,
        kind: stringValue((value as JsonObject)?.kind),
        ...(() => {
          const limits = (value as JsonObject)?.limits as JsonObject | undefined;
          const config = (value as JsonObject)?.config as JsonObject | undefined;
          return {
            ...(typeof limits?.maxConcurrentRequests === "number"
              ? { maxConcurrentRequests: limits.maxConcurrentRequests }
              : {}),
            ...(typeof config?.initializeTimeoutMs === "number"
              ? { initializeTimeoutMs: config.initializeTimeoutMs }
              : {}),
          };
        })(),
        ...(() => {
          const config = (value as JsonObject)?.config as JsonObject | undefined;
          const native = config?.models as JsonObject | undefined;
          const providers = native?.providers;
          const auth = config?.auth;
          return {
            // 只摘要模型标识与请求档位；不向目录暴露原生 headers、认证或其它采样字段。
            registeredModels: Object.fromEntries(
              Object.entries((providers ?? {}) as JsonObject).flatMap(([id, value]) => {
                if (!value || typeof value !== "object" || Array.isArray(value)) return [];
                const models = value.models;
                return [
                  [
                    id,
                    Array.isArray(models)
                      ? models.flatMap((row) =>
                          row &&
                          typeof row === "object" &&
                          !Array.isArray(row) &&
                          typeof row.id === "string"
                            ? [row.id]
                            : [],
                        )
                      : [],
                  ],
                ];
              }),
            ),
            modelTiers: Object.fromEntries(
              Object.entries((providers ?? {}) as JsonObject).flatMap(([id, value]) => {
                if (!value || typeof value !== "object" || Array.isArray(value)) return [];
                const tiers: Record<string, string> = {};
                for (const row of Array.isArray(value.models) ? value.models : []) {
                  if (
                    !row ||
                    typeof row !== "object" ||
                    Array.isArray(row) ||
                    typeof row.id !== "string"
                  )
                    continue;
                  const params = row.samplingParams;
                  const tier =
                    params && typeof params === "object" && !Array.isArray(params)
                      ? params.service_tier
                      : undefined;
                  if (typeof tier === "string") tiers[row.id] = tier;
                }
                const overrides = value.modelOverrides;
                for (const [modelId, patch] of Object.entries((overrides ?? {}) as JsonObject)) {
                  if (!patch || typeof patch !== "object" || Array.isArray(patch)) continue;
                  const params = patch.samplingParams;
                  const tier =
                    params && typeof params === "object" && !Array.isArray(params)
                      ? params.service_tier
                      : undefined;
                  if (typeof tier === "string") tiers[modelId] = tier;
                }
                return [[id, tiers]];
              }),
            ),
            providers:
              providers && typeof providers === "object" && !Array.isArray(providers)
                ? Object.keys(providers)
                : [],
            authProviders:
              auth && typeof auth === "object" && !Array.isArray(auth) ? Object.keys(auth) : [],
          };
        })(),
      })),
    };
  }
  private async gameCards(defaultAgent?: string): Promise<GameCard[]> {
    return Promise.all(
      (await this.documents.list("games")).map(async (name) => {
        const card: GameCard = { id: name, source: "local", roleAgents: {}, seatAgents: {} };
        try {
          const document = await this.documents.read("games", name);
          card.revision = document.revision!;
          const raw = objectDocument(document.text);
          card.board = typeof raw.board === "string" ? raw.board.trim() : "six_player_mvp";
          card.defaultAgent = stringValue(raw.agent) ?? defaultAgent;
          for (const [field, target] of [
            ["roles", card.roleAgents],
            ["players", card.seatAgents],
          ] as const) {
            const entries = raw[field];
            if (entries && typeof entries === "object" && !Array.isArray(entries))
              for (const [key, row] of Object.entries(entries)) {
                const agent =
                  row && typeof row === "object" && !Array.isArray(row)
                    ? stringValue(row.agent)
                    : undefined;
                if (agent) target[key] = agent;
              }
          }
          const board = await this.documents.raw("boards", card.board);
          const definition = parseBoardDefinition(board, card.board);
          card.size = definition.definition.board.size;
        } catch (error) {
          card.diagnostic = diagnostic(error);
        }
        return card;
      }),
    );
  }
  /** 启动只读已保存配置；模板只能在用户明确创建／复制时落盘。 */
  async validateSavedGame(gameName: string, expectedRevision?: string): Promise<void> {
    const document = await this.documents.read("games", gameName);
    if (expectedRevision !== undefined && document.revision !== expectedRevision)
      throw new WorkbenchError("config_conflict", 409);
    const game = objectDocument(document.text);
    await this.validate("games", gameName, game);
    if (
      expectedRevision !== undefined &&
      (await this.documents.read("games", gameName)).revision !== expectedRevision
    )
      throw new WorkbenchError("config_conflict", 409);
  }
  async delete(kind: ConfigKind, name: string, revision: string): Promise<void> {
    await this.documents.delete(kind, name, revision, async () => {
      if (kind !== "boards") return;
      const references: string[] = [];
      for (const gameName of await this.documents.list("games")) {
        let raw: JsonObject;
        try {
          raw = await this.documents.raw("games", gameName);
        } catch {
          // 无法读取引用关系时不能假设该板子未被使用。
          throw new WorkbenchError("board_references_unreadable", 409, undefined, [gameName]);
        }
        const board = typeof raw.board === "string" ? raw.board.trim() : "six_player_mvp";
        if (board === name) references.push(gameName);
      }
      if (references.length) throw new WorkbenchError("board_in_use", 409, undefined, references);
    });
  }
}
