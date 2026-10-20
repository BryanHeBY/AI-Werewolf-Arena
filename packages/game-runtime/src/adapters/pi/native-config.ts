/**
 * 负责校验原生 Pi JSON，并把 models.json 的有限声明映射到 SDK 公开内存注册口。
 * 不读取配置文件、不创建临时 models.json、不调用未公开 parser；未知能力明确拒绝。
 * 原生字段名及默认值保留，命令型密钥/头被拒绝，避免关闭工具后仍有配置触发 shell。
 * 校验为同步纯数据工作，没有独立 deadline；执行与取消期限交由会话 signal 及上层调度器。
 */
import type { Api, Credential, Model } from "@earendil-works/pi-ai";
import type { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { Type, type Static, type TSchema } from "typebox";
import { Compile } from "typebox/compile";
import type { PiHostConfig } from "./contracts";
// @ts-ignore SDK 公共 exports 子路径要求现代解析器；生产仍支持旧 node 解析，Bun 按 import 条件加载。
import * as publicModelSchemas from "@earendil-works/pi-ai/providers/model-schema";
// @ts-ignore 同上：这是 SDK 公布的 schema 子路径，不依赖内部 dist 文件；tests bundler 可正常解析。
import * as publicCompatSchemas from "@earendil-works/pi-ai/providers/compat-schema";

const text = Type.String({ minLength: 1 });
// 这些是包 exports 公布的子路径；旧 node 类型解析器不理解 exports，保持运行时公共路径而不深导 dist。
const modelSchemas = publicModelSchemas as Record<string, TSchema>;
const compatSchemas = publicCompatSchemas as Record<string, TSchema>;
const ModelCostSchema = Type.Unsafe<Model<Api>["cost"]>(modelSchemas.ModelCostSchema!);
const ModelInputLimitsSchema = Type.Unsafe<NonNullable<Model<Api>["inputLimits"]>>(
  modelSchemas.ModelInputLimitsSchema!,
);
const ModelPromptCacheSchema = Type.Unsafe<NonNullable<Model<Api>["promptCache"]>>(
  modelSchemas.ModelPromptCacheSchema!,
);
const ThinkingLevelMapSchema = Type.Unsafe<NonNullable<Model<Api>["thinkingLevelMap"]>>(
  modelSchemas.ThinkingLevelMapSchema!,
);
const ProviderCompatSchema = Type.Unsafe<NonNullable<Model<Api>["compat"]>>(
  compatSchemas.ProviderCompatSchema!,
);
const headers = Type.Record(Type.String(), Type.String());
const sampling = Type.Record(Type.String(), Type.Unknown());
const byThinking = Type.Object(
  Object.fromEntries(
    ["off", "minimal", "low", "medium", "high", "xhigh", "max"].map((key) => [
      key,
      Type.Optional(sampling),
    ]),
  ),
  { additionalProperties: false },
);
const modelFields = {
  name: Type.Optional(text),
  reasoning: Type.Optional(Type.Boolean()),
  thinkingLevelMap: Type.Optional(ThinkingLevelMapSchema),
  input: Type.Optional(Type.Array(Type.Union([Type.Literal("text"), Type.Literal("image")]))),
  inputLimits: Type.Optional(ModelInputLimitsSchema),
  cost: Type.Optional(ModelCostSchema),
  promptCache: Type.Optional(ModelPromptCacheSchema),
  contextWindow: Type.Optional(Type.Number({ exclusiveMinimum: 0 })),
  maxTokens: Type.Optional(Type.Number({ exclusiveMinimum: 0 })),
  samplingParams: Type.Optional(sampling),
  samplingParamsByThinkingLevel: Type.Optional(byThinking),
  headers: Type.Optional(headers),
  compat: Type.Optional(ProviderCompatSchema),
};
const nativeModel = Type.Object(
  { id: text, api: Type.Optional(text), baseUrl: Type.Optional(text), ...modelFields },
  { additionalProperties: false },
);
const partialCost = Type.Object({
  input: Type.Optional(Type.Number()),
  output: Type.Optional(Type.Number()),
  cacheRead: Type.Optional(Type.Number()),
  cacheWrite: Type.Optional(Type.Number()),
  tiers: Type.Optional(
    Type.Array(
      Type.Object({
        input: Type.Number(),
        output: Type.Number(),
        cacheRead: Type.Number(),
        cacheWrite: Type.Number(),
        inputTokensAbove: Type.Number(),
      }),
    ),
  ),
});
const override = Type.Object(
  { ...modelFields, cost: Type.Optional(partialCost) },
  { additionalProperties: false },
);
const provider = Type.Object(
  {
    name: Type.Optional(text),
    baseUrl: Type.Optional(text),
    apiKey: Type.Optional(text),
    api: Type.Optional(text),
    oauth: Type.Optional(Type.Literal("radius")),
    headers: Type.Optional(headers),
    compat: Type.Optional(ProviderCompatSchema),
    authHeader: Type.Optional(Type.Boolean()),
    models: Type.Optional(Type.Array(nativeModel)),
    modelOverrides: Type.Optional(Type.Record(Type.String(), override)),
  },
  { additionalProperties: false },
);
const modelsSchema = Type.Object(
  {
    $schema: Type.Optional(Type.String()),
    providers: Type.Optional(Type.Record(Type.String(), provider)),
  },
  { additionalProperties: false },
);
const modelsValidator = Compile(modelsSchema);
type NativeModels = Static<typeof modelsSchema>;
type ProviderInput = Parameters<ModelRuntime["registerProvider"]>[1];

/** 仅验证并复制 JSON；错误不包含密钥值或完整配置。 */
export function validatePiHostConfig(input: PiHostConfig): PiHostConfig {
  const models = structuredClone(input.models);
  const auth = structuredClone(input.auth);
  if (!modelsValidator.Check(models)) {
    const first = modelsValidator.Errors(models)[0];
    throw new Error(`pi_models_invalid: ${first?.instancePath ?? "root"}`);
  }
  for (const [id, config] of Object.entries(models.providers ?? {})) {
    if (!id || config.oauth !== undefined) throw new Error(`pi_models_unsupported_oauth: ${id}`);
    for (const value of [
      config.apiKey,
      ...Object.values(config.headers ?? {}),
      ...(config.models ?? []).flatMap((model) => Object.values(model.headers ?? {})),
      ...Object.values(config.modelOverrides ?? {}).flatMap((model) =>
        Object.values(model.headers ?? {}),
      ),
    ]) {
      if (value?.startsWith("!")) throw new Error(`pi_config_shell_disabled: ${id}`);
    }
    const ids = (config.models ?? []).map((model) => model.id);
    if (new Set(ids).size !== ids.length) throw new Error(`pi_models_duplicate_id: ${id}`);
  }
  if (!auth || Array.isArray(auth) || typeof auth !== "object") throw new Error("pi_auth_invalid");
  for (const value of Object.values(auth)) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error("pi_auth_invalid");
    const credential = value as Record<string, unknown>;
    if (credential.type === "api_key") {
      if (credential.key !== undefined && typeof credential.key !== "string")
        throw new Error("pi_auth_invalid");
      if (
        credential.env !== undefined &&
        (!credential.env ||
          typeof credential.env !== "object" ||
          Array.isArray(credential.env) ||
          Object.values(credential.env).some((entry) => typeof entry !== "string"))
      )
        throw new Error("pi_auth_invalid");
    } else if (
      credential.type !== "oauth" ||
      typeof credential.access !== "string" ||
      typeof credential.refresh !== "string" ||
      typeof credential.expires !== "number" ||
      !Number.isFinite(credential.expires)
    ) {
      throw new Error("pi_auth_invalid");
    }
  }
  return { models, auth };
}

