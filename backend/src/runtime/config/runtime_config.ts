import dotenv from "dotenv";
import { promises as fs } from "fs";
import * as path from "path";

/** `openai` 同时覆盖 OpenRouter 等 Chat Completions 兼容网关。 */
export type ProviderType = "openai" | "anthropic" | "acp";
export type GameBoard = "six_player_mvp" | "twelve_player_standard";

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
  transport: "stdio";
  command: string;
  args: string[];
  env: Record<string, string>;
  cwd?: string;
  maxConcurrentSessions?: number;
  initializeTimeoutMs?: number;
  sessionConfigOptions: Record<string, string | boolean>;
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
  kind: "llm";
  provider: string;
}

export interface AcpAgentEntryConfig {
  kind: "acp";
  provider: string;
  /** 静态启动参数；不得包含身份或对局状态。 */
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

/** 对局仅引用已定义的 Agent；对象形式用于覆盖 ACP 启动参数。 */
export type GameAgentSelection =
  | string
  | {
      agent: string;
      spawnArgs?: string[];
    };

export interface GameConfig {
  board?: GameBoard;
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
  agent?: string;
  roleAgents?: Record<string, GameAgentSelection>;
  playerAgents?: Record<string, GameAgentSelection>;
}

export interface DebugSummaryAgentConfig {
  enabled?: boolean;
  agentName?: string;
  timeoutMs?: number;
  maxAttempts?: number;
  concurrency?: number;
  publicMaxItems?: number;
  maxItems?: number;
  playerMaxItems?: number;
}

export interface DebugSummaryConfig {
  agent?: DebugSummaryAgentConfig;
}

/** 唯一支持的运行时配置：providers、agents、一个具名 game 和可选 audit 配置。 */
export interface RuntimeConfig {
  providers: ProvidersConfig;
  agents: AgentsConfig;
  game: GameConfig;
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

function resolveRepoRoot(): string {
  const cwd = process.cwd();
  return cwd.endsWith("/backend") ? path.resolve(cwd, "..") : path.resolve(cwd);
}

dotenv.config({ path: path.join(resolveRepoRoot(), ".env") });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertKnownKeys(value: Record<string, unknown>, keys: string[], field: string): void {
  const allowed = new Set(keys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new Error(`runtime_config_unknown_field: ${field}.${key}`);
    }
  }
}

function readRequiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`runtime_config_required_string_invalid: ${field}`);
  }
  return value.trim();
}

function readOptionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  return readRequiredString(value, field);
}

function readOptionalBoolean(value: unknown, field: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") {
    throw new Error(`runtime_config_optional_boolean_invalid: ${field}`);
  }
  return value;
}

function readOptionalNumber(value: unknown, field: string): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`runtime_config_optional_number_invalid: ${field}`);
  }
  return value;
}

function readStringArray(value: unknown, field: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error(`runtime_config_string_array_invalid: ${field}`);
  }
  return value.map((item) => item.trim());
}

function resolveEnvironmentValue(value: string, field: string): string {
  const match = /^\$\{([A-Z][A-Z0-9_]*)\}$/.exec(value.trim());
  if (!match) return value;
  const resolved = process.env[match[1]]?.trim();
  if (!resolved) {
    throw new Error(`runtime_config_missing_environment_value: ${field} -> ${match[1]}`);
  }
  return resolved;
}

function readEnvironment(value: unknown, field: string): Record<string, string> {
  if (value === undefined) return {};
  if (!isRecord(value)) {
    throw new Error(`runtime_config_environment_invalid: ${field}`);
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, raw]) => [
      readRequiredString(key, `${field}.key`),
      resolveEnvironmentValue(readRequiredString(raw, `${field}.${key}`), `${field}.${key}`),
    ]),
  );
}

function readSessionConfigOptions(value: unknown, field: string): Record<string, string | boolean> {
  if (value === undefined) return {};
  if (!isRecord(value)) {
    throw new Error(`runtime_config_acp_session_config_options_invalid: ${field}`);
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, optionValue]) => {
      if (!key.trim() || (typeof optionValue !== "string" && typeof optionValue !== "boolean")) {
        throw new Error(`runtime_config_acp_session_config_option_invalid: ${field}.${key}`);
      }
      return [key, optionValue];
    }),
  );
}

