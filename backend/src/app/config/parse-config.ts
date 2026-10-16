/**
 * 负责 V2 backends／agents 配置的字段校验、默认归一和环境值解析。输入为原配置及环境表，输出内部连接表／Agent／game／audit 配置或字段错误。
 * 本模块不读配置文件、不启动 Agent 或缓存结果；环境表可显式传入，省略时在解析调用中读取 process.env，执行资源由运行装配持有。
 */
import type {
  AcpAgentEntryConfig,
  PiSettings,
  AgentEntryConfig,
  AgentsConfig,
  DebugSummaryConfig,
  GameAgentSelection,
  GameConfig,
  GameBoard,
  LlmAgentEntryConfig,
  ProviderConfig,
  ProvidersConfig,
  ReasoningEffort,
  RuntimeConfig,
  PlayerConfig,
  LocalizedPrompt,
} from "./contracts";
import { isLocale, type Locale } from "@ai-werewolf-arena/game-contract";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 只接受当前配置字段，拼写错误在装配前报出；这里的对象校验不承担惰性访问器或 Proxy 的隔离。 */
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

/** 玩家专属人格检查非空后返回原字符串；其它配置字符串仍按各自读取函数裁掉首尾空白。 */
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

function readOptionalMinimumInteger(
  value: unknown,
  field: string,
  minimum: number,
): number | undefined {
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

function resolveEnvironmentValue(
  value: string,
  field: string,
  environment: NodeJS.ProcessEnv,
): string {
  // 只解析整个值为 ${NAME} 的占位符；不插值字符串片段，缺失变量的错误只包含字段路径，不暴露变量名或值。
  const match = /^\$\{([A-Z][A-Z0-9_]*)\}$/.exec(value.trim());
  if (!match) return value;
  const resolved = environment[match[1]]?.trim();
  if (!resolved) {
    throw new Error(`runtime_config_missing_environment_value: ${field}`);
  }
  return resolved;
}

function readEnvironment(
  value: unknown,
  field: string,
  environment: NodeJS.ProcessEnv,
): Record<string, string> {
  if (value === undefined) return {};
  if (!isRecord(value)) {
    throw new Error(`runtime_config_environment_invalid: ${field}`);
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, raw]) => [
      readRequiredString(key, `${field}.key`),
      resolveEnvironmentValue(
        readRequiredString(raw, `${field}.${key}`),
        `${field}.${key}`,
        environment,
      ),
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

/** Pi 原生文档原样保留 JSON 结构，只递归解析完整环境占位；原生语义由 Pi adapter 校验。 */
function readNativeObject(
  value: unknown,
  field: string,
  environment: NodeJS.ProcessEnv,
): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`runtime_config_native_object_invalid: ${field}`);
  function copy(raw: unknown, location: string): unknown {
    if (typeof raw === "string") return resolveEnvironmentValue(raw, location, environment);
    if (
      raw === null ||
      typeof raw === "boolean" ||
      (typeof raw === "number" && Number.isFinite(raw))
    )
      return raw;
    if (Array.isArray(raw)) return raw.map((item, index) => copy(item, `${location}.${index}`));
    if (isRecord(raw))
      return Object.fromEntries(
        Object.entries(raw).map(([key, item]) => [key, copy(item, `${location}.${key}`)]),
      );
    throw new Error(`runtime_config_native_json_invalid: ${location}`);
  }
  return copy(value, field) as Record<string, unknown>;
}