/** Pi 仍拥有 Settings；宿主禁用资源发现和额外预热请求，模型选择必须显式给出。 */
export function validatePiSettings(input: Record<string, unknown> = {}): Record<string, unknown> {
  const settings = structuredClone(input);
  if (
    typeof settings.defaultProvider !== "string" ||
    !settings.defaultProvider ||
    typeof settings.defaultModel !== "string" ||
    !settings.defaultModel
  )
    throw new Error("pi_settings_model_required");
  if (settings.cacheWarming !== undefined && settings.cacheWarming !== "off")
    throw new Error("pi_cache_warming_disabled");
  for (const field of [
    "packages",
    "extensions",
    "skills",
    "prompts",
    "themes",
    "defaultTools",
    "mcpServers",
  ]) {
    const value = settings[field];
    if (
      value !== undefined &&
      (Array.isArray(value)
        ? value.length > 0
        : typeof value !== "object" || value === null || Object.keys(value).length > 0)
    )
      throw new Error(`pi_resources_disabled: ${field}`);
  }
  if (
    settings.defaultThinkingLevel !== undefined &&
    !["off", "minimal", "low", "medium", "high", "xhigh", "max"].includes(
      String(settings.defaultThinkingLevel),
    )
  )
    throw new Error("pi_settings_thinking_invalid");
  return { ...settings, cacheWarming: "off" };
}

function mergeNested(base: unknown, next: unknown): Record<string, unknown> | undefined {
  if (next === undefined) return base as Record<string, unknown> | undefined;
  return { ...(base as Record<string, unknown> | undefined), ...(next as Record<string, unknown>) };
}