function normalizeProviderConfig(name: string, raw: unknown): ProviderConfig {
  if (!isRecord(raw)) {
    throw new Error(`runtime_config_provider_invalid: ${name}`);
  }
  const type = readRequiredString(raw.type, `providers.items.${name}.type`);
  if (type === "acp") {
    assertKnownKeys(raw, [
      "type", "transport", "command", "args", "env", "cwd", "maxConcurrentSessions",
      "initializeTimeoutMs", "sessionConfigOptions",
    ], `providers.items.${name}`);
    const transport = raw.transport === undefined
      ? "stdio"
      : readRequiredString(raw.transport, `providers.items.${name}.transport`);
    if (transport !== "stdio") {
      throw new Error(`runtime_config_acp_transport_unsupported: ${name}`);
    }
    return {
      type: "acp",
      transport,
      command: readRequiredString(raw.command, `providers.items.${name}.command`),
      args: readStringArray(raw.args, `providers.items.${name}.args`),
      env: readEnvironment(raw.env, `providers.items.${name}.env`),
      cwd: readOptionalString(raw.cwd, `providers.items.${name}.cwd`),
      maxConcurrentSessions: readOptionalNumber(
        raw.maxConcurrentSessions,
        `providers.items.${name}.maxConcurrentSessions`,
      ),
      initializeTimeoutMs: readOptionalNumber(
        raw.initializeTimeoutMs,
        `providers.items.${name}.initializeTimeoutMs`,
      ),
      sessionConfigOptions: readSessionConfigOptions(
        raw.sessionConfigOptions,
        `providers.items.${name}.sessionConfigOptions`,
      ),
    };
  }
  if (type !== "openai" && type !== "anthropic") {
    throw new Error(`runtime_config_provider_type_unsupported: ${name}`);
  }
  assertKnownKeys(raw, ["type", "apiKey", "baseURL", "userAgent", "maxConcurrentRequests"], `providers.items.${name}`);
  return {
    type,
    apiKey: resolveEnvironmentValue(
      readRequiredString(raw.apiKey, `providers.items.${name}.apiKey`),
      `providers.items.${name}.apiKey`,
    ),
    baseURL: readOptionalString(raw.baseURL, `providers.items.${name}.baseURL`),
    userAgent: readOptionalString(raw.userAgent, `providers.items.${name}.userAgent`),
    maxConcurrentRequests: readOptionalNumber(
      raw.maxConcurrentRequests,
      `providers.items.${name}.maxConcurrentRequests`,
    ),
  };
}

function normalizeProviders(raw: unknown): ProvidersConfig {
  if (!isRecord(raw)) throw new Error("runtime_config_invalid_providers");
  assertKnownKeys(raw, ["default", "items"], "providers");
  if (!isRecord(raw.items)) throw new Error("runtime_config_invalid_providers_items");
  const items = Object.fromEntries(
    Object.entries(raw.items).map(([name, provider]) => [
      readRequiredString(name, "providers.items.key"),
      normalizeProviderConfig(name, provider),
    ]),
  ) as Record<string, ProviderConfig>;
  if (Object.keys(items).length === 0) throw new Error("runtime_config_empty_providers_items");
  const defaultName = readRequiredString(raw.default, "providers.default");
  if (!items[defaultName]) throw new Error(`runtime_config_provider_default_not_found: ${defaultName}`);
  return { default: defaultName, items };
}

function normalizeAgentProfile(raw: Record<string, unknown>, name: string): LlmAgentEntryConfig {
  assertKnownKeys(raw, [
    "kind", "provider", "model", "temperature", "maxTokens", "forceJsonResponse",
    "reasoningEnabled", "reasoningEffort", "thinkingEnabled", "personalityPrompt",
  ], `agents.items.${name}`);
  const reasoningEffort = raw.reasoningEffort === undefined
    ? undefined
    : readRequiredString(raw.reasoningEffort, `agents.items.${name}.reasoningEffort`);
  if (reasoningEffort !== undefined && !["low", "medium", "high"].includes(reasoningEffort)) {
    throw new Error(`runtime_config_reasoning_effort_invalid: ${name}`);
  }
  return {
    kind: "llm",
    provider: readRequiredString(raw.provider, `agents.items.${name}.provider`),
    model: readRequiredString(raw.model, `agents.items.${name}.model`),
    temperature: readOptionalNumber(raw.temperature, `agents.items.${name}.temperature`),
    maxTokens: readOptionalNumber(raw.maxTokens, `agents.items.${name}.maxTokens`),
    forceJsonResponse: readOptionalBoolean(raw.forceJsonResponse, `agents.items.${name}.forceJsonResponse`),
    reasoningEnabled: readOptionalBoolean(raw.reasoningEnabled, `agents.items.${name}.reasoningEnabled`),
    reasoningEffort: reasoningEffort as LlmAgentEntryConfig["reasoningEffort"],
    thinkingEnabled: readOptionalBoolean(raw.thinkingEnabled, `agents.items.${name}.thinkingEnabled`),
    personalityPrompt: readOptionalString(raw.personalityPrompt, `agents.items.${name}.personalityPrompt`),
  };
}