function normalizeBackend(
  name: string,
  raw: unknown,
  environment: NodeJS.ProcessEnv,
): ProviderConfig {
  const field = `backends.items.${name}`;
  if (!isRecord(raw)) throw new Error(`runtime_config_backend_invalid: ${field}`);
  assertKnownKeys(raw, ["kind", "config", "limits"], field);
  const kind = readRequiredString(raw.kind, `${field}.kind`);
  if (!isRecord(raw.config))
    throw new Error(`runtime_config_backend_config_invalid: ${field}.config`);
  if (raw.limits !== undefined && !isRecord(raw.limits))
    throw new Error(`runtime_config_backend_limits_invalid: ${field}.limits`);
  if (isRecord(raw.limits))
    assertKnownKeys(raw.limits, ["maxConcurrentRequests"], `${field}.limits`);
  const maxConcurrentRequests = readOptionalPositiveInteger(
    isRecord(raw.limits) ? raw.limits.maxConcurrentRequests : undefined,
    `${field}.limits.maxConcurrentRequests`,
  );
  const config = raw.config,
    configField = `${field}.config`;
  if (kind === "pi") {
    assertKnownKeys(config, ["models", "auth"], configField);
    return {
      type: "pi",
      models: readNativeObject(config.models, `${configField}.models`, environment),
      auth: readNativeObject(config.auth, `${configField}.auth`, environment),
      maxConcurrentRequests,
    };
  }
  if (kind === "acp") {
    assertKnownKeys(
      config,
      ["transport", "command", "args", "env", "cwd", "initializeTimeoutMs"],
      configField,
    );
    const transport =
      config.transport === undefined
        ? "stdio"
        : readRequiredString(config.transport, `${configField}.transport`);
    if (transport !== "stdio")
      throw new Error(`runtime_config_acp_transport_unsupported: ${configField}.transport`);
    return {
      type: "acp",
      transport,
      command: readRequiredString(config.command, `${configField}.command`),
      args: readStringArray(config.args, `${configField}.args`),
      env: readEnvironment(config.env, `${configField}.env`, environment),
      cwd: readOptionalString(config.cwd, `${configField}.cwd`),
      initializeTimeoutMs: readOptionalPositiveInteger(
        config.initializeTimeoutMs,
        `${configField}.initializeTimeoutMs`,
      ),
      maxConcurrentRequests,
      sessionConfigOptions: {},
    };
  }
  if (kind !== "llm") throw new Error(`runtime_config_backend_kind_unsupported: ${field}.kind`);
  assertKnownKeys(config, ["type", "apiKey", "baseURL", "userAgent"], configField);
  const type = readRequiredString(config.type, `${configField}.type`);
  if (type !== "openai" && type !== "anthropic")
    throw new Error(`runtime_config_provider_type_unsupported: ${configField}.type`);
  return {
    type,
    apiKey: resolveEnvironmentValue(
      readRequiredString(config.apiKey, `${configField}.apiKey`),
      `${configField}.apiKey`,
      environment,
    ),
    baseURL:
      config.baseURL === undefined
        ? undefined
        : resolveEnvironmentValue(
            readRequiredString(config.baseURL, `${configField}.baseURL`),
            `${configField}.baseURL`,
            environment,
          ),
    userAgent: readOptionalString(config.userAgent, `${configField}.userAgent`),
    maxConcurrentRequests,
  };
}

function normalizeBackends(raw: unknown, environment: NodeJS.ProcessEnv): ProvidersConfig {
  if (!isRecord(raw)) throw new Error("runtime_config_invalid_backends");
  assertKnownKeys(raw, ["schemaVersion", "items"], "backends");
  if (raw.schemaVersion !== 2)
    throw new Error("runtime_config_schema_version_invalid: backends.schemaVersion");
  if (!isRecord(raw.items)) throw new Error("runtime_config_invalid_backends_items");
  const items = Object.fromEntries(
    Object.entries(raw.items).map(([name, value]) => [
      readRequiredString(name, "backends.items.key"),
      normalizeBackend(name, value, environment),
    ]),
  );
  const names = Object.keys(items);
  if (!names.length) throw new Error("runtime_config_empty_backends_items");
  // 公共 V2 没有 backend 默认值；内部旧字段仅用于装配完整性检查，Agent 一律显式引用。
  return { default: names[0], items };
}