/** 与 Pi 1.3 models.json 的有限嵌套合并一致，不能把一个字段的覆盖扩大为整块丢失。 */
function mergeCompat(base: unknown, next: unknown): Model<Api>["compat"] {
  const result = mergeNested(base, next);
  if (!result || next === undefined) return result;
  for (const field of [
    "openRouterRouting",
    "vercelGatewayRouting",
    "chatTemplateKwargs",
    "chatTemplateArgs",
  ]) {
    const previous = (base as Record<string, unknown> | undefined)?.[field];
    const override = (next as Record<string, unknown>)[field];
    if ((previous && typeof previous === "object") || (override && typeof override === "object"))
      result[field] = mergeNested(previous, override);
  }
  return result;
}

function mergeInputLimits(
  base: Model<Api>["inputLimits"],
  next: Model<Api>["inputLimits"],
): Model<Api>["inputLimits"] {
  if (!next) return base;
  return {
    ...base,
    ...next,
    images: next.images
      ? {
          ...base?.images,
          ...next.images,
          resize: next.images.resize
            ? { ...base?.images?.resize, ...next.images.resize }
            : base?.images?.resize,
        }
      : base?.images,
  };
}

function mergeThinkingSampling(
  base: Model<Api>["samplingParamsByThinkingLevel"],
  next: Model<Api>["samplingParamsByThinkingLevel"],
): Model<Api>["samplingParamsByThinkingLevel"] {
  if (!next) return base;
  const result = { ...base };
  for (const level of ["off", "minimal", "low", "medium", "high", "xhigh", "max"] as const)
    if (next[level]) result[level] = { ...base?.[level], ...next[level] };
  return result;
}

/** 使用公开注册能力，不让 SDK 隐式加载本机 models/auth。 */
export function registerNativePiModels(
  runtime: ModelRuntime,
  raw: Record<string, unknown>,
): ReadonlySet<string> {
  const models = raw as NativeModels;
  for (const [id, config] of Object.entries(models.providers ?? {})) {
    const base = runtime.getModels(id);
    const byId = new Map<string, Model<Api>>(
      base.map((model) => [
        model.id,
        {
          ...model,
          baseUrl: config.baseUrl ?? model.baseUrl,
          compat: mergeCompat(model.compat, config.compat),
        },
      ]),
    );
    for (const model of config.models ?? []) {
      const defaults =
        base.find((entry) => entry.id === model.id) ??
        base.find((entry) => entry.api === (model.api ?? config.api)) ??
        base.find((entry) => entry.api === "openai-completions") ??
        base[0];
      const api = model.api ?? config.api ?? defaults?.api;
      const baseUrl = model.baseUrl ?? config.baseUrl ?? defaults?.baseUrl;
      if (!api || !baseUrl) throw new Error(`pi_model_api_base_required: ${id}/${model.id}`);
      byId.set(model.id, {
        ...model,
        api,
        provider: id,
        baseUrl,
        name: model.name ?? model.id,
        reasoning: model.reasoning ?? false,
        input: model.input ?? ["text"],
        cost: model.cost ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: model.contextWindow ?? 128000,
        maxTokens: model.maxTokens ?? 16384,
        compat: mergeCompat(config.compat, model.compat),
      } as (typeof base)[number]);
    }
    for (const [modelId, patch] of Object.entries(config.modelOverrides ?? {})) {
      const model = byId.get(modelId);
      if (!model) throw new Error(`pi_model_override_unknown: ${id}/${modelId}`);
      const next = {
        ...model,
        ...patch,
        cost: { ...model.cost, ...patch.cost },
        headers: config.models?.some((entry) => entry.id === modelId)
          ? mergeNested(patch.headers, model.headers)
          : mergeNested(model.headers, patch.headers),
        compat: mergeCompat(model.compat, patch.compat),
        inputLimits: mergeInputLimits(model.inputLimits, patch.inputLimits),
        promptCache: mergeNested(model.promptCache, patch.promptCache),
        thinkingLevelMap: mergeNested(model.thinkingLevelMap, patch.thinkingLevelMap),
        samplingParams: mergeNested(model.samplingParams, patch.samplingParams),
        samplingParamsByThinkingLevel: mergeThinkingSampling(
          model.samplingParamsByThinkingLevel,
          patch.samplingParamsByThinkingLevel,
        ),
      };
      byId.set(modelId, next as (typeof base)[number]);
    }
    // 扩展注册口接收完整模型声明；原生可省字段在上方按 1.3.0 的 defaults 补齐。
    const { modelOverrides: _overrides, compat: _compat, oauth: _oauth, ...plain } = config;
    runtime.registerProvider(id, { ...plain, models: [...byId.values()] } as ProviderInput);
  }
  return new Set(Object.keys(models.providers ?? {}));
}

export function nativePiCredentials(auth: Record<string, unknown>): Record<string, Credential> {
  return auth as Record<string, Credential>;
}