function normalizeAcpAgent(raw: Record<string, unknown>, name: string): AcpAgentEntryConfig {
  assertKnownKeys(raw, ["kind", "provider", "spawnArgs", "sessionReuse", "actionTransport"], `agents.items.${name}`);
  const sessionReuse = raw.sessionReuse === undefined
    ? undefined
    : readRequiredString(raw.sessionReuse, `agents.items.${name}.sessionReuse`);
  if (sessionReuse !== undefined && sessionReuse !== "per_player") {
    throw new Error(`runtime_config_acp_session_reuse_invalid: ${name}`);
  }
  const actionTransport = raw.actionTransport === undefined
    ? undefined
    : readRequiredString(raw.actionTransport, `agents.items.${name}.actionTransport`);
  if (actionTransport !== undefined && actionTransport !== "mcp") {
    throw new Error(`runtime_config_acp_action_transport_invalid: ${name}`);
  }
  return {
    kind: "acp",
    provider: readRequiredString(raw.provider, `agents.items.${name}.provider`),
    spawnArgs: raw.spawnArgs === undefined ? undefined : readStringArray(raw.spawnArgs, `agents.items.${name}.spawnArgs`),
    sessionReuse: sessionReuse as AcpAgentEntryConfig["sessionReuse"],
    actionTransport: actionTransport as AcpAgentEntryConfig["actionTransport"],
  };
}

function normalizeAgents(raw: unknown, providers: ProvidersConfig): AgentsConfig {
  if (!isRecord(raw)) throw new Error("runtime_config_invalid_agents");
  assertKnownKeys(raw, ["default", "items"], "agents");
  if (!isRecord(raw.items)) throw new Error("runtime_config_invalid_agents_items");
  const items = Object.fromEntries(Object.entries(raw.items).map(([name, value]) => {
    if (!isRecord(value)) throw new Error(`runtime_config_agent_invalid: ${name}`);
    const kind = readRequiredString(value.kind, `agents.items.${name}.kind`);
    const agent = kind === "llm"
      ? normalizeAgentProfile(value, name)
      : kind === "acp"
        ? normalizeAcpAgent(value, name)
        : (() => { throw new Error(`runtime_config_agent_kind_unsupported: ${name}`); })();
    const provider = providers.items[agent.provider];
    if (!provider) {
      throw new Error(`runtime_config_agent_provider_not_found: agent=${name} provider=${agent.provider}`);
    }
    if (agent.kind === "acp" && provider.type !== "acp") {
      throw new Error(`runtime_config_acp_agent_requires_acp_provider: ${name}`);
    }
    if (agent.kind === "llm" && provider.type === "acp") {
      throw new Error(`runtime_config_llm_agent_requires_llm_provider: ${name}`);
    }
    return [readRequiredString(name, "agents.items.key"), agent];
  })) as Record<string, AgentEntryConfig>;
  if (Object.keys(items).length === 0) throw new Error("runtime_config_empty_agents_items");
  const defaultName = readRequiredString(raw.default, "agents.default");
  if (!items[defaultName]) throw new Error(`runtime_config_agent_default_not_found: ${defaultName}`);
  return { default: defaultName, items };
}

function normalizeGameAgentSelection(
  value: unknown,
  field: string,
  agents: AgentsConfig,
): GameAgentSelection {
  if (typeof value === "string") {
    const agent = readRequiredString(value, field);
    if (!agents.items[agent]) throw new Error(`runtime_config_agent_not_found: ${agent}`);
    return agent;
  }
  if (!isRecord(value)) throw new Error(`runtime_config_agent_selection_invalid: ${field}`);
  assertKnownKeys(value, ["agent", "spawnArgs"], field);
  const agent = readRequiredString(value.agent, `${field}.agent`);
  const profile = agents.items[agent];
  if (!profile) throw new Error(`runtime_config_agent_not_found: ${agent}`);
  const spawnArgs = value.spawnArgs === undefined ? undefined : readStringArray(value.spawnArgs, `${field}.spawnArgs`);
  if (spawnArgs && profile.kind !== "acp") {
    throw new Error(`runtime_config_spawn_args_require_acp_agent: ${field}`);
  }
  return { agent, ...(spawnArgs ? { spawnArgs } : {}) };
}

