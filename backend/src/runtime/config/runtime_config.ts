import { promises as fs } from "fs";
import * as path from "path";

/** `openai` covers OpenRouter and other Chat Completions-compatible gateways. */
export type ProviderType = "openai" | "anthropic" | "acp";

export interface LlmProviderConfig {
  type: "openai" | "anthropic";
  apiKey: string;
  baseURL?: string;
  userAgent?: string;
  maxConcurrentRequests?: number;
}

/** ACP 是 Agent 进程传输，不是模型 API Provider。 */
export interface AcpProviderConfig {
  type: "acp";
  transport?: "stdio";
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  maxConcurrentSessions?: number;
  initializeTimeoutMs?: number;
}

export type ProviderConfig = LlmProviderConfig | AcpProviderConfig;

export interface AgentProfileConfig {
  model: string;
  temperature?: number;
  maxTokens?: number;
  forceJsonResponse?: boolean;
  reasoningEnabled?: boolean;
  reasoningEffort?: "low" | "medium" | "high";
  thinkingEnabled?: boolean;
  personalityPrompt?: string;
}

export interface LlmAgentEntryConfig extends AgentProfileConfig {
  kind?: "llm";
  provider: string;
}

export interface AcpAgentEntryConfig {
  kind: "acp";
  provider: string;
  /** 静态 Agent 启动参数，可被 playerAgents 覆盖；不允许存放身份或游戏状态。 */
  spawnArgs?: string[];
  sessionReuse?: "per_player";
  actionTransport?: "mcp";
}

export type AgentEntryConfig = LlmAgentEntryConfig | AcpAgentEntryConfig;

export interface ProvidersConfig {
  default: string;
  items: Record<string, ProviderConfig>;
}

export interface AgentsConfig {
  default: string;
  items: Record<string, AgentEntryConfig>;
}

/** 对局中按位置/角色选择 Agent；对象形式仅允许覆写静态启动参数。 */
export type GameAgentSelection =
  | string
  | {
      agent: string;
      spawnArgs?: string[];
    };

// 兼容旧版 agent.json 结构。
export interface LegacyAgentConfig {
  default: AgentProfileConfig;
  roles?: Record<string, Partial<AgentProfileConfig>>;
  players?: Record<string, Partial<AgentProfileConfig>>;
}

export interface GameConfig {
  board?: "six_player_mvp" | "twelve_player_standard";
  maxDays?: number;
  maxRuntimeMs?: number;
  llmTimeoutMs?: number;
  trace?: boolean;
  printAllEvents?: boolean;
  printChat?: boolean;
  streamEvents?: boolean;
  color?: boolean;
  printLlmIo?: boolean;
  printThinking?: boolean;
  printPrivateEvents?: boolean;
  recordRootDir?: string;
  // 新结构：对局引用已定义 agent 名称，不再内联定义模型参数。
  agent?: string;
  roleAgents?: Record<string, GameAgentSelection>;
  playerAgents?: Record<string, GameAgentSelection>;
  debugSummaryAgent?: string;
  // 兼容旧结构（将逐步弃用）。
  roleAgentProfiles?: Record<string, Partial<AgentProfileConfig>>;
  playerAgentProfiles?: Record<string, Partial<AgentProfileConfig>>;
}

export interface DebugSummaryConfig {
  agent?: {
    enabled?: boolean;
    // 新结构：可直接指定调试汇总 agent 名称（引用 agents.items）。
    agentName?: string;
    // 兼容旧结构：保留 profile 覆盖。
    profile?: Partial<AgentProfileConfig>;
    timeoutMs?: number;
    maxAttempts?: number;
    concurrency?: number;
    publicMaxItems?: number;
    maxItems?: number;
    playerMaxItems?: number;
  };
}

export interface RuntimeConfig {
  // 新结构
  providers: ProvidersConfig;
  agents: AgentsConfig;
  // 兼容字段（由新结构推导，供旧调用点过渡）
  provider: ProviderConfig;
  agent: LegacyAgentConfig;
  game?: GameConfig;
  debugSummary?: DebugSummaryConfig;
}

