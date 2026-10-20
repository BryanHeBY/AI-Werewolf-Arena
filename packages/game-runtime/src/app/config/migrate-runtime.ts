/**
 * 负责旧 runtime/providers 与扁平 agents 的纯 V2 转换和引用预检。输入为旧 JSON 对象及游戏引用，输出仍保留原认证占位原文，
 * 预检使用合成环境值，不查宿主环境、不启动原生 SDK；文件备份／发布由迁移命令独占拥有。
 */
import { parseRuntimeConfig } from "./parse-config";

function object(raw: unknown, field: string): Record<string, unknown> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw))
    throw new Error(`runtime_config_migration_shape_invalid: ${field}`);
  return raw as Record<string, unknown>;
}
function known(raw: Record<string, unknown>, keys: string[], field: string): void {
  for (const key of Object.keys(raw))
    if (!keys.includes(key)) throw new Error(`runtime_config_unknown_field: ${field}.${key}`);
}
function defaultName(
  raw: Record<string, unknown>,
  items: Record<string, unknown>,
  field: string,
): string {
  if (typeof raw.default !== "string" || !Object.hasOwn(items, raw.default))
    throw new Error(`runtime_config_migration_default_invalid: ${field}.default`);
  return raw.default;
}

/** 仅此显式工具认识旧格式；正常加载器不会调用它或探测 providers.json。 */
export function convertLegacyRuntime(providersInput: unknown, agentsInput: unknown) {
  const providers = object(providersInput, "providers"),
    agents = object(agentsInput, "agents");
  known(providers, ["default", "items"], "providers");
  known(agents, ["default", "items"], "agents");
  const providerItems = object(providers.items, "providers.items"),
    agentItems = object(agents.items, "agents.items");
  defaultName(providers, providerItems, "providers");
  const selected = defaultName(agents, agentItems, "agents");
  const backendItems = Object.fromEntries(
    Object.entries(providerItems).map(([name, value]) => {
      const old = object(value, `providers.items.${name}`);
      const { type, maxConcurrentRequests, sessionConfigOptions: _sessionDefaults, ...rest } = old;
      if (!["openai", "anthropic", "acp"].includes(String(type)))
        throw new Error(`runtime_config_provider_type_unsupported: providers.items.${name}.type`);
      // 会话默认值只在 ACP 合法；LLM 携带同名字段仍是未知字段，不能在迁移中悄悄丢掉。
      if (type !== "acp" && Object.hasOwn(old, "sessionConfigOptions"))
        throw new Error(
          `runtime_config_unknown_field: providers.items.${name}.sessionConfigOptions`,
        );
      if (type === "acp" && _sessionDefaults !== undefined) {
        const defaults = object(_sessionDefaults, `providers.items.${name}.sessionConfigOptions`);
        for (const [key, value] of Object.entries(defaults))
          if (!key.trim() || (typeof value !== "string" && typeof value !== "boolean"))
            throw new Error(
              `runtime_config_acp_session_config_option_invalid: providers.items.${name}.sessionConfigOptions.${key}`,
            );
      }
      return [
        name,
        {
          kind: type === "acp" ? "acp" : "llm",
          config: type === "acp" ? rest : { type, ...rest },
          ...(maxConcurrentRequests === undefined ? {} : { limits: { maxConcurrentRequests } }),
        },
      ];
    }),
  );
  const convertedAgents = Object.fromEntries(
    Object.entries(agentItems).map(([name, value]) => {
      const old = object(value, `agents.items.${name}`);
      const { kind, provider, personalityPrompt, ...options } = old;
      if (typeof provider !== "string" || !Object.hasOwn(providerItems, provider))
        throw new Error(`runtime_config_agent_backend_not_found: agents.items.${name}.backend`);
      const connection = object(providerItems[provider], `providers.items.${provider}`);
      if (kind !== (connection.type === "acp" ? "acp" : "llm"))
        throw new Error(`runtime_config_migration_kind_mismatch: agents.items.${name}.kind`);
      if (kind === "acp") {
        // 旧连接默认先应用，Agent 自己的同名键随后覆盖；多个 Agent 不共享可变 options。
        const defaults = connection.sessionConfigOptions;
        if (defaults !== undefined)
          options.sessionConfigOptions = {
            ...object(defaults, `providers.items.${provider}.sessionConfigOptions`),
            ...(options.sessionConfigOptions === undefined
              ? {}
              : object(options.sessionConfigOptions, `agents.items.${name}.sessionConfigOptions`)),
          };
      }
      return [
        name,
        {
          backend: provider,
          options,
          ...(personalityPrompt === undefined
            ? {}
            : { customInstructions: { text: personalityPrompt } }),
        },
      ];
    }),
  );
  const result = {
    backends: { schemaVersion: 2, items: backendItems },
    agents: { schemaVersion: 2, default: selected, items: convertedAgents },
  };
  preflightRuntimeMigration(result, [{}]);
  return result;
}

/** 占位符仅用于验证结构；不替换待发布对象，不把真实环境或认证放进预览报告。 */
export function preflightRuntimeMigration(
  converted: { backends: unknown; agents: unknown },
  games: readonly unknown[],
  debugSummary?: unknown,
): void {
  const environment: NodeJS.ProcessEnv = {};
  function collect(raw: unknown): void {
    if (typeof raw === "string") {
      const match = /^\$\{([A-Z][A-Z0-9_]*)\}$/.exec(raw.trim());
      if (match) environment[match[1]] = "migration-preflight-synthetic";
    } else if (Array.isArray(raw)) raw.forEach(collect);
    else if (raw && typeof raw === "object") Object.values(raw).forEach(collect);
  }
  collect(converted);
  for (const game of games.length ? games : [{}])
    parseRuntimeConfig({ ...converted, game, debugSummary, environment });
}