function normalizeGameAgentSelections(
  value: unknown,
  field: string,
  agents: AgentsConfig,
): Record<string, GameAgentSelection> | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new Error(`runtime_config_agent_selections_invalid: ${field}`);
  return Object.fromEntries(
    Object.entries(value).map(([key, selection]) => [
      readRequiredString(key, `${field}.key`),
      normalizeGameAgentSelection(selection, `${field}.${key}`, agents),
    ]),
  );
}

function normalizeGameConfig(raw: unknown, agents: AgentsConfig): GameConfig {
  if (!isRecord(raw)) throw new Error("runtime_config_invalid_game");
  assertKnownKeys(raw, [
    "board", "maxDays", "maxRuntimeMs", "llmTimeoutMs", "trace", "printAllEvents",
    "printChat", "streamEvents", "color", "printLlmIo", "printThinking",
    "printPrivateEvents", "recordRootDir", "agent", "roleAgents", "playerAgents",
  ], "game");
  const board = raw.board === undefined ? undefined : readRequiredString(raw.board, "game.board");
  if (board !== undefined && board !== "six_player_mvp" && board !== "twelve_player_standard") {
    throw new Error(`runtime_config_board_invalid: ${board}`);
  }
  const agent = raw.agent === undefined
    ? undefined
    : normalizeGameAgentSelection(raw.agent, "game.agent", agents);
  if (agent !== undefined && typeof agent !== "string") {
    throw new Error("runtime_config_game_agent_must_be_name");
  }
  return {
    board: board as GameBoard | undefined,
    maxDays: readOptionalNumber(raw.maxDays, "game.maxDays"),
    maxRuntimeMs: readOptionalNumber(raw.maxRuntimeMs, "game.maxRuntimeMs"),
    llmTimeoutMs: readOptionalNumber(raw.llmTimeoutMs, "game.llmTimeoutMs"),
    trace: readOptionalBoolean(raw.trace, "game.trace"),
    printAllEvents: readOptionalBoolean(raw.printAllEvents, "game.printAllEvents"),
    printChat: readOptionalBoolean(raw.printChat, "game.printChat"),
    streamEvents: readOptionalBoolean(raw.streamEvents, "game.streamEvents"),
    color: readOptionalBoolean(raw.color, "game.color"),
    printLlmIo: readOptionalBoolean(raw.printLlmIo, "game.printLlmIo"),
    printThinking: readOptionalBoolean(raw.printThinking, "game.printThinking"),
    printPrivateEvents: readOptionalBoolean(raw.printPrivateEvents, "game.printPrivateEvents"),
    recordRootDir: readOptionalString(raw.recordRootDir, "game.recordRootDir"),
    agent,
    roleAgents: normalizeGameAgentSelections(raw.roleAgents, "game.roleAgents", agents),
    playerAgents: normalizeGameAgentSelections(raw.playerAgents, "game.playerAgents", agents),
  };
}

function normalizeDebugSummaryConfig(raw: unknown, agents: AgentsConfig): DebugSummaryConfig {
  if (!isRecord(raw)) throw new Error("runtime_config_invalid_debug_summary");
  assertKnownKeys(raw, ["agent"], "debugSummary");
  if (raw.agent === undefined) return {};
  if (!isRecord(raw.agent)) throw new Error("runtime_config_invalid_debug_summary_agent");
  assertKnownKeys(raw.agent, [
    "enabled", "agentName", "timeoutMs", "maxAttempts", "concurrency", "publicMaxItems",
    "maxItems", "playerMaxItems",
  ], "debugSummary.agent");
  const agentName = readOptionalString(raw.agent.agentName, "debugSummary.agent.agentName");
  if (agentName && !agents.items[agentName]) {
    throw new Error(`runtime_config_agent_not_found: ${agentName}`);
  }
  return {
    agent: {
      enabled: readOptionalBoolean(raw.agent.enabled, "debugSummary.agent.enabled"),
      agentName,
      timeoutMs: readOptionalNumber(raw.agent.timeoutMs, "debugSummary.agent.timeoutMs"),
      maxAttempts: readOptionalNumber(raw.agent.maxAttempts, "debugSummary.agent.maxAttempts"),
      concurrency: readOptionalNumber(raw.agent.concurrency, "debugSummary.agent.concurrency"),
      publicMaxItems: readOptionalNumber(raw.agent.publicMaxItems, "debugSummary.agent.publicMaxItems"),
      maxItems: readOptionalNumber(raw.agent.maxItems, "debugSummary.agent.maxItems"),
      playerMaxItems: readOptionalNumber(raw.agent.playerMaxItems, "debugSummary.agent.playerMaxItems"),
    },
  };
}