export interface ResolvedAgentRuntimeProfile {
  name: string;
  providerName: string;
  provider: ProviderConfig;
  kind: "llm" | "acp";
  model?: string;
  temperature?: number;
  maxTokens?: number;
  forceJsonResponse?: boolean;
  reasoningEnabled?: boolean;
  reasoningEffort?: "low" | "medium" | "high";
  thinkingEnabled?: boolean;
  personalityPrompt?: string;
  spawnArgs?: string[];
  sessionReuse?: "per_player";
  actionTransport?: "mcp";
}

let cachedConfig: RuntimeConfig | null = null;
let overrideConfig: RuntimeConfig | null = null;

function resolveEnvironmentValue(value: string, field: string): string {
  const match = /^\$\{([A-Z][A-Z0-9_]*)\}$/.exec(value.trim());
  if (!match) {
    return value;
  }
  const resolved = process.env[match[1]]?.trim();
  if (!resolved) {
    throw new Error(`runtime_config_missing_environment_value: ${field} -> ${match[1]}`);
  }
  return resolved;
}

function normalizeProviderConfig(name: string, value: ProviderConfig): ProviderConfig {
  if (value.type === "acp") {
    if (!value.command?.trim()) {
      throw new Error(`runtime_config_acp_command_missing: ${name}`);
    }
    if (value.transport && value.transport !== "stdio") {
      throw new Error(`runtime_config_acp_transport_unsupported: ${name}`);
    }
    return {
      ...value,
      transport: "stdio",
      args: value.args ?? [],
      env: Object.fromEntries(
        Object.entries(value.env ?? {}).map(([key, envValue]) => [
          key,
          resolveEnvironmentValue(String(envValue), `providers.items.${name}.env.${key}`),
        ]),
      ),
    };
  }
  if (value.type !== "openai" && value.type !== "anthropic") {
    throw new Error(`runtime_config_provider_type_unsupported: ${name}`);
  }
  return {
    ...value,
    apiKey: resolveEnvironmentValue(value.apiKey, `providers.items.${name}.apiKey`),
  };
}

function resolveRepoRoot(): string {
  const cwd = process.cwd();
  if (cwd.endsWith("/backend")) {
    return path.resolve(cwd, "..");
  }
  return path.resolve(cwd);
}

async function readJsonIfExists(filePath: string): Promise<any | null> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function readGameOverride(configRoot: string): Promise<GameConfig | null> {
  const requestedName = process.env.GAME_CONFIG_NAME?.trim();
  const name = requestedName || "default";
  const gamesDir = path.join(configRoot, "games");
  const overridePath = path.join(gamesDir, `${name}.json`);
  const game = await readJsonIfExists(overridePath);
  if (!game && requestedName) {
    throw new Error(`runtime_config_game_not_found: ${overridePath}`);
  }
  return game;
}

function resolveConfigRoot(): string {
  const root = resolveRepoRoot();
  const envConfig = process.env.GAME_CONFIGS_DIR?.trim();
  if (envConfig) {
    return path.isAbsolute(envConfig) ? envConfig : path.resolve(root, envConfig);
  }
  throw new Error("runtime_config_missing_configs_dir: set GAME_CONFIGS_DIR");
}

function normalizeProviders(raw: any): ProvidersConfig {
  if (!raw || typeof raw !== "object") {
    throw new Error("runtime_config_invalid_providers");
  }
  // 兼容旧版 provider.json（单 provider）。
  if (typeof raw.type === "string" && (typeof raw.apiKey === "string" || raw.type === "acp")) {
    const provider = normalizeProviderConfig("default", raw as ProviderConfig);
    return {
      default: "default",
      items: { default: provider },
    };
  }

  // 新版：{ default, items }。
  if (raw.items && typeof raw.items === "object") {
    const items = Object.fromEntries(
      Object.entries(raw.items as Record<string, ProviderConfig>).map(([name, provider]) => [
        name,
        normalizeProviderConfig(name, provider),
      ]),
    ) as Record<string, ProviderConfig>;
    const names = Object.keys(items);
    if (names.length === 0) {
      throw new Error("runtime_config_empty_providers_items");
    }
    const defaultName = typeof raw.default === "string" && raw.default ? raw.default : names[0];
    if (!items[defaultName]) {
      throw new Error(`runtime_config_provider_default_not_found: ${defaultName}`);
    }
    return { default: defaultName, items };
  }

  // 兼容：直接对象映射 { providerA: {...}, providerB: {...} }。
  const entries = Object.entries(raw).filter(
    ([key, value]) => key !== "default" && value && typeof value === "object",
  ) as Array<[string, ProviderConfig]>;
  if (entries.length > 0) {
    const items = Object.fromEntries(
      entries.map(([name, provider]) => [name, normalizeProviderConfig(name, provider)]),
    ) as Record<string, ProviderConfig>;
    const defaultName =
      typeof raw.default === "string" && raw.default ? raw.default : entries[0][0];
    if (!items[defaultName]) {
      throw new Error(`runtime_config_provider_default_not_found: ${defaultName}`);
    }
    return { default: defaultName, items };
  }
  throw new Error("runtime_config_invalid_providers_shape");
}