function normalizeAgentOptions(
  options: Record<string, unknown>,
  name: string,
  backend: string,
): LlmAgentEntryConfig {
  const field = `agents.items.${name}.options`;
  assertKnownKeys(
    options,
    ["model", "temperature", "maxTokens", "reasoningEffort", "thinkingEnabled"],
    field,
  );
  const reasoningEffort = readOptionalString(options.reasoningEffort, `${field}.reasoningEffort`);
  if (
    reasoningEffort !== undefined &&
    !["none", "minimal", "low", "medium", "high", "xhigh"].includes(reasoningEffort)
  )
    throw new Error(`runtime_config_reasoning_effort_invalid: ${field}.reasoningEffort`);
  return {
    kind: "llm",
    provider: backend,
    model: readRequiredString(options.model, `${field}.model`),
    temperature: readOptionalNumber(options.temperature, `${field}.temperature`),
    maxTokens: readOptionalPositiveInteger(options.maxTokens, `${field}.maxTokens`),
    reasoningEffort: reasoningEffort as ReasoningEffort | undefined,
    thinkingEnabled: readOptionalBoolean(options.thinkingEnabled, `${field}.thinkingEnabled`),
  };
}

function normalizeAcpOptions(
  options: Record<string, unknown>,
  name: string,
  backend: string,
): AcpAgentEntryConfig {
  const field = `agents.items.${name}.options`;
  assertKnownKeys(
    options,
    ["spawnArgs", "sessionReuse", "actionTransport", "sessionConfigOptions"],
    field,
  );
  const sessionReuse = readOptionalString(options.sessionReuse, `${field}.sessionReuse`);
  if (sessionReuse !== undefined && sessionReuse !== "per_player")
    throw new Error(`runtime_config_acp_session_reuse_invalid: ${field}.sessionReuse`);
  const actionTransport = readOptionalString(options.actionTransport, `${field}.actionTransport`);
  if (actionTransport !== undefined && actionTransport !== "mcp")
    throw new Error(`runtime_config_acp_action_transport_invalid: ${field}.actionTransport`);
  return {
    kind: "acp",
    provider: backend,
    spawnArgs:
      options.spawnArgs === undefined
        ? undefined
        : readStringArray(options.spawnArgs, `${field}.spawnArgs`),
    sessionReuse: sessionReuse as AcpAgentEntryConfig["sessionReuse"],
    actionTransport: actionTransport as AcpAgentEntryConfig["actionTransport"],
    sessionConfigOptions: readSessionConfigOptions(
      options.sessionConfigOptions,
      `${field}.sessionConfigOptions`,
    ),
  };
}

function normalizeAgents(
  raw: unknown,
  providers: ProvidersConfig,
  environment: NodeJS.ProcessEnv,
): AgentsConfig {
  if (!isRecord(raw)) throw new Error("runtime_config_invalid_agents");
  assertKnownKeys(raw, ["schemaVersion", "default", "items"], "agents");
  if (raw.schemaVersion !== 2)
    throw new Error("runtime_config_schema_version_invalid: agents.schemaVersion");
  if (!isRecord(raw.items)) throw new Error("runtime_config_invalid_agents_items");
  const items = Object.fromEntries(
    Object.entries(raw.items).map(([name, value]) => {
      const field = `agents.items.${name}`;
      readRequiredString(name, "agents.items.key");
      if (!isRecord(value)) throw new Error(`runtime_config_agent_invalid: ${field}`);
      assertKnownKeys(value, ["backend", "options", "personalityPrompt"], field);
      const backend = readRequiredString(value.backend, `${field}.backend`);
      if (!Object.hasOwn(providers.items, backend))
        throw new Error(`runtime_config_agent_backend_not_found: ${field}.backend`);
      const provider = providers.items[backend];
      const options = value.options === undefined ? {} : value.options;
      if (!isRecord(options))
        throw new Error(`runtime_config_agent_options_invalid: ${field}.options`);
      const agent: AgentEntryConfig =
        provider.type === "pi"
          ? {
              kind: "pi",
              provider: backend,
              piSettings: readNativeObject(options, `${field}.options`, environment) as PiSettings,
            }
          : provider.type === "acp"
            ? normalizeAcpOptions(options, name, backend)
            : normalizeAgentOptions(options, name, backend);
      agent.personalityPrompt = readOptionalString(
        value.personalityPrompt,
        `${field}.personalityPrompt`,
      );
      if (agent.kind === "llm" && provider.type === "anthropic") {
        if (agent.thinkingEnabled && agent.temperature !== undefined)
          throw new Error(`runtime_config_anthropic_thinking_temperature_unsupported: ${name}`);
        if (agent.reasoningEffort && !["low", "medium", "high"].includes(agent.reasoningEffort))
          throw new Error(`runtime_config_anthropic_reasoning_effort_invalid: ${name}`);
      }
      return [name, agent];
    }),
  );
  if (!Object.keys(items).length) throw new Error("runtime_config_empty_agents_items");
  const defaultName = readRequiredString(raw.default, "agents.default");
  if (!Object.hasOwn(items, defaultName))
    throw new Error(`runtime_config_agent_default_not_found: ${defaultName}`);
  return { default: defaultName, items };
}

