/**
 * 负责工作台配置检查、可用板子目录与具名游戏摘要；输入原始文档，输出脱敏诊断及支持信息。
 * 实际解析和有限规则判断仍交 backend 唯一所有者；不启动 Agent，不把已解析认证写回原始文件。
 */
import { parseRuntimeConfig } from "@ai-werewolf-arena/game-runtime/config/parse";
import { parseBoardDefinition } from "@ai-werewolf-arena/game-runtime/config/board";
import { resolveGameSetup, resolveGameBoard } from "@ai-werewolf-arena/game-runtime/config/resolve";
import { configDiagnostic } from "@ai-werewolf-arena/game-runtime/config/diagnostics";
import { validateRuntimeNativeConfig } from "@ai-werewolf-arena/game-runtime/config/validate";
import type {
  BoardCard,
  ConfigKind,
  JsonObject,
  Diagnostic,
} from "@ai-werewolf-arena/workbench-contract";
import { ConfigDocuments, WorkbenchError } from "./config-documents";

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
  return { ...configDiagnostic(error), severity: "error" };
}
export class ConfigService {
  constructor(
    readonly documents: ConfigDocuments,
    readonly examplesRoot: string,
  ) {}
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
    const game = kind === "games" ? raw : {};
    const runtime = parseRuntimeConfig({ backends, agents, game });
    await validateRuntimeNativeConfig(runtime);
    if (kind === "games") {
      const boardId = resolveGameBoard(runtime);
      const board = parseBoardDefinition(await this.boardRaw(boardId), boardId);
      resolveGameSetup(runtime, {}, board);
    }
  }
  async boardRaw(name: string): Promise<JsonObject> {
    try {
      return await this.documents.raw("boards", name);
    } catch (error) {
      if (!(error instanceof WorkbenchError) || error.status !== 404) throw error;
    }
    // 示例仅作为用户显式选择的模板来源；真实运行仍须保存本地板子。
    return new ConfigDocuments(this.examplesRoot).raw("boards", name);
  }
  async boards(): Promise<BoardCard[]> {
    const local = await this.documents.list("boards"),
      example = await new ConfigDocuments(this.examplesRoot).list("boards");
    return Promise.all(
      [...new Set([...local, ...example])].sort().map(async (name) => {
        let raw: JsonObject = {};
        let problem: Diagnostic | undefined;
        try {
          raw = await this.boardRaw(name);
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
      })),
    };
  }
  async ensureBoard(name: string): Promise<void> {
    if ((await this.documents.list("boards")).includes(name)) return;
    const raw = await this.boardRaw(name);
    await this.documents.save(
      { kind: "boards", name, revision: null, text: JSON.stringify(raw) },
      (value) => this.validate("boards", name, value),
    );
  }
  async ensureGameBoard(gameName: string): Promise<void> {
    // 使用与实际运行相同的 parser／默认选择；原始字段可能省略或带合法首尾空白。
    const runtime = parseRuntimeConfig({
      backends: await this.documents.raw("backends", "backends"),
      agents: await this.documents.raw("agents", "agents"),
      game: await this.documents.raw("games", gameName),
    });
    await this.ensureBoard(resolveGameBoard(runtime));
  }
}