function normalizeAgents(raw: any, providers: ProvidersConfig): AgentsConfig {
  if (!raw || typeof raw !== "object") {
    throw new Error("runtime_config_invalid_agents");
  }

  // 兼容旧版 agent.json（仅 default profile，不含 provider）。
  if (raw.default && raw.default.model) {
    return {
      default: "default",
      items: {
        default: {
          ...(raw.default as AgentProfileConfig),
          provider: providers.default,
        },
      },
    };
  }

  // 新版：{ default, items }。
  if (raw.items && typeof raw.items === "object") {
    const items = raw.items as Record<string, AgentEntryConfig>;
    const names = Object.keys(items);
    if (names.length === 0) {
      throw new Error("runtime_config_empty_agents_items");
    }
    const defaultName = typeof raw.default === "string" && raw.default ? raw.default : names[0];
    if (!items[defaultName]) {
      throw new Error(`runtime_config_agent_default_not_found: ${defaultName}`);
    }
    validateAgentEntries(items, providers);
    return { default: defaultName, items };
  }

  // 兼容：直接对象映射 { agentA: {...}, agentB: {...} }。
  const entries = Object.entries(raw).filter(
    ([key, value]) => key !== "default" && value && typeof value === "object",
  ) as Array<[string, AgentEntryConfig]>;
  if (entries.length > 0) {
    const items = Object.fromEntries(entries);
    const defaultName =
      typeof raw.default === "string" && raw.default ? raw.default : entries[0][0];
    if (!items[defaultName]) {
      throw new Error(`runtime_config_agent_default_not_found: ${defaultName}`);
    }
    validateAgentEntries(items, providers);
    return { default: defaultName, items };
  }

  throw new Error("runtime_config_invalid_agents_shape");
}

function toLegacyAgentConfig(agents: AgentsConfig): LegacyAgentConfig {
  const def = agents.items[agents.default];
  if (def.kind === "acp") {
    // 兼容层不能承载 ACP；不让旧调用点误把 ACP 当作模型 API。
    return { default: { model: "" } };
  }
  return {
    default: {
      model: def.model,
      temperature: def.temperature,
      maxTokens: def.maxTokens,
      forceJsonResponse: def.forceJsonResponse,
      reasoningEnabled: def.reasoningEnabled,
      reasoningEffort: def.reasoningEffort,
      thinkingEnabled: def.thinkingEnabled,
      personalityPrompt: def.personalityPrompt,
    },
  };
}

export function resolveAgentProfileByName(
  runtime: RuntimeConfig,
  agentName?: string,
): ResolvedAgentRuntimeProfile {
  const selected = agentName && runtime.agents.items[agentName] ? agentName : runtime.agents.default;
  const entry = runtime.agents.items[selected];
  if (!entry) {
    throw new Error(`runtime_config_agent_not_found: ${String(agentName)}`);
  }
  const provider = runtime.providers.items[entry.provider];
  if (!provider) {
    throw new Error(
      `runtime_config_agent_provider_not_found: agent=${selected} provider=${entry.provider}`,
    );
  }
  return {
    name: selected,
    providerName: entry.provider,
    provider,
    kind: entry.kind ?? "llm",
    ...(entry.kind === "acp"
      ? {
          spawnArgs: entry.spawnArgs,
          sessionReuse: entry.sessionReuse,
          actionTransport: entry.actionTransport ?? "mcp",
        }
      : {
          model: entry.model,
          temperature: entry.temperature,
          maxTokens: entry.maxTokens,
          forceJsonResponse: entry.forceJsonResponse,
          reasoningEnabled: entry.reasoningEnabled,
          reasoningEffort: entry.reasoningEffort,
          thinkingEnabled: entry.thinkingEnabled,
          personalityPrompt: entry.personalityPrompt,
        }),
  };
}