function normalizeGameAgentSelection(
  value: unknown,
  field: string,
  agents: AgentsConfig,
): GameAgentSelection {
  if (typeof value === "string") {
    const agent = readRequiredString(value, field);
    if (!Object.hasOwn(agents.items, agent))
      throw new Error(`runtime_config_agent_not_found: ${agent}`);
    return agent;
  }
  if (!isRecord(value)) throw new Error(`runtime_config_agent_selection_invalid: ${field}`);
  assertKnownKeys(value, ["agent", "spawnArgs", "personalityPrompt"], field);
  const agent = readRequiredString(value.agent, `${field}.agent`);
  const profile = Object.hasOwn(agents.items, agent) ? agents.items[agent] : undefined;
  if (!profile) throw new Error(`runtime_config_agent_not_found: ${agent}`);
  const spawnArgs =
    value.spawnArgs === undefined
      ? undefined
      : readStringArray(value.spawnArgs, `${field}.spawnArgs`);
  if (spawnArgs && profile.kind !== "acp") {
    throw new Error(`runtime_config_spawn_args_require_acp_agent: ${field}`);
  }
  const personalityPrompt = readOptionalString(
    value.personalityPrompt,
    `${field}.personalityPrompt`,
  );
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
  return Object.fromEntries(
    Object.entries(value).map(([key, selection]) => {
      if (key !== key.trim()) throw new Error(`runtime_config_selection_key_invalid: ${field}`);
      return [
        readRequiredString(key, `${field}.key`),
        normalizeGameAgentSelection(selection, `${field}.${key}`, agents),
      ];
    }),
  );
}

function normalizeGameConfig(raw: unknown, agents: AgentsConfig): GameConfig {
  if (!isRecord(raw)) throw new Error("runtime_config_invalid_game");
  assertKnownKeys(
    raw,
    [
      "board",
      "maxDays",
      "maxRuntimeMs",
      "llmTimeoutMs",
      "trace",
      "printAllEvents",
      "printChat",
      "streamEvents",
      "color",
      "printLlmIo",
      "printThinking",
      "printPrivateEvents",
      "recordRootDir",
      "agent",
      "roleAgents",
      "playerAgents",
      "players",
      "locale",
      "displayLocale",
      "seed",
    ],
    "game",
  );
  const board = raw.board === undefined ? undefined : readRequiredString(raw.board, "game.board");
  if (board !== undefined && !/^[a-z][a-z0-9_-]*$/.test(board)) {
    throw new Error(`runtime_config_board_invalid: ${board}`);
  }
  const agent =
    raw.agent === undefined
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

function normalizePlayers(
  value: unknown,
  agents: AgentsConfig,
): Record<string, PlayerConfig> | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new Error("runtime_config_players_invalid");
  return Object.fromEntries(
    Object.entries(value).map(([seat, entry]) => {
      const field = `game.players.${seat}`;
      if (!isRecord(entry)) throw new Error(`runtime_config_player_invalid: ${field}`);
      assertKnownKeys(entry, ["name", "agent", "spawnArgs", "personalityPrompt"], field);
      let name: string | undefined;
      if (entry.name !== undefined) {
        if (typeof entry.name !== "string" || !entry.name.trim() || entry.name.length > 120)
          throw new Error(`runtime_config_player_name_invalid: ${field}.name`);
        name = entry.name; // 保留用户名字原文，不翻译或静默裁掉空白。
      }
      const agent = readOptionalString(entry.agent, `${field}.agent`);
      if (agent && !Object.hasOwn(agents.items, agent))
        throw new Error(`runtime_config_agent_not_found: ${agent}`);
      const spawnArgs =
        entry.spawnArgs === undefined
          ? undefined
          : readStringArray(entry.spawnArgs, `${field}.spawnArgs`);
      if (spawnArgs && (!agent || agents.items[agent].kind !== "acp"))
        throw new Error(`runtime_config_spawn_args_require_explicit_acp_agent: ${field}`);
      // 三态保留到 setup：缺省继承、null 清除、字符串或语言表覆盖；名字与人格原文不作为模型选择键。
      let personalityPrompt: LocalizedPrompt | null | undefined;
      if (entry.personalityPrompt === null) personalityPrompt = null;
      else if (entry.personalityPrompt !== undefined) {
        if (typeof entry.personalityPrompt === "string")
          personalityPrompt = readPromptText(entry.personalityPrompt, `${field}.personalityPrompt`);
        else {
          if (!isRecord(entry.personalityPrompt))
            throw new Error(`runtime_config_prompt_invalid: ${field}`);
          assertKnownKeys(entry.personalityPrompt, ["zh-CN", "en"], `${field}.personalityPrompt`);
          if (!Object.keys(entry.personalityPrompt).length)
            throw new Error(`runtime_config_prompt_empty: ${field}`);
          personalityPrompt = Object.fromEntries(
            Object.entries(entry.personalityPrompt).map(([locale, text]) => [
              locale,
              readPromptText(text, `${field}.personalityPrompt.${locale}`),
            ]),
          );
        }
      }
      return [
        seat,
        {
          ...(name !== undefined ? { name } : {}),
          ...(agent ? { agent } : {}),
          ...(spawnArgs ? { spawnArgs } : {}),
          ...(personalityPrompt !== undefined ? { personalityPrompt } : {}),
        },
      ];
    }),
  );
}

