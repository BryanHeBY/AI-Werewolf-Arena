import type {
  AcpAgentEntryConfig, AgentEntryConfig, AgentsConfig, DebugSummaryConfig,
  GameAgentSelection, GameConfig, GameBoard, LlmAgentEntryConfig, ProviderConfig,
  ProvidersConfig, ReasoningEffort, RuntimeConfig, PlayerConfig, LocalizedPrompt,
} from "./contracts";
import { isLocale, type Locale } from "@ai-werewolf-arena/game-catalog";

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

function readPromptText(value: unknown, field: string): string {
  readRequiredString(value, field);
  return value as string;
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

function readOptionalPositiveInteger(value: unknown, field: string): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`runtime_config_positive_integer_invalid: ${field}`);
  }
  return value;
}

function readOptionalMinimumInteger(value: unknown, field: string, minimum: number): number | undefined {
  const parsed = readOptionalPositiveInteger(value, field);
  if (parsed !== undefined && parsed < minimum) {
    throw new Error(`runtime_config_minimum_integer_invalid: ${field} >= ${minimum}`);
  }
  return parsed;
}

function readStringArray(value: unknown, field: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error(`runtime_config_string_array_invalid: ${field}`);
  }
  return value.map((item) => item.trim());
}

function resolveEnvironmentValue(value: string, field: string, environment: NodeJS.ProcessEnv): string {
  const match = /^\$\{([A-Z][A-Z0-9_]*)\}$/.exec(value.trim());
  if (!match) return value;
  const resolved = environment[match[1]]?.trim();
  if (!resolved) {
    throw new Error(`runtime_config_missing_environment_value: ${field} -> ${match[1]}`);
  }
  return resolved;
}