function resolveConfigRoot(): string {
  const envConfig = process.env.GAME_CONFIGS_DIR?.trim();
  if (!envConfig) throw new Error("runtime_config_missing_configs_dir: set GAME_CONFIGS_DIR");
  return path.isAbsolute(envConfig) ? envConfig : path.resolve(resolveRepoRoot(), envConfig);
}

function resolveGameConfigName(): string {
  const name = process.env.GAME_CONFIG_NAME?.trim() || "default";
  if (!/^[a-z][a-z0-9_-]*$/.test(name)) {
    throw new Error(`runtime_config_game_name_invalid: ${name}`);
  }
  return name;
}

async function readJsonFile(filePath: string, label: string): Promise<unknown> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf-8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") throw new Error(`runtime_config_file_missing: ${label} -> ${filePath}`);
    throw error;
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`runtime_config_json_invalid: ${label} -> ${(error as Error).message}`);
  }
}

async function readOptionalJsonFile(filePath: string, label: string): Promise<unknown | undefined> {
  try {
    return await readJsonFile(filePath, label);
  } catch (error) {
    if ((error as Error).message.startsWith("runtime_config_file_missing:")) return undefined;
    throw error;
  }
}

export function resolveAgentProfileByName(
  runtime: RuntimeConfig,
  agentName?: string,
): ResolvedAgentRuntimeProfile {
  const selected = agentName ?? runtime.agents.default;
  const entry = runtime.agents.items[selected];
  if (!entry) throw new Error(`runtime_config_agent_not_found: ${selected}`);
  const provider = runtime.providers.items[entry.provider];
  if (!provider) {
    throw new Error(`runtime_config_agent_provider_not_found: agent=${selected} provider=${entry.provider}`);
  }
  if (entry.kind === "acp") {
    return {
      name: selected,
      providerName: entry.provider,
      provider,
      kind: "acp",
      spawnArgs: entry.spawnArgs,
      sessionReuse: entry.sessionReuse,
      actionTransport: entry.actionTransport ?? "mcp",
    };
  }
  return {
    name: selected,
    providerName: entry.provider,
    provider,
    kind: "llm",
    model: entry.model,
    temperature: entry.temperature,
    maxTokens: entry.maxTokens,
    forceJsonResponse: entry.forceJsonResponse,
    reasoningEnabled: entry.reasoningEnabled,
    reasoningEffort: entry.reasoningEffort,
    thinkingEnabled: entry.thinkingEnabled,
    personalityPrompt: entry.personalityPrompt,
  };
}

export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  if (overrideConfig) return overrideConfig;
  if (cachedConfig) return cachedConfig;

  const configRoot = resolveConfigRoot();
  const runtimeDir = path.join(configRoot, "runtime");
  const providers = normalizeProviders(
    await readJsonFile(path.join(runtimeDir, "providers.json"), "providers"),
  );
  const agents = normalizeAgents(
    await readJsonFile(path.join(runtimeDir, "agents.json"), "agents"),
    providers,
  );
  const gameName = resolveGameConfigName();
  const game = normalizeGameConfig(
    await readJsonFile(path.join(configRoot, "games", `${gameName}.json`), `games.${gameName}`),
    agents,
  );
  const debugSummaryRaw = await readOptionalJsonFile(
    path.join(runtimeDir, "debug_summary.json"),
    "debugSummary",
  );
  cachedConfig = {
    providers,
    agents,
    game,
    ...(debugSummaryRaw === undefined
      ? {}
      : { debugSummary: normalizeDebugSummaryConfig(debugSummaryRaw, agents) }),
  };
  return cachedConfig;
}

export function setRuntimeConfigOverride(config: RuntimeConfig | null): void {
  overrideConfig = config;
}

export function clearRuntimeConfigCache(): void {
  cachedConfig = null;
}
