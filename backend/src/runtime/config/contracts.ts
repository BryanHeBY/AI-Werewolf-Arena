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


export interface ResolvedAuditConfig {
  profile: ResolvedAgentRuntimeProfile;
  timeoutMs: number;
  maxAttempts: number;
  concurrency: number;
  publicMaxItems: number;
  maxItems: number;
  playerMaxItems: number;
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