function normalizeDebugSummaryConfig(raw: unknown, agents: AgentsConfig): DebugSummaryConfig {
  if (!isRecord(raw)) throw new Error("runtime_config_invalid_debug_summary");
  assertKnownKeys(raw, ["agent"], "debugSummary");
  if (raw.agent === undefined) return {};
  if (!isRecord(raw.agent)) throw new Error("runtime_config_invalid_debug_summary_agent");
  assertKnownKeys(
    raw.agent,
    [
      "enabled",
      "agentName",
      "timeoutMs",
      "maxAttempts",
      "concurrency",
      "publicMaxItems",
      "maxItems",
      "playerMaxItems",
    ],
    "debugSummary.agent",
  );
  const agentName = readOptionalString(raw.agent.agentName, "debugSummary.agent.agentName");
  if (agentName && !Object.hasOwn(agents.items, agentName)) {
    throw new Error(`runtime_config_agent_not_found: ${agentName}`);
  }
  return {
    agent: {
      enabled: readOptionalBoolean(raw.agent.enabled, "debugSummary.agent.enabled"),
      agentName,
      timeoutMs: readOptionalPositiveInteger(raw.agent.timeoutMs, "debugSummary.agent.timeoutMs"),
      maxAttempts: readOptionalPositiveInteger(
        raw.agent.maxAttempts,
        "debugSummary.agent.maxAttempts",
      ),
      concurrency: readOptionalPositiveInteger(
        raw.agent.concurrency,
        "debugSummary.agent.concurrency",
      ),
      publicMaxItems: readOptionalMinimumInteger(
        raw.agent.publicMaxItems,
        "debugSummary.agent.publicMaxItems",
        60,
      ),
      maxItems: readOptionalMinimumInteger(raw.agent.maxItems, "debugSummary.agent.maxItems", 50),
      playerMaxItems: readOptionalMinimumInteger(
        raw.agent.playerMaxItems,
        "debugSummary.agent.playerMaxItems",
        60,
      ),
    },
  };
}

export function parseRuntimeConfig(input: {
  backends: unknown;
  agents: unknown;
  game: unknown;
  debugSummary?: unknown;
  environment?: NodeJS.ProcessEnv;
}): RuntimeConfig {
  // 按 backend→Agent→game→audit 的依赖顺序解析，引用错误沿原字段路径抛出；不自行执行 .env 加载。
  const environment = input.environment ?? process.env;
  const providers = normalizeBackends(input.backends, environment);
  const agents = normalizeAgents(input.agents, providers, environment);
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
