/**
 * 负责平台向导的纯配置装配；输入用户字段与原生扩展，输出 backend/Agent 数据。缺省值仅作提示，不自动写入覆盖。
 * Pi 内置连接不重建模型表；原生扩展在对应对象层合并，认证不进入目录摘要。
 */
import type { Json, JsonObject } from "@ai-werewolf-arena/workbench-contract";
import { asObject } from "./config-edit";

export const platforms = [
  {
    id: "openai",
    name: "OpenAI API",
    provider: "openai",
    kind: "pi",
    credential: "OPENAI_API_KEY",
  },
  { id: "codex", name: "OpenAI Codex", provider: "openai-codex", kind: "pi", credential: "" },
  {
    id: "anthropic",
    name: "Anthropic API",
    provider: "anthropic",
    kind: "pi",
    credential: "ANTHROPIC_API_KEY",
  },
  {
    id: "zhipu",
    name: "Zhipu Coding Plan",
    provider: "zai-coding-cn",
    kind: "pi",
    credential: "ZAI_CODING_CN_API_KEY",
  },
  {
    id: "kimi",
    name: "Kimi Coding",
    provider: "kimi-coding",
    kind: "pi",
    credential: "KIMI_API_KEY",
  },
  { id: "pi-native", name: "Pi · Native provider", provider: "", kind: "pi", credential: "" },
  { id: "compatible", name: "OpenAI Compatible", provider: "openai", kind: "llm", credential: "" },
  { id: "claude-code", name: "Claude Code ACP", provider: "acp", kind: "acp", credential: "" },
  { id: "acp", name: "Custom ACP", provider: "acp", kind: "acp", credential: "" },
] as const;
export type Platform = (typeof platforms)[number];
export interface ModelSummary {
  provider: string;
  id: string;
  name: string;
  baseUrl?: string;
  reasoning: boolean;
  thinkingLevels: string[];
}
export interface ConnectionSummary {
  name: string;
  kind?: string;
  providers?: string[];
  authProviders?: string[];
  registeredModels?: Record<string, string[]>;
  modelTiers?: Record<string, Record<string, string>>;
  maxConcurrentRequests?: number;
  initializeTimeoutMs?: number;
}
/** GUI 管理的字段不能再由原生扩展重复声明；在写入任何文件前报告冲突。 */
export function rejectNativeFields(extension: JsonObject, fields: string[]): void {
  const field = fields.find((name) => Object.hasOwn(extension, name));
  if (field) throw Error(`native_field_conflict: ${field}`);
}
export function thinkingValue(
  kind: string,
  provider: string,
  model: string,
  options: JsonObject,
): string {
  return String(
    kind === "pi"
      ? (asObject(options.modelThinkingLevels)[`${provider}/${model}`] ??
          options.defaultThinkingLevel ??
          "")
      : (options.reasoningEffort ?? ""),
  );
}
/** 改动当前模型的有效等级，同时移除它的旧覆盖；其他模型的偏好完整保留。 */
export function changeThinking(
  kind: string,
  provider: string,
  model: string,
  options: JsonObject,
  level: string,
): JsonObject {
  const next = { ...options };
  const field = kind === "pi" ? "defaultThinkingLevel" : "reasoningEffort";
  if (level) next[field] = level;
  else delete next[field];
  if (kind === "pi" && next.modelThinkingLevels) {
    const overrides = { ...asObject(next.modelThinkingLevels) };
    delete overrides[`${provider}/${model}`];
    if (Object.keys(overrides).length) next.modelThinkingLevels = overrides;
    else delete next.modelThinkingLevels;
  }
  return next;
}
export function connectionTier(
  connection: ConnectionSummary | undefined,
  provider: string,
  model: string,
): string {
  return connection?.modelTiers?.[provider]?.[model] ?? "";
}
/** 原生模型声明先提供采样参数，modelOverrides 再逐字段覆盖，与运行时合并顺序一致。 */
export function nativeModelTier(config: JsonObject, provider: string, model: string): string {
  const declaration = asObject(asObject(asObject(config.models).providers)[provider]);
  const models = Array.isArray(declaration.models) ? declaration.models : [];
  const defined = asObject(models.find((item) => asObject(item).id === model));
  const override = asObject(asObject(declaration.modelOverrides)[model]);
  return String(
    asObject(override.samplingParams).service_tier ??
      asObject(defined.samplingParams).service_tier ??
      "",
  );
}
/** 传输相同不等于认证可复用；Pi 必须具有相应 provider 的认证或原生连接声明。 */
export function compatibleConnection(
  connection: ConnectionSummary | undefined,
  platform: Platform,
  provider: string = platform.provider,
): boolean {
  return (
    connection?.kind === platform.kind &&
    (platform.kind !== "pi" ||
      (!!provider &&
        [...(connection.authProviders ?? []), ...(connection.providers ?? [])].includes(provider)))
  );
}
/** 部分保存的 Codex 连接可恢复；已有订阅认证的复用不再次覆盖令牌。 */
export function requiresCodexImport(platform: Platform, connection?: ConnectionSummary): boolean {
  return platform.id === "codex" && !connection?.authProviders?.includes("openai-codex");
}
export function nativeObject(text: string): JsonObject {
  const raw: unknown = JSON.parse(text);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw Error("object_required");
  return raw as JsonObject;
}
export function stringMap(raw: JsonObject): JsonObject {
  if (Object.values(raw).some((value) => typeof value !== "string"))
    throw Error("invalid_environment");
  return raw;
}
export interface PlatformInput {
  platform: Platform;
  provider: string;
  model: string;
  key: string;
  baseURL: string;
  fast: boolean;
  command: string;
  args: string;
  env: string;
  native: string;
  maxConcurrentRequests?: string;
  initializeTimeoutMs?: string;
}
function optionalPositive(value: string | undefined, field: string): number | undefined {
  if (!value?.trim()) return undefined;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0)
    throw Error(`positive_integer_required: ${field}`);
  return parsed;
}
export function buildConnection(input: PlatformInput): JsonObject {
  const { platform, provider, model, key, fast } = input;
  const baseURL = input.baseURL.trim();
  const extension = nativeObject(input.native);
  let config: JsonObject;
  if (platform.kind === "pi") {
    const nativeProvider = asObject(asObject(asObject(extension.models).providers)[provider]);
    if (baseURL && Object.hasOwn(nativeProvider, "baseUrl"))
      throw Error("native_field_conflict: models.providers.baseUrl");
    if (key && Object.hasOwn(asObject(extension.auth), provider))
      throw Error("native_field_conflict: auth.provider");
    if (platform.id === "codex" && Object.hasOwn(asObject(extension.auth), provider))
      throw Error("native_field_conflict: auth.openai-codex");
    if (fast && platform.id === "codex") {
      const tier = nativeModelTier(extension, provider, model);
      if (tier && tier !== "priority")
        throw Error("native_field_conflict: modelOverrides.samplingParams.service_tier");
    }
    if (!provider) throw Error("provider_required");
    if (
      platform.id !== "codex" &&
      !key &&
      !Object.keys(asObject(extension.auth)).length &&
      !Object.keys(asObject(extension.models)).length
    )
      throw Error("api_key_required");
    const providers: JsonObject = { ...asObject(asObject(extension.models).providers) };
    if (baseURL || (fast && platform.id === "codex")) {
      const prior = asObject(providers[provider]);
      providers[provider] = {
        ...prior,
        ...(baseURL ? { baseUrl: baseURL } : {}),
        ...(fast && platform.id === "codex"
          ? {
              modelOverrides: {
                ...asObject(prior.modelOverrides),
                [model]: {
                  ...asObject(asObject(prior.modelOverrides)[model]),
                  samplingParams: {
                    ...asObject(asObject(asObject(prior.modelOverrides)[model]).samplingParams),
                    service_tier: "priority",
                  },
                },
              },
            }
          : {}),
      };
    }
    config = {
      ...extension,
      models: { ...asObject(extension.models), providers },
      auth: {
        ...asObject(extension.auth),
        ...(platform.id === "codex" || !key ? {} : { [provider]: { type: "api_key", key } }),
      },
    };
  } else if (platform.kind === "llm") {
    rejectNativeFields(extension, ["type", "apiKey", "baseURL"]);
    if (!key || !baseURL) throw Error("connection_fields_required");
    config = { ...extension, type: "openai", apiKey: key, baseURL };
  } else {
    rejectNativeFields(extension, ["transport", "command", "args", "env", "initializeTimeoutMs"]);
    if (!input.command.trim()) throw Error("acp_command_required");
    const args: Json = JSON.parse(input.args);
    if (!Array.isArray(args) || args.some((value) => typeof value !== "string"))
      throw Error("invalid_arguments");
    config = {
      ...extension,
      transport: "stdio",
      command: input.command.trim(),
      args,
      env: stringMap(nativeObject(input.env)),
      ...(input.initializeTimeoutMs?.trim()
        ? {
            initializeTimeoutMs: optionalPositive(input.initializeTimeoutMs, "initializeTimeoutMs"),
          }
        : {}),
    };
  }
  const concurrency = optionalPositive(input.maxConcurrentRequests, "maxConcurrentRequests");
  return {
    kind: platform.kind,
    config,
    ...(concurrency ? { limits: { maxConcurrentRequests: concurrency } } : {}),
  };
}
/** 模型与思考归 Agent；会话、认证、并发与工具缺省不混入模型目录。 */
export function buildAgentOptions(
  platform: Platform,
  provider: string,
  model: string,
  thinking: string,
  extension: JsonObject,
): JsonObject {
  if (platform.kind !== "acp" && !model) throw Error("model_required");
  rejectNativeFields(
    extension,
    platform.kind === "pi"
      ? ["defaultProvider", "defaultModel", "defaultThinkingLevel", "defaultTools", "cacheWarming"]
      : platform.kind === "llm"
        ? ["model", "reasoningEffort"]
        : ["sessionReuse", "actionTransport"],
  );
  return platform.kind === "pi"
    ? {
        ...extension,
        defaultProvider: provider,
        defaultModel: model,
        ...(thinking ? { defaultThinkingLevel: thinking } : {}),
        defaultTools: [],
        cacheWarming: "off",
      }
    : platform.kind === "llm"
      ? { ...extension, model, ...(thinking ? { reasoningEffort: thinking } : {}) }
      : { ...extension, sessionReuse: "per_player", actionTransport: "mcp" };
}