function validateAgentEntries(items: Record<string, AgentEntryConfig>, providers: ProvidersConfig): void {
  for (const [name, agent] of Object.entries(items)) {
    if (!agent.provider || !providers.items[agent.provider]) {
      throw new Error(
        `runtime_config_agent_provider_not_found: agent=${name} provider=${String(agent.provider)}`,
      );
    }
    const provider = providers.items[agent.provider];
    if (agent.kind === "acp") {
      if (provider.type !== "acp") {
        throw new Error(`runtime_config_acp_agent_requires_acp_provider: ${name}`);
      }
      continue;
    }
    if (provider.type === "acp") {
      throw new Error(`runtime_config_llm_agent_requires_llm_provider: ${name}`);
    }
    if (!agent.model) {
      throw new Error(`runtime_config_agent_model_missing: ${name}`);
    }
  }
}

export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  if (overrideConfig) {
    return overrideConfig;
  }
  if (cachedConfig) {
    return cachedConfig;
  }
  const configRoot = resolveConfigRoot();
  const runtimeDir = path.join(configRoot, "runtime");
  const combinedPath = path.join(configRoot, "runtime_config.json");

  const providersRaw =
    (await readJsonIfExists(path.join(runtimeDir, "providers.json"))) ??
    (await readJsonIfExists(path.join(runtimeDir, "provider.json")));
  const agentsRaw =
    (await readJsonIfExists(path.join(runtimeDir, "agents.json"))) ??
    (await readJsonIfExists(path.join(runtimeDir, "agent.json")));
  const game = await readJsonIfExists(path.join(runtimeDir, "game.json"));
  const gameOverride = await readGameOverride(configRoot);
  const mergedGame = gameOverride ? { ...(game ?? {}), ...gameOverride } : game;
  const debugSummary = await readJsonIfExists(path.join(runtimeDir, "debug_summary.json"));

  if (providersRaw || agentsRaw || mergedGame || debugSummary) {
    if (!providersRaw || !agentsRaw) {
      throw new Error("runtime_config_missing_runtime_providers_or_agents");
    }
    const providers = normalizeProviders(providersRaw);
    const agents = normalizeAgents(agentsRaw, providers);
    const provider = providers.items[providers.default];
    const merged: RuntimeConfig = {
      providers,
      agents,
      provider,
      agent: toLegacyAgentConfig(agents),
      ...(mergedGame ? { game: mergedGame } : {}),
      ...(debugSummary ? { debugSummary } : {}),
    };
    cachedConfig = merged;
    return merged;
  }

  const combined = await readJsonIfExists(combinedPath);
  if (!combined) {
    throw new Error(`runtime_config_not_found: ${combinedPath}`);
  }

  const combinedOverride = await readGameOverride(configRoot);
  if (combinedOverride) {
    combined.game = { ...(combined.game ?? {}), ...combinedOverride };
  }

  const providers = normalizeProviders(combined.providers ?? combined.provider);
  const agents = normalizeAgents(combined.agents ?? combined.agent, providers);
  const provider = providers.items[providers.default];
  cachedConfig = {
    providers,
    agents,
    provider,
    agent: toLegacyAgentConfig(agents),
    ...(combined.game ? { game: combined.game as GameConfig } : {}),
    ...(combined.debugSummary ? { debugSummary: combined.debugSummary as DebugSummaryConfig } : {}),
  };
  return cachedConfig;
}

export function setRuntimeConfigOverride(config: RuntimeConfig | null): void {
  overrideConfig = config;
}

export function clearRuntimeConfigCache(): void {
  cachedConfig = null;
}