function readEnvironment(value: unknown, field: string, environment: NodeJS.ProcessEnv): Record<string, string> {
  if (value === undefined) return {};
  if (!isRecord(value)) {
    throw new Error(`runtime_config_environment_invalid: ${field}`);
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, raw]) => [
      readRequiredString(key, `${field}.key`),
      resolveEnvironmentValue(readRequiredString(raw, `${field}.${key}`), `${field}.${key}`, environment),
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

function normalizeProviderConfig(name: string, raw: unknown, environment: NodeJS.ProcessEnv): ProviderConfig {
  if (!isRecord(raw)) {
    throw new Error(`runtime_config_provider_invalid: ${name}`);
  }
  const type = readRequiredString(raw.type, `providers.items.${name}.type`);
  if (type === "acp") {
    assertKnownKeys(raw, [
      "type", "transport", "command", "args", "env", "cwd",
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
      env: readEnvironment(raw.env, `providers.items.${name}.env`, environment),
      cwd: readOptionalString(raw.cwd, `providers.items.${name}.cwd`),
      initializeTimeoutMs: readOptionalPositiveInteger(
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
      environment,
    ),
    baseURL: readOptionalString(raw.baseURL, `providers.items.${name}.baseURL`),
    userAgent: readOptionalString(raw.userAgent, `providers.items.${name}.userAgent`),
    maxConcurrentRequests: readOptionalPositiveInteger(
      raw.maxConcurrentRequests,
      `providers.items.${name}.maxConcurrentRequests`,
    ),
  };
}

function normalizeProviders(raw: unknown, environment: NodeJS.ProcessEnv): ProvidersConfig {
  if (!isRecord(raw)) throw new Error("runtime_config_invalid_providers");
  assertKnownKeys(raw, ["default", "items"], "providers");
  if (!isRecord(raw.items)) throw new Error("runtime_config_invalid_providers_items");
  const items = Object.fromEntries(
    Object.entries(raw.items).map(([name, provider]) => [
      readRequiredString(name, "providers.items.key"),
      normalizeProviderConfig(name, provider, environment),
    ]),
  ) as Record<string, ProviderConfig>;
  if (Object.keys(items).length === 0) throw new Error("runtime_config_empty_providers_items");
  const defaultName = readRequiredString(raw.default, "providers.default");
  if (!items[defaultName]) throw new Error(`runtime_config_provider_default_not_found: ${defaultName}`);
  return { default: defaultName, items };
}

function normalizeAgentProfile(raw: Record<string, unknown>, name: string): LlmAgentEntryConfig {
  assertKnownKeys(raw, [
    "kind", "provider", "model", "temperature", "maxTokens",
    "reasoningEffort", "thinkingEnabled", "personalityPrompt",
  ], `agents.items.${name}`);
  const reasoningEffort = raw.reasoningEffort === undefined
    ? undefined
    : readRequiredString(raw.reasoningEffort, `agents.items.${name}.reasoningEffort`);
  if (reasoningEffort !== undefined && !["none", "minimal", "low", "medium", "high", "xhigh"].includes(reasoningEffort)) {
    throw new Error(`runtime_config_reasoning_effort_invalid: ${name}`);
  }
  return {
    kind: "llm",
    provider: readRequiredString(raw.provider, `agents.items.${name}.provider`),
    model: readRequiredString(raw.model, `agents.items.${name}.model`),
    temperature: readOptionalNumber(raw.temperature, `agents.items.${name}.temperature`),
    maxTokens: readOptionalPositiveInteger(raw.maxTokens, `agents.items.${name}.maxTokens`),
    reasoningEffort: reasoningEffort as ReasoningEffort | undefined,
    thinkingEnabled: readOptionalBoolean(raw.thinkingEnabled, `agents.items.${name}.thinkingEnabled`),
    personalityPrompt: readOptionalString(raw.personalityPrompt, `agents.items.${name}.personalityPrompt`),
  };
}

function normalizeAcpAgent(raw: Record<string, unknown>, name: string): AcpAgentEntryConfig {
  assertKnownKeys(raw, ["kind", "provider", "spawnArgs", "sessionReuse", "actionTransport", "personalityPrompt"], `agents.items.${name}`);
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
    personalityPrompt: readOptionalString(raw.personalityPrompt, `agents.items.${name}.personalityPrompt`),
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
    if (agent.kind === "llm" && provider.type === "anthropic" && agent.thinkingEnabled && agent.temperature !== undefined) {
      throw new Error(`runtime_config_anthropic_thinking_temperature_unsupported: ${name}`);
    }
    if (agent.kind === "llm" && provider.type === "anthropic" && agent.reasoningEffort
      && !["low", "medium", "high"].includes(agent.reasoningEffort)) {
      throw new Error(`runtime_config_anthropic_reasoning_effort_invalid: ${name}`);
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
  assertKnownKeys(value, ["agent", "spawnArgs", "personalityPrompt"], field);
  const agent = readRequiredString(value.agent, `${field}.agent`);
  const profile = agents.items[agent];
  if (!profile) throw new Error(`runtime_config_agent_not_found: ${agent}`);
  const spawnArgs = value.spawnArgs === undefined ? undefined : readStringArray(value.spawnArgs, `${field}.spawnArgs`);
  if (spawnArgs && profile.kind !== "acp") {
    throw new Error(`runtime_config_spawn_args_require_acp_agent: ${field}`);
  }
  const personalityPrompt = readOptionalString(value.personalityPrompt, `${field}.personalityPrompt`);
  return {
    agent,
    ...(spawnArgs ? { spawnArgs } : {}),
    ...(personalityPrompt !== undefined ? { personalityPrompt } : {}),
  };
}

function normalizeGameAgentSelections(
  value: unknown,
  field: string,
  agents: AgentsConfig,
): Record<string, GameAgentSelection> | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new Error(`runtime_config_agent_selections_invalid: ${field}`);
  return Object.fromEntries(Object.entries(value).map(([key, selection]) => {
    if (key !== key.trim()) throw new Error(`runtime_config_selection_key_invalid: ${field}`);
    return [readRequiredString(key, `${field}.key`), normalizeGameAgentSelection(selection, `${field}.${key}`, agents)];
  }));
}

function normalizeGameConfig(raw: unknown, agents: AgentsConfig): GameConfig {
  if (!isRecord(raw)) throw new Error("runtime_config_invalid_game");
  assertKnownKeys(raw, [
    "board", "maxDays", "maxRuntimeMs", "llmTimeoutMs", "trace", "printAllEvents",
    "printChat", "streamEvents", "color", "printLlmIo", "printThinking",
    "printPrivateEvents", "recordRootDir", "agent", "roleAgents", "playerAgents", "players", "locale", "displayLocale", "seed",
  ], "game");
  const board = raw.board === undefined ? undefined : readRequiredString(raw.board, "game.board");
  if (board !== undefined && !/^[a-z][a-z0-9_-]*$/.test(board)) {
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
    maxDays: readOptionalPositiveInteger(raw.maxDays, "game.maxDays"),
    maxRuntimeMs: readOptionalPositiveInteger(raw.maxRuntimeMs, "game.maxRuntimeMs"),
    llmTimeoutMs: readOptionalPositiveInteger(raw.llmTimeoutMs, "game.llmTimeoutMs"),
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
    players: normalizePlayers(raw.players, agents),
    locale: readLocale(raw.locale, "game.locale"),
    displayLocale: readLocale(raw.displayLocale, "game.displayLocale"),
    seed: readOptionalString(raw.seed, "game.seed"),
  };
}

function readLocale(value: unknown, field: string): Locale | undefined {
  if (value === undefined) return undefined;
  if (!isLocale(value)) throw new Error(`runtime_config_locale_invalid: ${field}`);
  return value;
}

function normalizePlayers(value: unknown, agents: AgentsConfig): Record<string, PlayerConfig> | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new Error("runtime_config_players_invalid");
  return Object.fromEntries(Object.entries(value).map(([seat, entry]) => {
    const field = `game.players.${seat}`;
    if (!isRecord(entry)) throw new Error(`runtime_config_player_invalid: ${field}`);
    assertKnownKeys(entry, ["name", "agent", "spawnArgs", "personalityPrompt"], field);
    let name: string | undefined;
    if (entry.name !== undefined) {
      if (typeof entry.name !== "string" || !entry.name.trim() || entry.name.length > 120) throw new Error(`runtime_config_player_name_invalid: ${field}.name`);
      name = entry.name; // Preserve user spelling; never translate or silently trim names.
    }
    const agent = readOptionalString(entry.agent, `${field}.agent`);
    if (agent && !agents.items[agent]) throw new Error(`runtime_config_agent_not_found: ${agent}`);
    const spawnArgs = entry.spawnArgs === undefined ? undefined : readStringArray(entry.spawnArgs, `${field}.spawnArgs`);
    if (spawnArgs && (!agent || agents.items[agent].kind !== "acp")) throw new Error(`runtime_config_spawn_args_require_explicit_acp_agent: ${field}`);
    let personalityPrompt: LocalizedPrompt | null | undefined;
    if (entry.personalityPrompt === null) personalityPrompt = null;
    else if (entry.personalityPrompt !== undefined) {
      if (typeof entry.personalityPrompt === "string") personalityPrompt = readPromptText(entry.personalityPrompt, `${field}.personalityPrompt`);
      else {
        if (!isRecord(entry.personalityPrompt)) throw new Error(`runtime_config_prompt_invalid: ${field}`);
        assertKnownKeys(entry.personalityPrompt, ["zh-CN", "en"], `${field}.personalityPrompt`);
        if (!Object.keys(entry.personalityPrompt).length) throw new Error(`runtime_config_prompt_empty: ${field}`);
        personalityPrompt = Object.fromEntries(Object.entries(entry.personalityPrompt).map(([locale, text]) => [locale, readPromptText(text, `${field}.personalityPrompt.${locale}`)]));
      }
    }
    return [seat, { ...(name !== undefined ? { name } : {}), ...(agent ? { agent } : {}),
      ...(spawnArgs ? { spawnArgs } : {}), ...(personalityPrompt !== undefined ? { personalityPrompt } : {}) }];
  }));
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
      timeoutMs: readOptionalPositiveInteger(raw.agent.timeoutMs, "debugSummary.agent.timeoutMs"),
      maxAttempts: readOptionalPositiveInteger(raw.agent.maxAttempts, "debugSummary.agent.maxAttempts"),
      concurrency: readOptionalPositiveInteger(raw.agent.concurrency, "debugSummary.agent.concurrency"),
      publicMaxItems: readOptionalMinimumInteger(raw.agent.publicMaxItems, "debugSummary.agent.publicMaxItems", 60),
      maxItems: readOptionalMinimumInteger(raw.agent.maxItems, "debugSummary.agent.maxItems", 50),
      playerMaxItems: readOptionalMinimumInteger(raw.agent.playerMaxItems, "debugSummary.agent.playerMaxItems", 60),
    },
  };
}


export function parseRuntimeConfig(input: {
  providers: unknown;
  agents: unknown;
  game: unknown;
  debugSummary?: unknown;
  environment?: NodeJS.ProcessEnv;
}): RuntimeConfig {
  const environment = input.environment ?? process.env;
  const providers = normalizeProviders(input.providers, environment);
  const agents = normalizeAgents(input.agents, providers);
  const game = normalizeGameConfig(input.game, agents);
  return {
    providers,
    agents,
    game,
    ...(input.debugSummary === undefined
      ? {}
      : { debugSummary: normalizeDebugSummaryConfig(input.debugSummary, agents) }),
  };
}
